-- OlympiadIQ — AI Question Paper Solver
-- Users upload a PDF/DOCX question paper; a background worker extracts every
-- question, solves it with Claude, and the result can be edited and exported.
-- See docs/question-paper-solver/.
--
-- Access model:
--   * Users (cookie session, RLS): SELECT their own jobs and questions only.
--     They have NO insert/update/delete policies — every mutation goes through
--     server code, which checks ownership and then writes with the service
--     role. This stops a user from changing job status, rate-limit counters
--     or worker locks by calling the REST API directly with their JWT.
--   * Platform admins: SELECT everything (via is_platform_admin(), migration 013).
--   * Worker / cron: service role (bypasses RLS), server-only.
--
-- Storage: private bucket `question-papers`. There are deliberately no
-- storage.objects policies for it: uploads use one-off signed upload URLs
-- created server-side for a path the server chose, and downloads use
-- short-lived signed URLs, so only the service role ever touches it directly.
--
-- Statuses are text + CHECK (like the SEO Agent) so values can be added later.
-- Additive only; run in the Supabase SQL editor like earlier migrations.

-- is_platform_admin() is defined in 013; recreate defensively in case this
-- migration is applied to a database without the SEO Agent tables.
create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'platform_admin'
  );
$$;
revoke execute on function is_platform_admin() from public, anon;
grant execute on function is_platform_admin() to authenticated, service_role;

-- ── Jobs ─────────────────────────────────────────────────────────────────
create table if not exists qps_jobs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,

  -- Uploaded file
  file_name          text not null check (char_length(file_name) between 1 and 255),
  file_ext           text not null check (file_ext in ('pdf', 'docx')),
  mime_type          text not null,
  file_size          integer not null check (file_size > 0 and file_size <= 15728640),
  storage_path       text not null,
  page_count         integer,
  is_scanned         boolean,

  -- Academic info (null = auto-detect from the paper)
  class_level        smallint check (class_level between 1 and 10),
  board              text,
  subject            text,
  exam_type          text check (exam_type in ('school_exam', 'olympiad', 'practice_test')),
  detail_level       text not null default 'detailed'
                       check (detail_level in ('short', 'detailed', 'step_by_step')),
  auto_detect        boolean not null default true,
  detected_meta      jsonb,

  -- Processing
  status             text not null default 'awaiting_upload'
                       check (status in ('awaiting_upload', 'queued', 'extracting', 'solving',
                                         'finalizing', 'completed', 'failed', 'cancelled')),
  stage              text not null default 'reading'
                       check (stage in ('reading', 'extracting', 'identifying', 'solving',
                                        'formatting', 'finalizing', 'done')),
  progress           smallint not null default 0 check (progress between 0 and 100),
  total_questions    integer not null default 0,
  solved_questions   integer not null default 0,
  flagged_questions  integer not null default 0,
  extract_cursor     integer not null default 0,   -- next extraction chunk to process
  extract_chunks     integer not null default 0,   -- total extraction chunks
  attempts           smallint not null default 0,  -- consecutive failures of the current step
  locked_until       timestamptz,                  -- worker lease
  lock_token         uuid,
  last_error         text,                         -- user-safe message only
  source_markdown    text,                         -- DOCX only: converted text (sanitised Markdown)
  source_images      jsonb,                        -- DOCX only: [{id, path, mime, supported}]
  extraction         jsonb not null default '[]'::jsonb, -- raw per-chunk extractor output

  -- Exports (regenerated whenever answers_version moves past exports_version)
  answers_version    integer not null default 1,
  export_pdf_path    text,
  export_pdf_version integer,
  export_docx_path   text,
  export_docx_version integer,

  -- Usage (real numbers from the API, for cost tracking)
  ai_model           text,
  ai_input_tokens    integer not null default 0,
  ai_output_tokens   integer not null default 0,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  started_at         timestamptz,
  completed_at       timestamptz,
  source_deleted_at  timestamptz,

  constraint qps_jobs_completed_has_timestamp
    check (status <> 'completed' or completed_at is not null)
);

create index if not exists qps_jobs_user_created_idx on qps_jobs (user_id, created_at desc);
create index if not exists qps_jobs_active_idx on qps_jobs (status)
  where status in ('queued', 'extracting', 'solving', 'finalizing');
create index if not exists qps_jobs_retention_idx on qps_jobs (created_at)
  where source_deleted_at is null;

