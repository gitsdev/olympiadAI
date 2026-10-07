# Deployment and configuration

## Environment variables

Every variable below is **server-only**. Never give any of them a `NEXT_PUBLIC_` prefix.

| Variable | Needed from | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Phase 1 (already set) | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Phase 6/7 (already set) | Cron and publishing pipeline, which have no user session |
| `ANTHROPIC_API_KEY` | Phase 2 (**required now**) | Claude, the SEO Agent's AI provider. Without it, Analyze fails with a clear error and no task is logged. Create one at https://platform.claude.com → API keys |
| `CRON_SECRET` | Phase 7 | Vercel Cron sends `Authorization: Bearer $CRON_SECRET` to `/api/cron/*` |
| `BLOG_API_SECRET` | Phase 6 (only if you call the publish API from outside the app) | Protects `POST /api/content/publish`; at least 16 characters, or the API rejects every call |
| Google Search Console credentials | Phase 8 | Documented in `search-console.md` once that phase is built |

Generate secrets with `openssl rand -hex 32`. Add them under Vercel → Project → Settings → Environment Variables, and in `.env.local` for local work. **Settings → Server secrets** in the SEO Agent shows whether each one is set, without revealing the value.

## Supabase

1. Run `supabase/migrations/013_seo_agent.sql`, then `014_seo_keywords_overview.sql`, `015_seo_agent_claude.sql` and `016_seo_agent_images.sql`, in the SQL editor.
2. Make sure your account is a platform admin: `update profiles set role = 'platform_admin' where email = '<you>';`
3. Open `/admin/seo-agent/settings` and check the defaults:
   - timezone Asia/Kolkata
   - manual approval
   - publish time 10:00
   - planning, generation and Search Console sync daily; backlink checks weekly
4. Pricing for the default `claude-opus-5-5` ($4 / $20 per 1M tokens) is pre-filled. If you switch models, add that model's price under **AI → Model pricing**, otherwise its costs show as unpriced.

## Vercel

Deploy as usual. Phase 7 will add the cron schedules to `vercel.json`.

Keyword analysis runs in a server action on `/admin/seo-agent/keywords`, which sets `maxDuration = 120`. Large batches (up to 50 keywords) can take a minute.
