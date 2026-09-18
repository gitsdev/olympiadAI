-- OlympiadIQ — Administrator Area
-- Additive only: new columns (with safe defaults), two new tables, and
-- triggers that keep `students.last_active_at` correct going forward.
-- Does not alter any existing column, policy, or student-facing behavior.
-- Run this in the Supabase SQL editor (same as prior migrations).

-- ── Student activity + moderation status ───────────────────────────────
alter table students
  add column if not exists last_active_at timestamptz,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended'));

-- Backfill last_active_at from existing history so the column isn't empty
-- for students who already have activity.
update students s set last_active_at = sub.last_ts
from (
  select student_id, max(ts) as last_ts from (
    select student_id, coalesce(completed_at, started_at) as ts from test_attempts
    union all
    select student_id, updated_at as ts from ai_conversations
  ) x
  group by student_id
) sub
where sub.student_id = s.id and s.last_active_at is null;

create index if not exists idx_students_last_active on students(last_active_at);
create index if not exists idx_students_account_status on students(account_status);

-- Keep last_active_at fresh automatically for every current and future
-- write path, without requiring every server action to remember to set it.
create or replace function touch_student_last_active()
returns trigger language plpgsql as $$
begin
  update students
  set last_active_at = greatest(coalesce(last_active_at, 'epoch'::timestamptz), now())
  where id = new.student_id;
  return new;
end;
$$;

drop trigger if exists trg_test_attempts_touch_active on test_attempts;
create trigger trg_test_attempts_touch_active
  after insert or update on test_attempts
  for each row execute procedure touch_student_last_active();

drop trigger if exists trg_ai_conversations_touch_active on ai_conversations;
create trigger trg_ai_conversations_touch_active
  after insert or update on ai_conversations
  for each row execute procedure touch_student_last_active();

-- ── Query-pattern indexes for admin aggregation/filtering ──────────────
create index if not exists idx_attempts_completed_at   on test_attempts(completed_at);
create index if not exists idx_attempts_student_started on test_attempts(student_id, started_at desc);
create index if not exists idx_convs_updated_at         on ai_conversations(updated_at);
create index if not exists idx_profiles_role            on profiles(role);
create index if not exists idx_profiles_created_at      on profiles(created_at);

-- ── Configurable thresholds (single-row settings, no invented constants) ─
create table if not exists admin_settings (
  id                          smallint primary key default 1 check (id = 1),
  inactive_days_warning       int not null default 7,
  inactive_days_critical      int not null default 30,
  low_score_threshold         numeric(5,2) not null default 40,
  low_ai_engagement_sessions  int not null default 1,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references profiles(id) on delete set null
);
insert into admin_settings (id) values (1) on conflict (id) do nothing;

alter table admin_settings enable row level security;
-- No policies: this table is only ever read/written via the service-role
-- client behind requireAdmin(), matching the blog_posts write pattern.

create trigger trg_admin_settings_updated_at
  before update on admin_settings
  for each row execute procedure update_updated_at();

-- ── Admin audit log ─────────────────────────────────────────────────────
create table if not exists admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  -- References profiles (not auth.users) so PostgREST can embed the admin's
  -- name via a plain `select=*,admin:profiles(full_name)` from the JS client.
  admin_id     uuid references profiles(id) on delete set null,
  action       text not null,
  target_type  text not null,
  target_id    uuid,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_log_created_at on admin_audit_log(created_at desc);
create index if not exists idx_audit_log_target on admin_audit_log(target_type, target_id);

alter table admin_audit_log enable row level security;
-- No policies: service-role only, same reasoning as admin_settings.
