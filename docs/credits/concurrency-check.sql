-- Manual concurrency check for the credit wallet — run on STAGING only.
-- Proves two simultaneous deductions can't overspend one wallet.
--
-- Setup (once, in the SQL editor), with <student-id> being a test student:
--   update feature_credit_costs set credit_cost = 20, is_enabled = true where feature_key = 'brain_booster';
--   select credit_admin_adjust('<student-id>', 30 - (select balance from credit_wallets where user_id = '<student-id>'),
--                              'concurrency test setup', null, gen_random_uuid()::text);
--   -- balance is now exactly 30: room for ONE 20-credit charge, not two.
--
-- Then open TWO psql sessions (or two SQL editor tabs using a direct
-- connection) and run this block in both at nearly the same time:

begin;
select credit_deduct('<student-id>', 'brain_booster', 'concurrency-' || gen_random_uuid()::text);
select pg_sleep(5);   -- hold the wallet row lock so the other session must wait
commit;

-- Expected: the first session returns status "charged" (balance 10). The
-- second blocks on the row lock until the first commits, then returns
-- INSUFFICIENT_CREDITS with balance 10. The balance never goes below 0.
--
-- Cleanup:
--   update feature_credit_costs set credit_cost = null, is_enabled = false where feature_key = 'brain_booster';
