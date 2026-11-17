-- OlympiadIQ — refund Practice / Mock Test charges whose questions never arrived.
-- Run after 021. Safe to re-run.
--
-- A session is charged when the student clicks Start, before the questions
-- are generated. If the generate step never completes (the student's
-- connection drops, the tab closes, the server is cut off), nothing was
-- delivered and the charge must be given back. The ledger is append-only,
-- so delivery is recorded here instead; a sweep refunds any tracked charge
-- that has no delivery after a few minutes.
--
-- Only charges whose metadata has delivery_tracked = true are considered,
-- so charges made before this migration (and other features) are never
-- touched.

create table if not exists credit_session_deliveries (
  usage_transaction_id uuid primary key references credit_transactions(id) on delete cascade,
  delivered_at         timestamptz not null default now()
);

-- When delivery recording began. The app tags charges as tracked as soon
-- as it is deployed, which may be before this migration runs; deliveries
-- in that gap couldn't be recorded, so only charges made after this point
-- are ever swept. One row; re-running keeps the original time.
create table if not exists credit_session_tracking (
  id         boolean primary key default true check (id),
  started_at timestamptz not null default now()
);
insert into credit_session_tracking (id) values (true) on conflict (id) do nothing;

alter table credit_session_deliveries enable row level security;
alter table credit_session_tracking   enable row level security;
-- No policies: server (service role) only.
revoke all on credit_session_deliveries, credit_session_tracking from anon, authenticated;

-- Records that a charged session delivered its questions. Idempotent.
-- Returns false if the transaction isn't this user's usage charge.
create or replace function credit_mark_session_delivered(p_user_id uuid, p_usage_transaction_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from credit_transactions
     where id = p_usage_transaction_id and user_id = p_user_id and transaction_type = 'usage'
  ) then
    return false;
  end if;
  insert into credit_session_deliveries (usage_transaction_id) values (p_usage_transaction_id)
  on conflict (usage_transaction_id) do nothing;
  return true;
end;
$$;

-- Tracked usage charges older than p_min_age_minutes (and newer than
-- p_max_age_minutes) with no delivery and no refund yet. p_user_id null =
-- every user (the daily cron); otherwise just that student.
create or replace function credit_list_undelivered_sessions(
  p_user_id uuid,
  p_min_age_minutes integer,
  p_max_age_minutes integer,
  p_limit integer
)
returns table (transaction_id uuid, user_id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.user_id, t.created_at
    from credit_transactions t
   where t.transaction_type = 'usage'
     and t.metadata ->> 'delivery_tracked' = 'true'
     and (p_user_id is null or t.user_id = p_user_id)
     and t.created_at <  now() - make_interval(mins => p_min_age_minutes)
     and t.created_at >= now() - make_interval(mins => p_max_age_minutes)
     and t.created_at >= (select started_at from credit_session_tracking where id)
     and not exists (select 1 from credit_session_deliveries d where d.usage_transaction_id = t.id)
     and not exists (select 1 from credit_transactions r where r.idempotency_key = 'reversal:' || t.id::text)
   order by t.created_at
   limit greatest(1, least(p_limit, 1000));
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'credit_mark_session_delivered(uuid, uuid)',
    'credit_list_undelivered_sessions(uuid, integer, integer, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
