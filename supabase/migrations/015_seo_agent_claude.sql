-- OlympiadIQ SEO Agent — switch the AI provider from OpenAI to Anthropic (Claude).
-- Run after 013 and 014. Safe to re-run.

alter table seo_settings drop constraint if exists seo_settings_ai_provider_check;

-- Move the existing row off OpenAI before the new constraint is added.
update seo_settings
set ai_provider = 'anthropic',
    ai_model = 'claude-opus-5-5'
where ai_provider = 'openai';

alter table seo_settings
  add constraint seo_settings_ai_provider_check check (ai_provider in ('anthropic'));

alter table seo_settings alter column ai_provider set default 'anthropic';
alter table seo_settings alter column ai_model set default 'claude-opus-5-5';

-- Seed Anthropic's published price for the default model (USD per 1M tokens,
-- as of Sept 2026) only if the admin hasn't priced it yet. Editable in Settings.
update seo_settings
set ai_pricing = ai_pricing || '{"claude-opus-5-5": {"input": 4, "output": 20}}'::jsonb
where not ai_pricing ? 'claude-opus-5-5';
