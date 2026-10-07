-- OlympiadIQ SEO Agent — schema (Phase 1)
-- A self-contained admin section at /admin/seo-agent. Every table is prefixed
-- `seo_` so nothing collides with the existing app (profiles, admin_settings,
-- blog_posts …). `profiles` is reused as-is for users/approvers.
--
-- Access model:
--   * Admin UI (cookie session)  → RLS: only profiles.role = 'platform_admin'.
--   * Cron / publishing pipeline → service-role key (bypasses RLS), server-only.
--
-- Status columns use text + CHECK rather than Postgres enums so later phases
-- can add values with a simple constraint swap. Additive only; run in the
-- Supabase SQL editor like the earlier migrations.

-- ── Helpers ──────────────────────────────────────────────────────────────
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

-- ── Settings (singleton) ─────────────────────────────────────────────────
create table if not exists seo_settings (
  id                            smallint primary key default 1 check (id = 1),
  ai_provider                   text not null default 'openai' check (ai_provider in ('openai')),
  ai_model                      text not null default 'gpt-4o-mini',
  -- Per-model pricing, USD per 1M tokens: {"<model>": {"input": n, "output": n}}.
  -- Empty by default on purpose: cost is reported as "unknown" until the
  -- admin enters the provider's current prices. We never assume pricing.
  ai_pricing                    jsonb not null default '{}'::jsonb,
  publishing_mode               text not null default 'MANUAL_APPROVAL'
                                  check (publishing_mode in ('MANUAL_APPROVAL', 'AUTO_PUBLISH')),
  default_publish_time          time not null default '10:00',
  timezone                      text not null default 'Asia/Kolkata',
  content_planning_frequency    text not null default 'DAILY'  check (content_planning_frequency    in ('DAILY', 'WEEKLY', 'OFF')),
  article_generation_frequency  text not null default 'DAILY'  check (article_generation_frequency  in ('DAILY', 'WEEKLY', 'OFF')),
  search_console_sync_frequency text not null default 'DAILY'  check (search_console_sync_frequency in ('DAILY', 'WEEKLY', 'OFF')),
  backlink_check_frequency      text not null default 'WEEKLY' check (backlink_check_frequency      in ('DAILY', 'WEEKLY', 'OFF')),
  default_article_category      text not null default 'Olympiad Prep',
  default_cta                   text not null default 'MOCK_TEST'
                                  check (default_cta in ('MOCK_TEST', 'AI_TUTOR', 'BATTLE', 'BRAIN_BOOSTER')),
  -- Search Console property, e.g. "sc-domain:olympiadiq.in". Credentials stay in env vars.
  search_console_site_url       text,
  blog_base_url                 text not null default 'https://www.olympiadiq.in/blog',
  brand                         jsonb not null default jsonb_build_object(
    'name', 'OlympiadIQ',
    'website', 'https://www.olympiadiq.in/',
    'audience', jsonb_build_array('Students', 'Parents', 'Teachers'),
    'topics', jsonb_build_array('Olympiad preparation', 'Mathematics', 'Science', 'Reasoning',
                                'Practice', 'Mock tests', 'AI learning', 'Brain games'),
    'features', jsonb_build_array('Free Unlimited Mock Tests', 'AI Tutor',
                                  'Battle with Friends', 'Brain Booster Games')
  ),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  updated_by                    uuid references profiles(id) on delete set null
);
insert into seo_settings (id) values (1) on conflict (id) do nothing;

