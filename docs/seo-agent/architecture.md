# Architecture

## Where things live

The SEO Agent follows the existing app's conventions (`src/`, App Router, `@/` alias, server actions in `src/actions/`). It does not use the generic `app/admin/...` layout from the spec.

```
src/
  app/admin/seo-agent/            routes (all behind requireAdmin())
    page.tsx                      → redirects to /dashboard
    dashboard/page.tsx            overview + Tomorrow's article
    settings/                     settings page + client form
  actions/seo-agent/              server actions (mutations)
    settings.ts
  components/seo-agent/           section UI
    SeoAgentShell.tsx             layout: own sidebar + shared AdminTopBar
    SeoAgentSidebar.tsx, nav.ts   navigation (phase-gated "Soon" items)
    StatusBadge, TomorrowArticleCard, AgentActivityList, SchemaMissingNotice
  lib/seo-agent/
    constants.ts                  status enums, mirroring the SQL CHECKs (a test enforces this)
    settings-schema.ts            Zod schema, defaults, row mapping, estimateCost()   [client-safe]
    datetime.ts                   UTC ↔ Asia/Kolkata helpers using Intl, no tz library [client-safe]
    usage.ts                      AI cost aggregation                                  [client-safe]
    logger.ts                     structured JSON logs that redact secret-looking keys
    db.ts                         RLS client + schema-missing detection
    settings-data.ts              server reads of settings, and which secrets are set
    dashboard-data.ts             dashboard queries
supabase/migrations/013_seo_agent.sql
tests/seo-agent/                  Vitest
docs/seo-agent/
```

Phase 2 added `ai/` (provider abstraction and prompts), `agents/` (task runner and Keyword Analysis Agent), `keywords*.ts`, `clusters-*.ts` and `tasks-data.ts`. See [agents.md](agents.md). Later phases will add `publishing/`, `search-console/` and `src/app/api/{cron,content}/...`.

Server-only modules (anything that reads secrets or uses the DB clients) start with `import "server-only"`, so the build fails if they are ever imported into client code.

## Security model

| Caller | Auth | DB client | Enforced by |
|---|---|---|---|
| Admin pages and server actions | Supabase session cookie | `seoDb()`: anon key and the user's JWT | `requireAdmin()` **and** RLS (`is_platform_admin()`) |
| Cron routes (Phase 7) | `Authorization: Bearer $CRON_SECRET` | service role | secret check + job lock |
| `POST /api/content/publish` (Phase 6) | `BLOG_API_SECRET` | service role | secret check + validation |

- Admin UI code deliberately uses the session client, not the service-role key. That way RLS is a second, independent check. The rest of the existing admin uses the service role behind `requireAdmin()`.
- Secrets (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `BLOG_API_SECRET`) are only read in server code. The Settings page sends the browser a configured/missing flag for each one, never the value.
- All server-action input is validated with Zod (`seoSettingsSchema` so far).
- Logs go through `seoLog`, which redacts any key that looks like a credential.

## Key decisions

- **Publishing target: the existing blog.** OlympiadIQ's blog is in this same app, in the `blog_posts` table (Markdown content, `savePost` in `src/actions/blog.ts`), and has no HTTP publishing API. Phase 6 will add a publishing adapter that writes into `blog_posts`, behind the spec's `POST /api/content/publish` contract. It will reuse the blog's slug and reserved-slug rules. The blog will not be redesigned and no second blog will be created. Editor HTML (TipTap) will be converted to sanitized Markdown at publish time, because the blog renders Markdown.
- **Separate tables, `seo_` prefix.** The spec's table names (`settings`, `articles`, …) are too generic for a shared database. `profiles` is reused rather than duplicated.
- **Status enums as `text + CHECK`**, not Postgres enums, so later phases can add a value without `ALTER TYPE` problems.
- **Database-level guarantees** back up the application logic:
  - `seo_articles_requires_approval`: an article can't be `APPROVED`/`SCHEDULED`/`PUBLISHED` without either a human approval record (`approved_by`/`approved_at`) or `publish_authorization = 'AUTO_PUBLISH'`.
  - A task can't be `COMPLETED` without `completed_at`, so there are no misleading "completed" tasks.
  - Outreach can't be `SENT` without approval. Sending isn't built at all in the MVP.
  - `seo_try_acquire_lock()` stops overlapping cron runs.
- **No guessed numbers.** AI cost is `null` ("unknown") until the admin enters model pricing in Settings. The content score is labelled as internal, not a Google metric.
- **Timezone:** timestamps are stored as UTC `timestamptz` and shown in `seo_settings.timezone` (default `Asia/Kolkata`) via `lib/seo-agent/datetime.ts`.
- **AI provider:** the spec asks for OpenAI first, behind a provider interface (Phase 2). The rest of the app uses Gemini and Groq. The SEO Agent's provider will be separate and swappable.
