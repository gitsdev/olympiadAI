-- OlympiadIQ — charge 5 credits per Mock Test and per Practice session.
-- Run after 021. Registers "practice" as its own feature (so the two can be
-- priced separately later) and sets both prices. Prices remain editable in
-- /admin/credits/pricing. Safe to re-run.

insert into feature_credit_costs (feature_key, feature_name)
values ('practice', 'Practice')
on conflict (feature_key) do nothing;

update feature_credit_costs
   set credit_cost = 5, is_enabled = true
 where feature_key in ('mock_test', 'practice');
