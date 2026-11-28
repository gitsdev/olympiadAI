# Autopilot (daily automation)

One switch on the **SEO Agent dashboard** (Automation card → **Autopilot on/off**) turns on a daily run that goes from keyword to published blog post with no clicks. It is **off by default**.

## What one run does

The `daily-article` cron (`30 14 * * *` UTC ≈ 20:00 IST) calls `prepareTomorrowsArticle()` in `src/lib/seo-agent/cron/jobs.ts`:

1. **Sync keywords** from `/admin/seo` (`src/lib/admin/seo-data.ts` → `seo_keywords`, `source = 'ADMIN_SEO'`). Only new keywords are added. Existing rows are never overwritten, so edits, pauses and archives made in the SEO Agent stick. Deleting a synced keyword archives it instead, so the next sync doesn't bring it back.
2. **Pick a topic:** the oldest open new-article recommendation. If none is open, analyse up to 10 unclustered keywords (high priority first). That creates **clusters** and **content opportunities**.
3. **Plan** the article for tomorrow at the default publish time.
4. **Write** it.
5. **Cover image:** a branded 1200×630 PNG with the title, category, class and subject (`cover-image.tsx`, rendered with `next/og`, no AI and no cost). It is stored in the `blog-images` bucket and used as the post's hero and share image.
6. **SEO check** (deterministic checks plus AI review).
7. **Quality gate:** the strict auto-publish checklist runs (no critical SEO issues, no duplicates, valid links, image and meta). If everything passes, the article is **Scheduled** with `publish_authorization = AUTO_PUBLISH`, and the `publish-scheduled` cron (~10:00 IST) publishes it. If anything fails, it goes to **Review required** for you.

The autopilot uses strict auto-publish checks even when the global publishing mode in Settings is Manual approval. Articles you create or run by hand still follow the global mode.

AI link suggestions are skipped on autopilot runs, because suggestions need a person to accept them. The writer already links to real pages chosen by the planner, and the gate blocks an article with no internal links.

**Run now** on Agent Tasks runs the same autopilot steps when the autopilot is on. When it's off, Run now uses the main model and the global mode, as before. The scheduled run does nothing while the autopilot is off.

## Cost limit

- The autopilot runs on its own model: **Settings → Autopilot → model**, default `claude-haiku-5-5` ($0.10 / $0.50 per 1M tokens for prompts up to 100K tokens). Manual runs keep using the main model.
- **Daily budget**, default **$0.10**, at most $5. Before every AI call (retries included), `runAgentTask` checks spend recorded today (in your timezone) plus the call's worst case. The worst case is the prompt estimate ×1.5 plus the full output allowance. A call that could go over the budget is **not made**. The run stops with "Daily AI budget reached" and tries again the next day.
- **Fails closed:** a model with no price in Settings → AI pricing can't run on autopilot.
- Autopilot calls are tagged `seo_ai_usage.budget_scope = 'AUTOPILOT'`. The dashboard shows today's autopilot spend next to the budget.
- **Measured live (2026-11-28):** writing plus SEO review of a ~1,000-word article on Haiku 5.5 cost **$0.0048** and took 42 s, with SEO score 82/100 and no critical issues. A full day including planning and occasional keyword analysis is around $0.01. Even the guard's worst case for a whole day (four calls at full output allowance) is about $0.05.

## Turning it on

1. Run `supabase/migrations/026_seo_autopilot.sql` (after 013–017).
2. Deploy.
3. On the dashboard, click **Autopilot off** to switch it on. This also syncs the `/admin/seo` keywords straight away.

## Safety

- The switch is its own server action (`setAutopilotEnabled`), is audit-logged, and is never written by the Settings form. So saving an older Settings form can't flip it.
- The cron stays protected by `CRON_SECRET` and the job lock. Housekeeping and failure handling are as described in [cron.md](cron.md).
- No metrics are invented. Keyword volume and difficulty from `/admin/seo` are copied into the keyword's notes, labelled as estimates.

## Site SEO score (`/admin/seo`)

**Update score** runs an on-site audit (`src/lib/admin/site-audit*.ts`). It checks up to 45 pages from the live sitemap, plus up to 80 internal link targets they point to. Each page is scored in seven weighted categories:

- crawlability (status, noindex, canonical, robots.txt, sitemap, http→https)
- titles and meta descriptions
- page structure (h1, lang, viewport, thin pages)
- internal and broken links
- image alt text
- social and structured data (og tags, JSON-LD)
- server response time

The result is saved in `seo_site_audits` with a "what to fix" list. The audit refuses to run while maintenance mode is on.

This score measures our own pages. It is **not domain authority**, so it isn't comparable to the competitor columns, which stay labelled as hand estimates. Authority data needs a paid API: Open PageRank's free key only works from one fixed IP address, which Vercel doesn't have. First live run (2026-11-28): **88/100**. The main gaps were a missing `og:image` on 44 of 45 pages, and response times over 1.5 s on about half of them.
