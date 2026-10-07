# Scheduled jobs (Phase 7)

Two Vercel Cron jobs, defined in [`vercel.json`](../../vercel.json). No n8n or other automation service is involved.

| Job | Route | Schedule (UTC) | In IST | What it does |
|---|---|---|---|---|
| Scheduled publishing | `GET /api/cron/publish-scheduled` | `30 4 * * *` | ~10:00 | Publishes every `SCHEDULED` article whose time has come (up to 10 per run) through the normal publisher, which re-runs every check. |
| Tomorrow's article | `GET /api/cron/daily-article` | `30 14 * * *` | ~20:00 | Prepares tomorrow's article (below), then runs scheduled publishing again. |

Both are also on **SEO Agent → Agent Tasks** as **Prepare tomorrow's article now** and **Publish due articles now** (same code, recorded as run by you).

## Vercel plan limits (checked 2026-10-08)

- **Hobby:** a cron may run **at most once a day**, and Vercel only guarantees the hour (a `30 4` job runs between 04:30 and 05:29 UTC). A more frequent expression **fails the deployment**, so `vercel.json` ships with daily schedules only. In practice an article scheduled for 10:00 IST is published between 10:00 and ~11:00 IST, or in the ~20:00 run. Anything scheduled for later in the day waits for the 20:00 run (or the next morning).
- **Pro:** crons can run every minute, on time. For exact publish times change the publishing cron to `*/5 * * * *` (every 5 minutes) and update `CRON_UTC` in `src/app/admin/seo-agent/agent-tasks/page.tsx`. A test keeps the two in sync.
- **Duration:** 300 s per function on every plan. The daily job takes ~2–3 minutes (plan ~25 s, write ~75 s, SEO check ~35 s, links ~3 s). It skips the SEO check after 190 s and link suggestions after 240 s rather than risk being cut off; you can run both from the editor.

## Security

- Every cron route requires `Authorization: Bearer $CRON_SECRET`. When `CRON_SECRET` is set in the project, Vercel adds this header automatically. The check is constant-time and **fails closed**: if `CRON_SECRET` is missing or shorter than 16 characters, every call gets 401.
- Routes use the service-role key server-side only. Unauthorised requests are rejected before any database access (tested by calling the real route handlers).
- **No overlapping runs:** each job takes a database lock (`seo_try_acquire_lock`). A second run while one is active returns "already running". Each publish also has its own per-article lock.

## Tomorrow's article (spec §20)

`prepareTomorrowsArticle()` in `src/lib/seo-agent/cron/jobs.ts`:

1. **Run day?** `Settings → Article generation`: Daily, Weekly (Mondays in your timezone), or Off.
2. **Already prepared?** If tomorrow (in your timezone) already has an article or a plan past the Idea/Planned stage, stop. Running it twice never makes two articles.
3. **Pick the topic:**
   - tomorrow's existing Idea/Planned plan, if there is one
   - otherwise, if `Content planning` isn't Off, the oldest open `NEW_ARTICLE` recommendation with no or low cannibalisation risk, planned for tomorrow at your default publish time
   - if there are no recommendations, it first analyses up to 10 active, unclustered keywords (high priority first, then oldest)
   - if there's nothing to work with, it stops and says "add keywords"
4. **Write** the article (Content Writer).
5. **Review:** SEO check, then internal link suggestions.
6. **Quality gate and next status:**
   - **Manual approval** (default): the article goes to **Review** and waits for you. It is never published without your approval.
   - **Auto-publish:** the full publishing checklist runs in strict mode (a fresh SEO check with no must-fix items, no duplicates, valid links and image…). If everything passes, the article is **Scheduled** for tomorrow at the default time with `publish_authorization = AUTO_PUBLISH`. Otherwise it goes to **Review required** with the reasons.
7. **Logging:** a `DailyArticle · prepare_tomorrow` task records the steps, and each AI step logs its own task with tokens and cost. "Nothing to do" outcomes are logged as completed with the reason. Real failures are logged as FAILED, and plans and articles are put back where they were.

## Failure handling

- Jobs never throw out of the route. Failures are logged (`seo-agent` JSON logs plus a FAILED agent task) and the route still returns 200, so the next scheduled run carries on normally.
- **Housekeeping** before every job: tasks stuck in RUNNING for over 20 minutes are marked FAILED ("timed out or crashed"), and plans or articles stuck in GENERATING for over 15 minutes are released so they can be retried.
- If publishing fails validation, nothing is published and the article moves to **Review required** (see [publishing.md](publishing.md)).

## Testing a run

Use **Agent Tasks → Prepare tomorrow's article now**. Or call a route with the secret:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://www.olympiadiq.in/api/cron/publish-scheduled
```

Each run writes real data (plans, articles, published posts) and spends AI credit.
