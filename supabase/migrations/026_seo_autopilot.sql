-- OlympiadIQ SEO Agent — Autopilot, keyword sync and site audit.
-- Run after 013–017. Safe to re-run. Independent of 018–025.

-- ── Autopilot settings ───────────────────────────────────────────────────
-- Off by default: the admin switches it on from the SEO Agent dashboard.
alter table seo_settings add column if not exists automation_enabled boolean not null default false;
-- The model the daily autopilot uses (manual runs keep using ai_model).
alter table seo_settings add column if not exists automation_model text not null default 'claude-haiku-5-5';
-- Hard daily cap on autopilot AI spend, in USD.
alter table seo_settings add column if not exists automation_daily_budget_usd numeric(8, 4) not null default 0.10;

alter table seo_settings drop constraint if exists seo_settings_automation_budget_range;
alter table seo_settings add constraint seo_settings_automation_budget_range
  check (automation_daily_budget_usd > 0 and automation_daily_budget_usd <= 5);

-- Anthropic's published price for Claude Haiku 5.5 (USD per 1M tokens, prompts
-- up to 100K tokens; as of Nov 2026), only if not priced yet. The budget guard
-- refuses to run a model with no price.
update seo_settings
set ai_pricing = ai_pricing || '{"claude-haiku-5-5": {"input": 0.1, "output": 0.5}}'::jsonb
where not ai_pricing ? 'claude-haiku-5-5';

-- Which spend counts toward the autopilot's daily budget.
alter table seo_ai_usage add column if not exists budget_scope text;
alter table seo_ai_usage drop constraint if exists seo_ai_usage_budget_scope_check;
alter table seo_ai_usage add constraint seo_ai_usage_budget_scope_check
  check (budget_scope is null or budget_scope in ('AUTOPILOT'));
create index if not exists idx_seo_ai_usage_scope_created on seo_ai_usage (budget_scope, created_at desc);

-- ── Keywords synced from /admin/seo ──────────────────────────────────────
alter table seo_keywords add column if not exists source text not null default 'MANUAL';
alter table seo_keywords drop constraint if exists seo_keywords_source_check;
alter table seo_keywords add constraint seo_keywords_source_check check (source in ('MANUAL', 'ADMIN_SEO'));

-- ── On-site SEO audits (the "Your SEO score" on /admin/seo) ──────────────
create table if not exists seo_site_audits (
  id             uuid primary key default gen_random_uuid(),
  site_url       text not null,
  score          smallint not null check (score between 0 and 100),
  pages_checked  integer not null default 0,
  -- { categories: [{ id, label, score, weight }], issues: [...], pages: [...] }
  result         jsonb not null default '{}'::jsonb,
  duration_ms    integer,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_seo_site_audits_created on seo_site_audits (created_at desc);

alter table seo_site_audits enable row level security;
drop policy if exists "platform admins manage seo_site_audits" on seo_site_audits;
create policy "platform admins manage seo_site_audits" on seo_site_audits
  for all to authenticated using (is_platform_admin()) with check (is_platform_admin());
