-- OlympiadIQ — Multiple email campaign templates
-- Generalises the re-engagement queries from 010_email_campaigns.sql so any
-- campaign (mock_test, brain_booster, battle, ai_tutor, ...) can be sent to
-- either inactive students or all students, each with its own cooldown
-- tracked in email_campaign_sends.campaign. Same security model as 010.

drop function if exists admin_reengagement_candidates(int, int, int);
drop function if exists admin_reengagement_counts(int, int);

-- p_segment: 'inactive' (never active, or last active > p_inactive_days ago)
--            or 'all' (every active-status student).
create or replace function admin_campaign_candidates(
  p_campaign      text,
  p_segment       text,
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
    and (
      p_segment = 'all'
      or s.last_active_at is null
      or s.last_active_at < now() - make_interval(days => p_inactive_days)
    )
    and not exists (
      select 1 from email_campaign_sends e
      where e.campaign = p_campaign
        and e.student_id = s.id
        and e.recipient_role = 'student'
        and e.sent_at > now() - make_interval(days => p_cooldown_days)
    )
  order by s.last_active_at desc nulls last, s.id
  limit p_limit;
$$;

create or replace function admin_campaign_counts(
  p_campaign      text,
  p_segment       text,
  p_inactive_days int,
  p_cooldown_days int
)
returns table (never_started bigint, lapsed bigint, active bigint, recently_emailed bigint, opted_out bigint)
language sql stable as $$
  with base as (
    select s.last_active_at, p.email_opt_out,
           (s.last_active_at is null or s.last_active_at < now() - make_interval(days => p_inactive_days)) as inactive,
           exists (
             select 1 from email_campaign_sends e
             where e.campaign = p_campaign
               and e.student_id = s.id
               and e.recipient_role = 'student'
               and e.sent_at > now() - make_interval(days => p_cooldown_days)
           ) as recently_emailed
    from students s
    join profiles p on p.id = s.profile_id
    where s.account_status = 'active'
      and coalesce(p.email, '') <> ''
  )
  select
    count(*) filter (where last_active_at is null and not email_opt_out and not recently_emailed),
    count(*) filter (where last_active_at is not null and inactive and not email_opt_out and not recently_emailed),
    count(*) filter (where not inactive and not email_opt_out and not recently_emailed),
    count(*) filter (where recently_emailed and not email_opt_out),
    count(*) filter (where email_opt_out)
  from base
  where p_segment = 'all' or inactive;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'admin_campaign_candidates(text,text,int,int,int)',
    'admin_campaign_counts(text,text,int,int)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated;', fn);
    execute format('grant execute on function %s to service_role;', fn);
  end loop;
end $$;
