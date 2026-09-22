-- OlympiadIQ — fix "infinite recursion detected in policy for relation
-- battle_participants" from 006_battle_schema.sql.
--
-- Root cause: battle_participants' SELECT policy subqueried
-- battle_participants itself (direct self-recursion), AND battles'
-- SELECT policy subqueried battle_participants while battle_participants'
-- policy subqueried battles back — a cross-table cycle. Postgres detects
-- either shape as infinite recursion when evaluating the policy.
--
-- Fix: both policies are now keyed off battles.created_by only, with no
-- reference back from battles to battle_participants. Phase 1 only ever
-- has one human per battle (the creator), so this loses no coverage today.
-- When Phase 2 adds a second human participant, add visibility via a
-- SECURITY DEFINER helper function instead of a direct cross-table
-- subquery, to avoid reintroducing this cycle.
-- Run this once against any database that already applied 006_battle_schema.sql.

drop policy if exists "own or participant battles" on battles;
drop policy if exists "own battles" on battles;
create policy "own battles" on battles
  for select using (created_by in (select id from students where profile_id = auth.uid()));

drop policy if exists "own battle participants" on battle_participants;
create policy "own battle participants" on battle_participants
  for select using (
    battle_id in (select id from battles where created_by in (select id from students where profile_id = auth.uid()))
  );
