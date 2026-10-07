# Database

Migration: [`supabase/migrations/013_seo_agent.sql`](../../supabase/migrations/013_seo_agent.sql). It only adds objects and is safe to re-run (a test applies it twice).

## Tables

| Table | Purpose |
|---|---|
| `seo_settings` | Single-row config: AI provider, model and pricing; publishing mode; default time and timezone; job frequencies; default category and CTA; Search Console property; blog base URL; brand profile (jsonb) |
| `seo_keywords` | Target keywords. `keyword_normalized` (generated: lower-case, collapsed spaces) is unique, so "Maths  Olympiad" and "maths olympiad" count as duplicates |
| `seo_keyword_clusters` | Groups from the AI analysis: primary keyword, AI-suggested secondary and question variants (`text[]`), recommended title |
| `seo_keyword_cluster_members` | keyword ↔ cluster, with role `PRIMARY` / `SECONDARY` / `QUESTION` |
| `seo_content_opportunities` | `NEW_ARTICLE` / `UPDATE_EXISTING` / `MERGE_ARTICLES` / `NO_ACTION`, with a required `reason` and cannibalization risk |
| `seo_content_plans` | Calendar entries: outline, CTA, suggested links, `planned_publish_at`, status `IDEA`…`ARCHIVED` |
| `seo_articles` | Working article: TipTap HTML and JSON, SEO metadata, internal content score and analysis, approval, schedule, and the `blog_post_id` / `published_url` once published |
| `seo_article_versions` | Version history (`AI_GENERATED` / `MANUAL_EDIT` / `RESTORE`). Append-only from the UI |
| `seo_article_links` | Suggested and accepted internal links (anchor text, reason) |
| `seo_article_ctas` | CTA choice per article (`MOCK_TEST`, `AI_TUTOR`, `BATTLE`, `BRAIN_BOOSTER`), set by AI or by hand |
| `seo_metrics` | Daily Search Console rows, unique on (date, query, page) |
| `seo_opportunities` | Recommendations from Search Console data (low CTR, positions 5–20, declining pages, …) |
| `seo_backlink_prospects` | Backlink opportunities. Scores stay null until evaluated, and `spam_risk` defaults to `DATA_UNAVAILABLE` |
| `seo_outreach_campaigns`, `seo_outreach_messages` | AI-drafted outreach. The MVP only copies messages, never sends them |
| `seo_backlinks` | Backlink tracker (source, target, anchor, first and last checked, status) |
| `seo_agent_tasks` | Log of every AI or agent operation: status, summaries, error, model, tokens, cost |
| `seo_ai_usage` | One row per AI call, with category for the cost breakdown. `estimated_cost` is null when pricing isn't configured |
| `seo_job_locks` | Cron overlap prevention (service role only) |

`profiles` (existing) is used for `created_by`, `approved_by` and `updated_by`. `blog_posts` (existing) is referenced by `seo_articles.blog_post_id`, `seo_article_links.target_blog_post_id` and `seo_metrics.blog_post_id`.

## Relationships

```
seo_keywords ─< seo_keyword_cluster_members >─ seo_keyword_clusters
seo_keyword_clusters ─< seo_content_opportunities
seo_keyword_clusters ─< seo_content_plans >─ seo_content_opportunities
seo_content_plans ─< seo_articles ─┬─< seo_article_versions
                                   ├─< seo_article_links
                                   ├─< seo_article_ctas
                                   ├─< seo_metrics
                                   └── blog_posts (once published)
seo_backlink_prospects ─< seo_outreach_campaigns ─< seo_outreach_messages
seo_backlink_prospects ─< seo_backlinks
seo_agent_tasks ─< seo_ai_usage, and referenced by clusters, opportunities, versions, messages
```

## Integrity rules enforced in SQL

- **Approval:** `APPROVED`/`SCHEDULED`/`PUBLISHED` articles must have either `publish_authorization = 'MANUAL_APPROVAL'` with `approved_by` and `approved_at`, or `publish_authorization = 'AUTO_PUBLISH'`. A NULL authorization is rejected.
- `SCHEDULED` requires `scheduled_for`. `PUBLISHED` requires `published_at`.
- Slugs are unique among non-archived articles.
- Agent tasks in `COMPLETED`/`FAILED` must have `completed_at`.
- Outreach messages can't be `SENT` without `approved_at`.

## RLS

- `is_platform_admin()` (security definer) checks that `profiles.role = 'platform_admin'` for `auth.uid()`.
- Every `seo_*` table has RLS enabled, with one policy: authenticated platform admins get full access.
- Exceptions: `seo_settings` can be read and updated but not inserted into or deleted (it's a single row). `seo_article_versions` can be read and inserted but not edited (history). `seo_job_locks` has no policies, so only the service role can use it.
- The service role (cron and publishing) bypasses RLS by design. Use it only in server routes that check their own secret.

`tests/seo-agent/migration.test.ts` checks all of the above against a real Postgres (PGlite).
