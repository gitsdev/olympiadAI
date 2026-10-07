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
| 2 | Keyword management, keyword analysis agent, clusters, AI provider layer, agent task log, AI usage | ✅ Done |
| 3 | Content opportunities, Content Planner Agent, content calendar | ✅ Done |
| 4 | Content Writer Agent, TipTap article editor, autosave, versioning (view / compare / restore) | ✅ Done |
| 5 | SEO Agent (internal score + fact check), Internal Linking Agent, CTA system, search/mobile preview | ✅ Done |
| 6 | Approval, scheduling, publishing adapter | Not started |
| 7 | Vercel Cron (tomorrow's article, scheduled publishing) | Not started |
| 8 | Google Search Console sync | Not started |
| 9 | SEO performance and opportunity engine, weekly report | Not started |
| 10 | Backlink opportunities, outreach drafts, tracker | Not started |

Sidebar items for unfinished phases are shown with a "Soon" label and are not links.

## Setup

1. **Apply the migrations, in order.** Open the Supabase SQL editor and run [`013_seo_agent.sql`](../../supabase/migrations/013_seo_agent.sql), then [`014_seo_keywords_overview.sql`](../../supabase/migrations/014_seo_keywords_overview.sql), then [`015_seo_agent_claude.sql`](../../supabase/migrations/015_seo_agent_claude.sql). All are additive and are safe to re-run. Until 013 has been run, the SEO Agent pages show a "database not set up" notice.
2. **Make sure you are a platform admin.** This uses the same check as the rest of `/admin`:
   ```sql
   update profiles set role = 'platform_admin' where email = '<you>';
   ```
3. **Set environment variables** (see [deployment.md](deployment.md)). Keyword analysis needs `ANTHROPIC_API_KEY` (the SEO Agent runs on Claude).
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
- [agents.md](agents.md): the AI provider layer, structured output, task logging and the Keyword Analysis Agent
- [deployment.md](deployment.md): environment variables and the Vercel/Supabase setup

`cron.md`, `publishing.md` and `search-console.md` will be added in the phases that build those features.

## Using it

1. **Keywords:** add keywords one at a time, or **Import** a list (one per line, or a CSV with a `keyword` header). Search and filter by status, priority, class, subject, and whether a keyword is clustered.
2. Select keywords and click **Analyze keywords**. The Keyword Agent groups them into clusters and recommends an article for each, checking it against existing blog posts.
3. **Keyword Clusters:** review each cluster's primary keyword, variants, common questions, recommended title, and the reason for the recommendation. Archive clusters you don't want.
4. **Content Opportunities:** every recommendation with its reason and cannibalisation risk. For `NEW_ARTICLE`, click **Create content plan**: the Content Planner Agent drafts a title, outline, CTA, internal links (real pages only) and things to fact-check, and schedules it on the next free day at your default publishing time. You can also start a plan from a cluster card. `UPDATE_EXISTING`/`MERGE_ARTICLES` are handled by editing the post in **Blog** for now.
5. **Content Calendar:** a month view in your timezone. Drag a plan to another day to reschedule it (it keeps its time). Click a plan to edit any field, reorder the outline, or change links and CTA. **New plan** creates one by hand. Ideas without a date are listed on the right. Plans become read-only once their article is being written (Phase 4+).
6. **Articles:** open a plan and click **Generate article** (1–3 minutes). The Content Writer drafts the full article and you land in the editor.
   - **Editor:** H1–H3, bold, italic, lists, tables, links, images, quotes, rules and **CTA blocks** (a card you can switch between Mock Tests, AI Tutor, Battle and Brain Booster). **Preview** shows it as readers will see it.
   - **Saving:** autosave every 30 s while you type. **Save draft** saves and creates a version if anything changed since the last one. **Save version** always creates one.
   - **Sidebar:** URL slug, meta title and description with length guidance, excerpt, blog category, featured image URL and alt text, the AI image prompt, and **Check before publishing** (every claim the writer said needs verifying, plus any links it removed).
   - **Versions:** every AI generation, manual edit and restore, with who and when. **View** any version, **Compare** two (word-level diff plus changed fields), or **Restore** one (saved as a new version; nothing is lost).
   - **Regenerate** rewrites the article from its plan; the old text stays in history.
   - **SEO check** (button or sidebar): a 0–100 internal content-quality score (not a Google ranking) across 12 areas, with a breakdown, prioritised recommendations, a fact check of claims that need verifying, a CTA recommendation (**Use this CTA** switches every CTA block), and a "Must fix before publishing" list. Unsaved edits are saved first, and the score is flagged as out of date when the article changes afterwards.
   - **Internal link suggestions:** the Internal Linking Agent proposes links to real OlympiadIQ pages using phrases already in the text. **Apply** links the phrase in place; **Dismiss** hides it for good.
   - **Preview** now shows a Google-style search result and a desktop/mobile toggle, with CTA blocks rendered as the real cards.
   - Approval and scheduling (Phase 6) are visible but not active yet.
7. **Agent Tasks:** shows every run, with input, output or error, tokens, cost and duration. **AI Usage:** shows cost for today and this month, broken down by area, by model and by day.
