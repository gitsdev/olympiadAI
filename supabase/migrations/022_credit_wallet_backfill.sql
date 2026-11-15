-- OlympiadIQ — Credit Wallet backfill for existing students
-- Run AFTER 021_credit_wallet.sql. Creates a wallet and grants the one-time
-- 25 welcome credits to every existing student (profiles.role = 'student').
--
-- Idempotent: credit_grant_welcome() skips anyone already granted (unique
-- idempotency key 'welcome:<user id>' + a partial unique index), so running
-- this twice changes nothing. Admins, parents and other non-student
-- accounts are skipped by the same eligibility check new signups use.

do $$
declare
  r record;
  v_result text;
  v_granted int := 0;
  v_skipped int := 0;
begin
  for r in
    select p.id from profiles p
      join auth.users u on u.id = p.id
     where p.role = 'student'
     order by p.created_at
  loop
    v_result := credit_grant_welcome(r.id);
    if v_result = 'granted' then v_granted := v_granted + 1; else v_skipped := v_skipped + 1; end if;
  end loop;
  raise notice 'credit backfill: % granted, % skipped (already granted or not eligible)', v_granted, v_skipped;
end;
$$;
