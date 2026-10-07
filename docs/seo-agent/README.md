# OlympiadIQ SEO Agent

An admin-only section at **`/admin/seo-agent`** that automates the SEO content loop:

```
keyword → AI analysis → content plan → AI article → SEO check → human review
        → approve → schedule → auto-publish → Search Console → recommendations
```

It lives inside the main OlympiadIQ Next.js app, shares its Supabase project and admin login, and will publish into the existing blog (`blog_posts`, served at `/blog/[slug]`). It is separate from the older `/admin/seo` page, which still shows hand-curated keyword and competitor estimates.

## Build status

The MVP is built in phases (spec §47). A phase is marked done only after type check, lint, tests and build pass.

| Phase | Scope | Status |
|---|---|---|
| 1 | Setup, auth, database, admin dashboard, settings | ✅ Done |
| 2 | Keyword management, keyword analysis agent, clusters, AI provider layer, agent task log | Not started |
| 3 | Content opportunities, content calendar | Not started |
| 4 | Article generation, TipTap editor, versioning | Not started |
| 5 | SEO analysis, internal links, CTA system | Not started |
| 6 | Approval, scheduling, publishing adapter | Not started |
| 7 | Vercel Cron (tomorrow's article, scheduled publishing) | Not started |
| 8 | Google Search Console sync | Not started |
| 9 | SEO performance and opportunity engine, weekly report | Not started |
| 10 | Backlink opportunities, outreach drafts, tracker | Not started |

Sidebar items for unfinished phases are shown with a "Soon" label and are not links.

## Setup

1. **Apply the migration.** Open the Supabase SQL editor and run [`supabase/migrations/013_seo_agent.sql`](../../supabase/migrations/013_seo_agent.sql). It only adds tables and is safe to re-run. Until it has been run, the SEO Agent pages show a "database not set up" notice.
2. **Make sure you are a platform admin.** This uses the same check as the rest of `/admin`:
   ```sql
   update profiles set role = 'platform_admin' where email = '<you>';
   ```
3. **Set environment variables** (see [deployment.md](deployment.md)).
4. Open `/admin/seo-agent`. You can also reach it from **SEO Agent** in the main admin sidebar.

## Local development

```bash
npm install
npm run dev          # http://localhost:3000/admin/seo-agent
npm test             # Vitest unit tests, plus migration/RLS tests on in-memory Postgres
npm run typecheck
npm run lint
```

## Docs

- [architecture.md](architecture.md): folder layout, data access and security model, integration decisions
- [database.md](database.md): tables, relationships, constraints and RLS
- [deployment.md](deployment.md): environment variables and the Vercel/Supabase setup

`agents.md`, `cron.md`, `publishing.md` and `search-console.md` will be added in the phases that build those features.
