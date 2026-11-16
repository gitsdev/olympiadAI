-- OlympiadIQ — register the Question Paper Solver as a credit-based feature.
-- Run after 021. Added unpriced with charging off (free) — set the price and
-- enable charging from /admin/credits/pricing. Safe to re-run.

insert into feature_credit_costs (feature_key, feature_name)
values ('question_paper_solver', 'Question Paper Solver')
on conflict (feature_key) do nothing;
