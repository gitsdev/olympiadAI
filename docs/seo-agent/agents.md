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

## Content Planner Agent (`agents/content-planner.ts`), Phase 3

**Trigger:** **Create content plan** on a `NEW_ARTICLE` opportunity (Content Opportunities page or cluster card). Server action `createPlanFromOpportunity` in `src/actions/seo-agent/content.ts`. Logged as `ContentPlanner · create_content_plan`, usage category `CONTENT`.

**Input** (`content-data.ts → getPlanningContext`): the cluster (keywords, questions, intent, recommended title), the most common target class and subject of its keywords, the recommendation's reason, and **link candidates**: published blog posts, topic pages for that class/subject, and the public feature pages in `site-pages.ts`.

**AI** (`prompts/content-planning.ts`): title, content type, audience, up to 8 secondary keywords, a 4–9 section H2 outline with points, one CTA with a reason, up to 6 internal links chosen from the candidates, and fact-check notes. Prompt rules: people first, no filler, FAQ only if useful, never invent facts.

**Validation** (`postProcessPlan`): links must exactly match a candidate URL (absolute olympiadiq.in URLs are normalised; anything else is dropped and reported). Duplicate links and secondary keywords are removed. The CTA reason and fact-check notes go into the plan's notes.

**Saved as:** a `PLANNED` row in `seo_content_plans`, dated on the next day (in the configured timezone, from tomorrow) with no active plan, at the default publishing time. The opportunity becomes `ACCEPTED`. Deleting the plan puts the opportunity back to `OPEN`.

**CTA destinations** (`site-pages.ts`): Mock Tests, AI Tutor and Battle are behind login and `/login` can't return users to a page, so those CTAs point to `/signup`. Brain Booster points to `/brain-booster`, which is public.

**Measured live (2026-10-07):** one plan for "maths olympiad class 5" took ~25 s and about 3.9k input / 2k output tokens (~$0.055 on Opus 5.5).

## Content Writer Agent (`agents/content-writer.ts`), Phase 4

**Trigger:** **Generate article** on a plan (status Idea or Planned), or **Regenerate** in the editor. Server actions in `src/actions/seo-agent/articles.ts`; logged as `ContentWriter · generate_article / regenerate_article`, usage category `CONTENT`.

**Input:** the plan (title, keywords, intent, type, audience, outline, notes incl. fact-check notes), the CTA, the plan's internal links (the only internal URLs allowed), existing article titles (to avoid duplication) and the brand profile.

**Prompt** (`prompts/article-writing.ts`): the §11 quality rules and §39 honesty rules in full: people first, answer intent early, no keyword stuffing or density targets, no copying, no filler, no invented statistics/facts/citations, short paragraphs, tables and FAQ only where useful, warm Indian English for children and parents. The writer returns title, slug, meta title/description, excerpt, the body as **Markdown** with a `[[CTA]]` marker, CTA type, a text-free featured-image prompt with alt text, and `needsVerification`: every claim an editor must check.

**Post-processing** (`postProcessArticle` + `article-html.ts`):
- Markdown → HTML (GFM tables). Raw HTML inside the Markdown is never interpreted.
- `[[CTA]]` becomes a CTA block (`<div data-cta="TYPE"></div>`); extra markers are dropped. If there's no marker, the block is appended at the end and flagged.
- Internal links outside the allowlist are unwrapped (text kept) and flagged; external links are kept but flagged for review.
- Everything is sanitized with the article allowlist (below) and the claims to verify are stored in `seo_articles.quality_flags`.

**Saved as** (`articles-persist.ts`): a `DRAFT` article with a slug unique across unarchived drafts and live blog posts (and not a reserved `/blog` route), version 1 (`AI_GENERATED`, linked to the agent task), link/CTA rows, and the plan moves to `DRAFT`. Generation claims the plan (`GENERATING`) first, so double-clicks can't run two writers; on any failure the plan returns to its previous status and a half-saved article is deleted. A `GENERATING` claim older than 15 minutes (a crashed run) can be retried.

**Measured live (2026-10-07):** "maths olympiad class 5" took 74 s, about 4.7k input / 7.4k output tokens (~$0.17 on Opus 5.5): 2,300 words, 10 sections, 2 tables, 6 worked examples, one CTA, 6 valid internal links, 7 claims flagged for verification.

## Article HTML safety (`article-html.ts`)