-- ── Agent task log (referenced by most tables below) ─────────────────────
create table if not exists seo_agent_tasks (
  id              uuid primary key default gen_random_uuid(),
  agent_type      text not null,   -- KeywordAgent, ContentPlanner, ContentWriter, SEOAgent, Publisher …
  task_type       text not null,   -- analyze_keywords, generate_article, publish …
  entity_type     text,            -- keyword | cluster | content_plan | article | prospect …
  entity_id       uuid,
  status          text not null default 'PENDING'
                    check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'WAITING_APPROVAL', 'CANCELLED')),
  triggered_by    text not null default 'USER' check (triggered_by in ('USER', 'CRON', 'SYSTEM')),
  input_summary   text,
  output_summary  text,
  error           text,
  started_at      timestamptz,
  completed_at    timestamptz,
  model           text,
  input_tokens    integer,
  output_tokens   integer,
  estimated_cost  numeric(12, 6),   -- null = pricing not configured
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- A task is only "completed" if it actually finished.
  constraint seo_agent_tasks_completed_has_time
    check (status not in ('COMPLETED', 'FAILED') or completed_at is not null)
);
create index if not exists idx_seo_agent_tasks_created on seo_agent_tasks (created_at desc);
create index if not exists idx_seo_agent_tasks_status  on seo_agent_tasks (status);
create index if not exists idx_seo_agent_tasks_entity  on seo_agent_tasks (entity_type, entity_id);

-- ── AI usage / cost ──────────────────────────────────────────────────────
create table if not exists seo_ai_usage (
  id              uuid primary key default gen_random_uuid(),
  agent_task_id   uuid references seo_agent_tasks(id) on delete set null,
  provider        text not null,
  model           text not null,
  category        text not null default 'OTHER'
                    check (category in ('CONTENT', 'SEO', 'KEYWORD_ANALYSIS', 'BACKLINKS', 'OTHER')),
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  estimated_cost  numeric(12, 6),   -- null = pricing not configured for this model
  created_at      timestamptz not null default now()
);
create index if not exists idx_seo_ai_usage_created  on seo_ai_usage (created_at desc);
create index if not exists idx_seo_ai_usage_category on seo_ai_usage (category);

-- ── Keywords ─────────────────────────────────────────────────────────────
create table if not exists seo_keywords (
  id                  uuid primary key default gen_random_uuid(),
  keyword             text not null check (length(trim(keyword)) between 2 and 200),
  -- Lower-cased, whitespace-collapsed form; used for de-duplication.
  keyword_normalized  text generated always as (lower(regexp_replace(trim(keyword), '\s+', ' ', 'g'))) stored,
  search_intent       text check (search_intent in ('INFORMATIONAL', 'NAVIGATIONAL', 'COMMERCIAL', 'TRANSACTIONAL')),
  target_class        smallint check (target_class between 1 and 12),
  subject             text,
  priority            text not null default 'MEDIUM' check (priority in ('HIGH', 'MEDIUM', 'LOW')),
  status              text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'USED', 'ARCHIVED')),
  notes               text,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists uq_seo_keywords_normalized on seo_keywords (keyword_normalized);
create index if not exists idx_seo_keywords_status on seo_keywords (status);

