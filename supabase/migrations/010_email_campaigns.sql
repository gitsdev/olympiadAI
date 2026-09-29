-- OlympiadIQ — Re-engagement email campaigns
-- Additive only. Adds per-profile email opt-out (with an unguessable token
-- for the no-login unsubscribe link), a send log that doubles as the
-- cooldown/resume ledger for bulk sends, and admin-only candidate queries.
--
-- SECURITY: same model as 005_admin_queries.sql — the functions are SECURITY
-- INVOKER, only ever called via createServiceClient() behind requireAdmin(),
-- and EXECUTE is revoked from anon/authenticated.

-- ── Opt-out ─────────────────────────────────────────────────────────────
alter table profiles
  add column if not exists email_opt_out     boolean not null default false,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists idx_profiles_unsubscribe_token on profiles(unsubscribe_token);

-- ── Send log ────────────────────────────────────────────────────────────
create table if not exists email_campaign_sends (
  id              uuid primary key default gen_random_uuid(),
  campaign        text not null,
  student_id      uuid not null references students(id) on delete cascade,
  recipient_email text not null,
  recipient_role  text not null check (recipient_role in ('student', 'parent')),
  sent_by         uuid references profiles(id) on delete set null,
  sent_at         timestamptz not null default now()
);

create index if not exists idx_email_campaign_sends_lookup
  on email_campaign_sends(campaign, student_id, sent_at desc);

alter table email_campaign_sends enable row level security;
-- No policies: service-role only.

-- ── Candidates ──────────────────────────────────────────────────────────
-- A student is a candidate when they are inactive (never active, or last
-- active more than p_inactive_days ago — same rule as admin_list_students'
-- 'inactive_7' filter), not suspended, not opted out, and haven't received
-- this campaign within p_cooldown_days. Recording a send in
-- email_campaign_sends removes the student from the next call's results,
-- which is what lets the admin UI send in small resumable batches.
create or replace function admin_reengagement_candidates(
  p_inactive_days int,
  p_cooldown_days int,
  p_limit         int default 50
)
returns table (
  student_id        uuid,
  email             text,
  full_name         text,
  class_level       smallint,
  streak_days       int,
  total_points      int,
  last_active_at    timestamptz,
  unsubscribe_token uuid
)
language sql stable as $$
  select s.id, p.email, p.full_name, s.class_level, s.streak_days, s.total_points,
         s.last_active_at, p.unsubscribe_token
  from students s
  join profiles p on p.id = s.profile_id
  where s.account_status = 'active'
    and p.email_opt_out = false
    and coalesce(p.email, '') <> ''
    and (s.last_active_at is null or s.last_active_at < now() - make_interval(days => p_inactive_days))
    and not exists (
      select 1 from email_campaign_sends e
      where e.campaign = 'reengagement'
        and e.student_id = s.id
        and e.recipient_role = 'student'
        and e.sent_at > now() - make_interval(days => p_cooldown_days)
    )
  order by s.last_active_at desc nulls last, s.id
  limit p_limit;
$$;

create or replace function admin_reengagement_counts(
  p_inactive_days int,
  p_cooldown_days int
)
returns table (never_started bigint, lapsed bigint, recently_emailed bigint, opted_out bigint)
language sql stable as $$
  with inactive as (
    select s.id, s.last_active_at, p.email_opt_out,
           exists (
             select 1 from email_campaign_sends e
             where e.campaign = 'reengagement'
               and e.student_id = s.id
               and e.recipient_role = 'student'
               and e.sent_at > now() - make_interval(days => p_cooldown_days)
           ) as recently_emailed
    from students s
    join profiles p on p.id = s.profile_id
    where s.account_status = 'active'
      and coalesce(p.email, '') <> ''
      and (s.last_active_at is null or s.last_active_at < now() - make_interval(days => p_inactive_days))
  )
  select
    count(*) filter (where last_active_at is null and not email_opt_out and not recently_emailed),
    count(*) filter (where last_active_at is not null and not email_opt_out and not recently_emailed),
    count(*) filter (where recently_emailed and not email_opt_out),
    count(*) filter (where email_opt_out)
  from inactive;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'admin_reengagement_candidates(int,int,int)',
    'admin_reengagement_counts(int,int)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated;', fn);
    execute format('grant execute on function %s to service_role;', fn);
  end loop;
end $$;