-- One active job per user, enforced atomically (no check-then-insert race).
create unique index if not exists qps_jobs_one_active_per_user
  on qps_jobs (user_id)
  where status in ('awaiting_upload', 'queued', 'extracting', 'solving', 'finalizing');

-- ── Questions / answers ──────────────────────────────────────────────────
create table if not exists qps_questions (
  id                    uuid primary key default gen_random_uuid(),
  job_id                uuid not null references qps_jobs (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,
  order_index           integer not null,
  section               text,
  number_label          text not null,
  type                  text not null default 'other'
                          check (type in ('mcq', 'fill_blank', 'match', 'true_false', 'short',
                                          'long', 'numerical', 'diagram', 'comprehension',
                                          'assertion_reason', 'other')),
  context_md            text,           -- shared passage / instructions needed to answer
  question_md           text not null default '',
  options               jsonb,          -- [{label, text}]
  match_pairs           jsonb,          -- {left: [..], right: [..]}
  has_diagram           boolean not null default false,
  diagram_description   text,
  image_refs            text[] not null default '{}',   -- DOCX image ids used by this question
  source_pages          integer[] not null default '{}',
  marks                 numeric,

  extraction_confidence text not null default 'high'
                          check (extraction_confidence in ('high', 'medium', 'low')),
  needs_review          boolean not null default false,
  review_reason         text,
  review_source         text check (review_source in ('extraction', 'solver', 'user')),

  answer_status         text not null default 'pending'
                          check (answer_status in ('pending', 'answered', 'cannot_answer', 'failed')),
  answer_short          text,
  correct_option        text,
  answer_md             text,
  explanation_md        text,
  final_answer          text,
  answer_confidence     text check (answer_confidence in ('high', 'medium', 'low')),
  edited_by_user        boolean not null default false,
  regen_count           integer not null default 0,
  solve_attempts        smallint not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (job_id, order_index)
);

-- For databases where an earlier draft of this migration ran without it.
alter table qps_questions add column if not exists context_md text;

create index if not exists qps_questions_job_idx on qps_questions (job_id, order_index);
create index if not exists qps_questions_pending_idx on qps_questions (job_id, order_index)
  where answer_status = 'pending';

-- ── Rate-limit ledger (single-answer regenerations) ──────────────────────
create table if not exists qps_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('regenerate_answer', 'regenerate_sheet')),
  job_id     uuid references qps_jobs (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists qps_usage_user_kind_idx on qps_usage (user_id, kind, created_at desc);

-- ── Internal event log (admins only — may contain raw provider errors) ───
create table if not exists qps_job_logs (
  id         bigint generated always as identity primary key,
  job_id     uuid references qps_jobs (id) on delete cascade,
  level      text not null check (level in ('info', 'warn', 'error')),
  event      text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists qps_job_logs_job_idx on qps_job_logs (job_id, created_at desc);

-- ── updated_at triggers ──────────────────────────────────────────────────
create or replace function qps_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists qps_jobs_touch on qps_jobs;
create trigger qps_jobs_touch before update on qps_jobs
  for each row execute function qps_touch_updated_at();

drop trigger if exists qps_questions_touch on qps_questions;
create trigger qps_questions_touch before update on qps_questions
  for each row execute function qps_touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table qps_jobs      enable row level security;
alter table qps_questions enable row level security;
alter table qps_usage     enable row level security;
alter table qps_job_logs  enable row level security;

drop policy if exists qps_jobs_select on qps_jobs;
create policy qps_jobs_select on qps_jobs
  for select to authenticated
  using (user_id = auth.uid() or is_platform_admin());

drop policy if exists qps_questions_select on qps_questions;
create policy qps_questions_select on qps_questions
  for select to authenticated
  using (user_id = auth.uid() or is_platform_admin());

drop policy if exists qps_usage_select on qps_usage;
create policy qps_usage_select on qps_usage
  for select to authenticated
  using (user_id = auth.uid() or is_platform_admin());

drop policy if exists qps_job_logs_select on qps_job_logs;
create policy qps_job_logs_select on qps_job_logs
  for select to authenticated
  using (is_platform_admin());

-- No insert/update/delete policies: writes are server-side only (service role).
revoke insert, update, delete on qps_jobs, qps_questions, qps_usage, qps_job_logs from anon, authenticated;

-- ── Storage bucket ───────────────────────────────────────────────────────
-- Size and MIME limits are enforced by Storage itself as a backstop to the
-- server checks. DOCX images extracted for vision, and generated exports,
-- live in the same bucket under the job's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-papers',
  'question-papers',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
