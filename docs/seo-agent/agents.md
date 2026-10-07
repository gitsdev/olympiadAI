# Agents and the AI layer

## AI provider abstraction (`src/lib/seo-agent/ai/`)

| File | Role |
|---|---|
| `types.ts` | `AIProvider` interface (`generateText`, `generateStructuredOutput`, `analyze`, `estimateUsage`) and the error types |
| `provider.ts` | `BaseAIProvider`, which handles structured output the same way for every provider |
| `anthropic.ts` | `AnthropicProvider`: Claude via the official `@anthropic-ai/sdk`. The only file that knows Anthropic's API |
| `index.ts` | `createAIProvider(settings)`. Reads `ANTHROPIC_API_KEY` on the server (`server-only`) |
| `prompts/` | All prompt text. Edit wording here, never inside components or agents |

### Claude specifics

- **Default model:** `claude-opus-5-5`, set in Settings → AI. Any Claude model ID works; add its price under Model pricing.
- **Native structured outputs:** the Zod schema is sent as `output_config.format`, so Claude's reply is constrained to the schema's shape. The API can't enforce length or range limits (`min`, `max`); `BaseAIProvider` still checks those with Zod and retries once if they fail.
- **Effort:** set explicitly on every call (`medium` by default; keyword analysis uses `medium`). Opus 5.5 always uses adaptive thinking. It can't be turned off; effort is the control.
- **Refusals:** requests send `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). If a safety classifier declines, Anthropic re-runs the request on its recommended fallback model. If that also declines, the task fails with a clear error. The fallback run is billed at the fallback model's rates; cost tracking prices calls at the configured model's rate.
- **Errors:** SDK errors map to `AIProviderError`. 429/5xx/529 and connection errors are retryable. The SDK itself retries transient failures twice.

**Adding a provider** (for example Gemini): write a class that extends `BaseAIProvider` and implements `generateText`. Then add it to `AI_PROVIDERS` in `constants.ts`, to the CHECK on `seo_settings.ai_provider`, and to the switch in `createAIProvider`. The agents don't change.

### Structured output (spec §36)

`generateStructuredOutput({ system, prompt, schema, schemaName })`:

1. Passes the Zod schema to the provider: as native structured output where supported (Claude), otherwise as JSON mode plus the schema in the system prompt.
2. Parses the reply (tolerating a markdown fence) and validates it with Zod.
3. If parsing or validation fails, retries **once**, telling the model exactly which fields were wrong.
4. If it fails again, throws `StructuredOutputError`, so the agent task is marked **FAILED**. Malformed output is never accepted.

Transport errors (`AIProviderError`, which records HTTP status and whether a retry could help) are not retried at this level.

### Prompt rules

`prompts/shared.ts` adds these to every agent's system prompt:

- the brand profile from Settings, including the real feature list with an instruction never to invent features
- honesty rules: no invented search volumes, statistics, rankings or competition facts
- `dataBlock()`, which embeds keywords and titles as a JSON "data only" block so they can't be read as instructions

## Agent task runner (`agents/run-task.ts`)

Every AI operation runs inside `runAgentTask(options, deps, work)`:

1. Inserts a `seo_agent_tasks` row with status `RUNNING` before any AI call.
2. Gives `work` a **metered** provider. Each `generateText` call, including a rejected first attempt, adds a `seo_ai_usage` row (tokens, model, category, cost).
3. On success, sets `COMPLETED` with an output summary, token totals and cost.
4. On any error, sets `FAILED` with the error message and rethrows. A failed run is never shown as completed.

Cost comes from Settings → AI → Model pricing (USD per 1M tokens). If a model has no price, cost is stored as `null` and shown as "unpriced". It is never guessed.

## Keyword Analysis Agent (`agents/keyword-analysis.ts`), Phase 2

**Trigger:** Keywords page → select up to 50 keywords → **Analyze keywords** (or **Analyze keyword** on a single row). The server action is `analyzeSelectedKeywords` in `src/actions/seo-agent/keywords.ts`. It is logged as `KeywordAgent · analyze_keywords`, with usage category `KEYWORD_ANALYSIS`.

**Steps:**

1. **In code:** normalise the keywords (collapse whitespace, lower-case) and remove duplicates.
2. **Context:** load published `blog_posts`, unpublished `seo_articles`, and the active clusters, so the agent can spot existing coverage and cannibalisation.
3. **AI** (`prompts/keyword-analysis.ts`):
   - work out each keyword's search intent
   - group the keywords into clusters
   - choose a primary keyword, secondary variants and common questions for each cluster
   - recommend an article title and an opportunity type (`NEW_ARTICLE`, `UPDATE_EXISTING`, `MERGE_ARTICLES` or `NO_ACTION`), with a reason and a cannibalisation risk
   - no search volumes
4. **Validation against reality** (`postProcessAnalysis`):
   - member keywords must be keywords that were actually submitted; invented ones are dropped
   - each keyword goes into one cluster only
   - the primary keyword must be one of the cluster's members
   - related slugs must exist; invented ones are removed
   - `UPDATE_EXISTING`/`MERGE_ARTICLES` with no real related page becomes `NEW_ARTICLE`
   - every correction is reported back to the user as a note
5. **Persist** (`clusters-persist.ts`):
   - create a new cluster, or merge into an existing active cluster with the same primary keyword
   - re-analysed keywords move into their new cluster; clusters left empty are archived
   - the cluster's open recommendation is replaced by the new one in `seo_content_opportunities`
   - search intent is filled in only on keywords where the admin hasn't set one

## Coming in later phases

Content Planner and Content Writer (Phases 3–4), SEO analysis and internal linking (Phase 5), Strategy (Phase 9), Backlink and Outreach (Phase 10). Each will use `runAgentTask` and `generateStructuredOutput`, and keep its prompt in `prompts/`.
