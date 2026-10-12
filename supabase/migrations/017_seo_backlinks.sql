-- OlympiadIQ SEO Agent — Backlinks (spec §26–29).
-- Run after 013–016. Safe to re-run.

-- Result of the latest link check: { found, anchorText, rel, httpStatus, error, checkedUrl }.
alter table seo_backlinks add column if not exists last_check jsonb;

-- One tracker row per source page → target page.
create unique index if not exists uq_seo_backlinks_source_target
  on seo_backlinks (lower(source_url), lower(target_url));

-- Only real web URLs.
alter table seo_backlinks drop constraint if exists seo_backlinks_urls_http;
alter table seo_backlinks add constraint seo_backlinks_urls_http
  check (source_url ~* '^https?://' and target_url ~* '^https?://');
alter table seo_backlink_prospects drop constraint if exists seo_backlink_prospects_url_http;
alter table seo_backlink_prospects add constraint seo_backlink_prospects_url_http
  check (url ~* '^https?://');

-- An outreach message can't be approved, copied or sent without an approval record.
alter table seo_outreach_messages drop constraint if exists seo_outreach_sent_requires_approval;
alter table seo_outreach_messages drop constraint if exists seo_outreach_requires_approval;
alter table seo_outreach_messages add constraint seo_outreach_requires_approval
  check (status = 'DRAFT' or (approved_at is not null and approved_by is not null));

create index if not exists idx_seo_backlinks_last_checked on seo_backlinks (last_checked_at nulls first);