All article HTML goes through one allowlist (`rehype-sanitize`), used for writer output, every editor save, restores and version views:
- tags: `p h1–h4 strong em u s code pre br ul ol li a img blockquote hr table thead tbody tr th td` and `div` only as an empty CTA block with a known `data-cta` type
- attributes: `a[href,title]`, `img[src,alt,title]`, `th/td[colspan,rowspan]`; no `style`, `class`, event handlers, `id`, `target` or `rel`
- protocols: links `http/https/mailto` (or site-relative), images `https` only
- `script`/`style` contents are removed entirely

The editor always loads from this sanitized HTML; client-submitted TipTap JSON is never trusted or stored.

## Claude provider: streaming

Since Phase 4 the provider streams every request (`beta.messages.stream(...).finalMessage()`), so long outputs like full articles (up to 32k output tokens) can't hit HTTP timeouts. Routes that run the writer set `maxDuration = 300`.

## SEO Agent (`agents/seo-analyst.ts`), Phase 5

**Trigger:** **SEO check** in the editor (the article is saved first). Server action `runSeoCheck` in `src/actions/seo-agent/seo.ts`; logged as `SEOAgent · seo_check`, usage category `SEO`.

**Two halves:**
1. **Deterministic checks** (`seo-checks.ts`, unit-tested): title / meta title / meta description length and keyword; H1s in the body, number of H2s, skipped heading levels; keyword in the first 100 words, in a heading and in the slug; keyword stuffing (> 3% for the exact phrase); word count; average sentence length and over-long paragraphs; internal links (none, one, or links to pages that don't exist); external links; CTA blocks; excerpt, featured image and alt text.
2. **AI review** (`prompts/seo-analysis.ts`): scores intent match, completeness, readability, CTA relevance and overall quality (0–10 with a note), recommends the best CTA, lists up to 10 concrete recommendations, and fact-checks the article (§39): unsupported statistics, rankings, invented claims, citations or organisations, competition details and possibly outdated information, each quoted from the text with a severity. The reviewer sees the article as Markdown (links, lists and tables visible) plus a list of verified OlympiadIQ pages, so real product pages aren't flagged as invented.

**Score:** 12 categories with fixed weights (`seo-categories.ts`, summing to 100). Where both exist, a category blends the worst automatic check (40%) with the AI's judgement (60%). Any HIGH-severity fact issue caps Overall quality. The result is stored in `seo_articles.seo_score` and `seo_analysis`, together with a fingerprint of the checked content; the editor shows "out of date" when the saved article no longer matches. It is always labelled an **internal content-quality score, not a Google ranking score**, and never promises rankings.

**Critical list:** HIGH-severity fact issues and failed meta/link/CTA checks go into `analysis.critical`. Phase 6/7 auto-publish will refuse to publish while this list is non-empty.

**Measured live (2026-10-07)** on the 2,300-word test article: ~31 s, ~9k input / 2.9k output tokens (~$0.09). Score 92, no critical items, 8 specific recommendations (e.g. a contradiction between the FAQ and the study plan, and clarifying that SOF's IMO is not the senior International Mathematical Olympiad).

## Internal Linking Agent (`agents/internal-linker.ts`), Phase 5

**Trigger:** **Find link suggestions** in the editor. Logged as `InternalLinker · suggest_internal_links`, category `SEO`. Candidates are published blog posts, topic pages for the keyword's class/subject (inferred from the keyword text), and public feature pages, excluding the article itself.

**Validation:** the URL must be a candidate and not already linked; the anchor must be 2–8 words copied from the running text (not a heading), and the prompt forbids anchors like "official syllabus" on OlympiadIQ pages. Results are stored as `SUGGESTED` rows. **Apply** links the first matching phrase (skipping headings and existing links), and it becomes `INSERTED` on save. **Dismiss** marks it `REJECTED`, so it is never suggested again (`link-sync.ts` rules, unit-tested). ~3 s, ~$0.03 per run.

## CTA system (`cta.ts`), Phase 5

One definition per CTA (`MOCK_TEST`, `AI_TUTOR`, `BATTLE`, `BRAIN_BOOSTER`): headline, text and button label, plus the destination from `site-pages.ts`. The copy only describes features in the brand profile. The editor card, preview, version views and (Phase 6) publishing all render from it. The planner and writer choose a CTA; the SEO Agent re-evaluates the fit; the admin can switch any block by hand or with **Use this CTA**.

## Coming in later phases, SEO analysis and internal linking (Phase 5), Strategy (Phase 9), Backlink and Outreach (Phase 10). Each will use `runAgentTask` and `generateStructuredOutput`, and keep its prompt in `prompts/`.