-- ── Keyword clusters ─────────────────────────────────────────────────────
create table if not exists seo_keyword_clusters (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  primary_keyword_id    uuid references seo_keywords(id) on delete set null,
  primary_keyword       text not null,
  -- AI-suggested variants that are not (yet) rows in seo_keywords.
  secondary_keywords    text[] not null default '{}',
  question_keywords     text[] not null default '{}',
  search_intent         text check (search_intent in ('INFORMATIONAL', 'NAVIGATIONAL', 'COMMERCIAL', 'TRANSACTIONAL')),
  recommended_title     text,
  status                text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  agent_task_id         uuid references seo_agent_tasks(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_seo_clusters_status on seo_keyword_clusters (status);

create table if not exists seo_keyword_cluster_members (
  cluster_id  uuid not null references seo_keyword_clusters(id) on delete cascade,
  keyword_id  uuid not null references seo_keywords(id) on delete cascade,
  role        text not null default 'SECONDARY' check (role in ('PRIMARY', 'SECONDARY', 'QUESTION')),
  created_at  timestamptz not null default now(),
  primary key (cluster_id, keyword_id)
);
create index if not exists idx_seo_cluster_members_keyword on seo_keyword_cluster_members (keyword_id);

-- ── Content opportunities ────────────────────────────────────────────────
create table if not exists seo_content_opportunities (
  id                      uuid primary key default gen_random_uuid(),
  cluster_id              uuid references seo_keyword_clusters(id) on delete cascade,
  type                    text not null check (type in ('NEW_ARTICLE', 'UPDATE_EXISTING', 'MERGE_ARTICLES', 'NO_ACTION')),
  title                   text,
  reason                  text not null,   -- every recommendation must say why
  related_blog_post_ids   uuid[] not null default '{}',
  cannibalization_risk    text not null default 'NONE' check (cannibalization_risk in ('NONE', 'LOW', 'MEDIUM', 'HIGH')),
  source                  text not null default 'KEYWORD_ANALYSIS' check (source in ('KEYWORD_ANALYSIS', 'SEARCH_CONSOLE', 'MANUAL')),
  status                  text not null default 'OPEN' check (status in ('OPEN', 'ACCEPTED', 'DISMISSED')),
  agent_task_id           uuid references seo_agent_tasks(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists idx_seo_content_opps_status  on seo_content_opportunities (status);
create index if not exists idx_seo_content_opps_cluster on seo_content_opportunities (cluster_id);

-- ── Content plans (calendar) ─────────────────────────────────────────────
create table if not exists seo_content_plans (
  id                        uuid primary key default gen_random_uuid(),
  cluster_id                uuid references seo_keyword_clusters(id) on delete set null,
  opportunity_id            uuid references seo_content_opportunities(id) on delete set null,
  title                     text not null,
  primary_keyword           text not null,
  secondary_keywords        text[] not null default '{}',
  search_intent             text check (search_intent in ('INFORMATIONAL', 'NAVIGATIONAL', 'COMMERCIAL', 'TRANSACTIONAL')),
  content_type              text,   -- guide, question bank, comparison …
  target_audience           text,
  outline                   jsonb not null default '[]'::jsonb,
  recommended_cta           text check (recommended_cta in ('MOCK_TEST', 'AI_TUTOR', 'BATTLE', 'BRAIN_BOOSTER')),
  suggested_internal_links  jsonb not null default '[]'::jsonb,
  planned_publish_at        timestamptz,
  status                    text not null default 'IDEA' check (status in (
                              'IDEA', 'PLANNED', 'GENERATING', 'DRAFT', 'REVIEW', 'APPROVED',
                              'SCHEDULED', 'PUBLISHED', 'REJECTED', 'ARCHIVED')),
  notes                     text,
  created_by                uuid references profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists idx_seo_plans_status_date on seo_content_plans (status, planned_publish_at);
create index if not exists idx_seo_plans_cluster     on seo_content_plans (cluster_id);

-- ── Articles ─────────────────────────────────────────────────────────────
create table if not exists seo_articles (
  id                      uuid primary key default gen_random_uuid(),
  content_plan_id         uuid references seo_content_plans(id) on delete set null,
  title                   text not null,
  slug                    text,
  meta_title              text,
  meta_description        text,
  excerpt                 text,
  content_html            text not null default '',   -- sanitized TipTap HTML
  content_json            jsonb,                      -- TipTap document
  featured_image_url      text,
  featured_image_alt      text,
  featured_image_prompt   text,
  primary_keyword         text,
  secondary_keywords      text[] not null default '{}',
  category                text,
  cta_type                text check (cta_type in ('MOCK_TEST', 'AI_TUTOR', 'BATTLE', 'BRAIN_BOOSTER')),
  origin                  text not null default 'AI' check (origin in ('AI', 'MANUAL')),
  status                  text not null default 'DRAFT' check (status in (
                            'GENERATING', 'DRAFT', 'REVIEW', 'REVIEW_REQUIRED', 'APPROVED',
                            'SCHEDULED', 'PUBLISHED', 'REJECTED', 'ARCHIVED')),
  -- Internal content-quality score (NOT a Google ranking score) + latest analysis.
  seo_score               smallint check (seo_score between 0 and 100),
  seo_analysis            jsonb,
  quality_flags           jsonb not null default '[]'::jsonb,
  -- How publication was authorized: a human approval, or the AUTO_PUBLISH setting.
  publish_authorization   text check (publish_authorization in ('MANUAL_APPROVAL', 'AUTO_PUBLISH')),
  approved_by             uuid references profiles(id) on delete set null,
  approved_at             timestamptz,
  scheduled_for           timestamptz,   -- UTC; displayed in settings.timezone
  published_at            timestamptz,
  published_url           text,
  blog_post_id            uuid references blog_posts(id) on delete set null,
  current_version         integer not null default 0,
  created_by              uuid references profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Database-level guarantee: nothing reaches APPROVED/SCHEDULED/PUBLISHED
  -- under manual approval without an approval record.
  -- (coalesce: a NULL authorization must fail the check, not pass it as NULL.)
  constraint seo_articles_requires_approval check (
    status not in ('APPROVED', 'SCHEDULED', 'PUBLISHED')
    or coalesce(publish_authorization = 'AUTO_PUBLISH', false)
    or (coalesce(publish_authorization = 'MANUAL_APPROVAL', false) and approved_at is not null and approved_by is not null)
  ),
  constraint seo_articles_scheduled_has_time check (status <> 'SCHEDULED' or scheduled_for is not null),
  constraint seo_articles_published_has_time check (status <> 'PUBLISHED' or published_at is not null)
);
create unique index if not exists uq_seo_articles_slug on seo_articles (slug) where slug is not null and status <> 'ARCHIVED';
create index if not exists idx_seo_articles_status_sched on seo_articles (status, scheduled_for);
create index if not exists idx_seo_articles_plan         on seo_articles (content_plan_id);

create table if not exists seo_article_versions (
  id              uuid primary key default gen_random_uuid(),
  article_id      uuid not null references seo_articles(id) on delete cascade,
  version_number  integer not null,
  title           text not null,
  content_html    text not null,
  content_json    jsonb,
  metadata        jsonb not null default '{}'::jsonb,   -- slug, meta title/description, excerpt, cta …
  source          text not null check (source in ('AI_GENERATED', 'MANUAL_EDIT', 'RESTORE')),
  agent_task_id   uuid references seo_agent_tasks(id) on delete set null,
  created_by      uuid references profiles(id) on delete set null,   -- null for AI/cron
  created_at      timestamptz not null default now(),
  unique (article_id, version_number)
);

create table if not exists seo_article_links (
  id                    uuid primary key default gen_random_uuid(),
  article_id            uuid not null references seo_articles(id) on delete cascade,
  target_url            text not null,
  target_type           text not null default 'ARTICLE' check (target_type in ('ARTICLE', 'FEATURE_PAGE', 'EXTERNAL')),
  target_blog_post_id   uuid references blog_posts(id) on delete set null,
  anchor_text           text not null,
  reason                text,
  source                text not null default 'AI' check (source in ('AI', 'MANUAL')),
  status                text not null default 'SUGGESTED' check (status in ('SUGGESTED', 'ACCEPTED', 'REJECTED', 'INSERTED')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_seo_article_links_article on seo_article_links (article_id);

create table if not exists seo_article_ctas (
  id              uuid primary key default gen_random_uuid(),
  article_id      uuid not null references seo_articles(id) on delete cascade,
  cta_type        text not null check (cta_type in ('MOCK_TEST', 'AI_TUTOR', 'BATTLE', 'BRAIN_BOOSTER')),
  placement       text not null default 'END' check (placement in ('TOP', 'INLINE', 'END')),
  selected_by     text not null default 'AI' check (selected_by in ('AI', 'MANUAL')),
  reason          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_seo_article_ctas_article on seo_article_ctas (article_id);

-- ── Search Console daily snapshots ───────────────────────────────────────
create table if not exists seo_metrics (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  query         text not null default '',   -- '' = page-level aggregate row
  page          text not null default '',
  clicks        integer not null default 0,
  impressions   integer not null default 0,
  ctr           numeric(8, 6) not null default 0,
  position      numeric(8, 2),
  article_id    uuid references seo_articles(id) on delete set null,
  blog_post_id  uuid references blog_posts(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (date, query, page)
);
create index if not exists idx_seo_metrics_date    on seo_metrics (date desc);
create index if not exists idx_seo_metrics_page    on seo_metrics (page);
create index if not exists idx_seo_metrics_query   on seo_metrics (query);
create index if not exists idx_seo_metrics_article on seo_metrics (article_id);

create table if not exists seo_opportunities (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in (
                    'HIGH_IMPRESSIONS_LOW_CTR', 'STRIKING_DISTANCE', 'DECLINING_PAGE',
                    'NEW_QUERY', 'WEAK_CLICKS', 'CONTENT_GAP', 'UPDATE_ARTICLE')),
  query           text,
  page            text,
  article_id      uuid references seo_articles(id) on delete set null,
  metrics         jsonb not null default '{}'::jsonb,   -- snapshot that triggered it
  recommendation  text not null,
  status          text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED')),
  agent_task_id   uuid references seo_agent_tasks(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_seo_opportunities_status on seo_opportunities (status, created_at desc);

-- ── Backlinks ────────────────────────────────────────────────────────────
create table if not exists seo_backlink_prospects (
  id                uuid primary key default gen_random_uuid(),
  website           text not null,
  url               text not null,
  topic             text,
  -- Scores are null until evaluated; never fabricated third-party metrics.
  relevance_score   smallint check (relevance_score between 0 and 100),
  quality_score     smallint check (quality_score between 0 and 100),
  spam_risk         text not null default 'DATA_UNAVAILABLE'
                      check (spam_risk in ('LOW', 'MEDIUM', 'HIGH', 'DATA_UNAVAILABLE')),
  opportunity_type  text not null default 'OTHER' check (opportunity_type in (
                      'GUEST_CONTRIBUTION', 'RESOURCE_PAGE', 'EDUCATION_DIRECTORY', 'TEACHER_RESOURCE',
                      'PARENTING_RESOURCE', 'EDUCATIONAL_COLLABORATION', 'EXPERT_CONTRIBUTION',
                      'BROKEN_LINK', 'OTHER')),
  contact_name      text,
  contact_email     text,
  contact_url       text,
  status            text not null default 'PROSPECT' check (status in (
                      'PROSPECT', 'CONTACTED', 'RESPONDED', 'ACCEPTED', 'PUBLISHED', 'ACTIVE', 'LOST', 'REJECTED')),
  evaluation        jsonb,
  notes             text,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists uq_seo_prospects_url on seo_backlink_prospects (lower(url));
create index if not exists idx_seo_prospects_status on seo_backlink_prospects (status);

create table if not exists seo_outreach_campaigns (
  id            uuid primary key default gen_random_uuid(),
  prospect_id   uuid not null references seo_backlink_prospects(id) on delete cascade,
  name          text not null,
  status        text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'CLOSED')),
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_seo_outreach_campaigns_prospect on seo_outreach_campaigns (prospect_id);

create table if not exists seo_outreach_messages (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references seo_outreach_campaigns(id) on delete cascade,
  subject         text not null,
  body            text not null,
  -- MVP never sends email; APPROVED only gates future sending.
  status          text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED', 'COPIED', 'SENT')),
  approved_by     uuid references profiles(id) on delete set null,
  approved_at     timestamptz,
  agent_task_id   uuid references seo_agent_tasks(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint seo_outreach_sent_requires_approval check (status <> 'SENT' or approved_at is not null)
);
create index if not exists idx_seo_outreach_messages_campaign on seo_outreach_messages (campaign_id);

create table if not exists seo_backlinks (
  id                  uuid primary key default gen_random_uuid(),
  prospect_id         uuid references seo_backlink_prospects(id) on delete set null,
  campaign_id         uuid references seo_outreach_campaigns(id) on delete set null,
  source_url          text not null,
  target_url          text not null,
  anchor_text         text,
  first_detected_at   timestamptz,
  last_checked_at     timestamptz,
  status              text not null default 'PROSPECT' check (status in (
                        'PROSPECT', 'CONTACTED', 'RESPONDED', 'ACCEPTED', 'PUBLISHED', 'ACTIVE', 'LOST', 'REJECTED')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_seo_backlinks_status on seo_backlinks (status);

-- ── Cron job locks (prevent overlapping runs) ────────────────────────────
create table if not exists seo_job_locks (
  job_name      text primary key,
  locked_until  timestamptz not null,
  locked_by     text,
  updated_at    timestamptz not null default now()
);

-- Atomically take a lock; returns false if another run still holds it.
create or replace function seo_try_acquire_lock(p_job text, p_ttl_seconds int, p_owner text)
returns boolean
language plpgsql
as $$
declare
  acquired boolean;
begin
  insert into seo_job_locks (job_name, locked_until, locked_by, updated_at)
  values (p_job, now() + make_interval(secs => p_ttl_seconds), p_owner, now())
  on conflict (job_name) do update
    set locked_until = excluded.locked_until, locked_by = excluded.locked_by, updated_at = now()
    where seo_job_locks.locked_until < now()
  returning true into acquired;
  return coalesce(acquired, false);
end;
$$;

create or replace function seo_release_lock(p_job text, p_owner text)
returns void
language sql
as $$
  delete from seo_job_locks where job_name = p_job and locked_by = p_owner;
$$;

revoke execute on function seo_try_acquire_lock(text, int, text) from public, anon, authenticated;
revoke execute on function seo_release_lock(text, text) from public, anon, authenticated;
grant execute on function seo_try_acquire_lock(text, int, text) to service_role;
grant execute on function seo_release_lock(text, text) to service_role;

-- ── updated_at triggers + RLS (admin-only) ───────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'seo_settings', 'seo_agent_tasks', 'seo_keywords', 'seo_keyword_clusters',
    'seo_content_opportunities', 'seo_content_plans', 'seo_articles', 'seo_article_links',
    'seo_article_ctas', 'seo_metrics', 'seo_opportunities', 'seo_backlink_prospects',
    'seo_outreach_campaigns', 'seo_outreach_messages', 'seo_backlinks', 'seo_job_locks'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on %1$I', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on %1$I for each row execute procedure update_updated_at()', t);
  end loop;

  foreach t in array array[
    'seo_settings', 'seo_agent_tasks', 'seo_ai_usage', 'seo_keywords', 'seo_keyword_clusters',
    'seo_keyword_cluster_members', 'seo_content_opportunities', 'seo_content_plans', 'seo_articles',
    'seo_article_versions', 'seo_article_links', 'seo_article_ctas', 'seo_metrics', 'seo_opportunities',
    'seo_backlink_prospects', 'seo_outreach_campaigns', 'seo_outreach_messages', 'seo_backlinks'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "platform admins manage %1$s" on %1$I', t);
    execute format(
      'create policy "platform admins manage %1$s" on %1$I for all to authenticated '
      'using (is_platform_admin()) with check (is_platform_admin())', t);
  end loop;
end $$;

-- Locks are service-role only: RLS on, no policies.
alter table seo_job_locks enable row level security;

-- Settings is a singleton: admins may update it but never insert/delete rows.
drop policy if exists "platform admins manage seo_settings" on seo_settings;
drop policy if exists "platform admins read seo_settings" on seo_settings;
drop policy if exists "platform admins update seo_settings" on seo_settings;
create policy "platform admins read seo_settings"   on seo_settings for select to authenticated using (is_platform_admin());
create policy "platform admins update seo_settings" on seo_settings for update to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

-- Version history is append-only from the UI.
drop policy if exists "platform admins manage seo_article_versions" on seo_article_versions;
drop policy if exists "platform admins read seo_article_versions" on seo_article_versions;
drop policy if exists "platform admins insert seo_article_versions" on seo_article_versions;
create policy "platform admins read seo_article_versions"   on seo_article_versions for select to authenticated using (is_platform_admin());
create policy "platform admins insert seo_article_versions" on seo_article_versions for insert to authenticated with check (is_platform_admin());
