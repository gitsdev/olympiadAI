-- OlympiadIQ — Student signup source attribution
-- Additive only. Captured at signup from a first-touch cookie written by the
-- client (see src/lib/attribution.ts). Students who registered before this
-- migration keep NULL and display as "Unknown" in the admin area.

alter table profiles
  add column if not exists signup_source text,
  add column if not exists signup_attribution jsonb;
