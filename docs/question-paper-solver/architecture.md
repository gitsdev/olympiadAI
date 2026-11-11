# AI Question Paper Solver — Architecture (Phase 1 proposal)

Status: **implemented** (approved 2026-11-11: Claude Opus 5.5, headless-Chromium PDF, Hobby limits, default caps). See [README.md](README.md) for deployment and test results.

## 1. What already exists and will be reused

| Concern | Existing piece | How the solver uses it |
|---|---|---|
| Routing / layout | `src/app/(student)/` + `AppShell`, `Sidebar` | New page `src/app/(student)/question-paper-solver/` so it gets the student shell; add a Library nav item |
| Auth gate | `src/proxy.ts` → `updateSession` (redirects signed-out users, OTP gate) | Page is gated automatically; API routes call `supabase.auth.getUser()` themselves |
| DB clients | `lib/supabase/server.ts` (RLS, user JWT), `service.ts` (service role) | User-facing reads/writes via RLS client; the background worker uses service role, scoped by `job.user_id` |
| Admin check | `is_platform_admin()` SQL fn (migration 013), `requireAdmin()` | RLS policies grant admins read access |
| AI provider pattern | `lib/seo-agent/ai/` (`AIProvider` interface + `AnthropicProvider`), `lib/ai-retry.ts` | Same pattern in `lib/question-paper/ai/`; `ANTHROPIC_API_KEY` is already configured |
| UI primitives | `components/ui` (oa-button, oa-card, oa-progress, skeleton, dialog, tabs, select, badge) | All screens built from these + design tokens in `globals.css` |
| Markdown rendering | `react-markdown`, `remark-gfm`, `rehype-sanitize` | Answer preview; add `remark-math` + `rehype-katex` for equations |
| Cron | `vercel.json` crons + `CRON_SECRET` | One daily cron: retention cleanup + revive stalled jobs |

## 2. Pipeline overview

```
Browser                         Vercel (Next.js)                         Supabase / Claude
───────                         ────────────────                         ─────────────────
1. POST /api/qps/jobs  ───────► validate meta, rate-limit, create job ──► qps_jobs (status=awaiting_upload)
   ◄── signed upload URL ◄──── createSignedUploadUrl(path)
2. PUT file (XHR, progress) ─────────────────────────────────────────────► Storage: question-papers/{uid}/{job}/source.pdf
3. POST /api/qps/jobs/:id/start ► verify object exists, magic bytes,
                                   size, page count, no macros ──────────► status=queued
                                   after(() => kick worker)
4. Worker: POST /api/qps/worker (internal secret, maxDuration 300)
     each invocation does ONE step, saves, then re-kicks itself:
       extract  → read paper (Claude, native PDF/vision) → qps_questions rows (ordered)
       verify   → coverage check: every numbered question accounted for
       solve[n] → one batch of ~8 questions per invocation
       finalize → answer key, flagged list, status=completed
5. GET /api/qps/jobs/:id  (poll every 2.5s) ◄── stage, progress %, per-question status
   └─ if job lease expired (worker died), this call re-kicks the worker
```

**Why this shape:** Vercel functions are capped (300 s on Hobby with Fluid compute). No single invocation does more than one bounded step, all state lives in Postgres, and each step is idempotent, so a crash or timeout loses at most one batch. A worker claims a job with a lease (`locked_until`), so two invocations can't process the same job. Three things keep a job moving: the worker's self-chain, the polling endpoint (re-kicks a job whose lease has expired), and the daily cron. A job gives up after 3 failed attempts at the same step and is marked `failed` with a friendly message. No third-party queue is needed. If you later want one, Inngest or Upstash QStash can replace the self-chain without schema changes.

The six user-visible stages map to: Reading (extract start) → Extracting questions → Identifying question types (verify) → Generating solutions (solve batches, with an "n of N" counter) → Formatting (finalize) → Finalizing.

## 3. Document processing

| Input | Approach |
|---|---|
| **PDF (text or scanned)** | `unpdf` (serverless build of pdf.js) gets page count and the text layer. If a page has fewer than ~20 characters of text, it is classed as scanned. **The PDF itself is then sent to Claude as a `document` block.** Claude reads each page as both text and image, so it handles OCR, equations, tables and geometry/science diagrams in one pass, with no separate OCR service. Papers longer than 10 pages are split into page ranges with `pdf-lib`; each range is extracted separately and merged in page order. A question that runs across a range boundary is flagged `continues_on_next_page` and stitched. |
| **DOCX** | `mammoth` converts to semantic HTML (headings, lists, numbering, tables) and returns embedded images. Mammoth only parses XML. It never executes macros, and `.docm`/`.dotm` are rejected outright. The HTML is converted to Markdown and sent with the images (as image blocks) so diagrams are interpreted. Equation objects (OMML) that mammoth drops are detected by scanning `word/document.xml` for `m:oMath`; affected questions are flagged for review rather than guessed. |
| **Sanitising** | Extracted text is treated as data: it is placed in clearly delimited user content and never in the system prompt. All rendered content passes through `rehype-sanitize`, and no HTML from the source document is ever rendered. |

**Extraction output** (structured outputs, Zod-validated): per question → `number_label` ("Q5", "5(b)", "II.3"), `section`, `order_index`, `type` (mcq, fill_blank, match, true_false, short, long, numerical, diagram, comprehension, other), `text` (Markdown + LaTeX), `options[]`, `match_pairs`, `has_diagram`, `diagram_description`, `source_pages[]`, `marks`, `confidence` (high/medium/low), `issues[]`. It also returns detected class/board/subject/exam type, which pre-fill the form when the user picked "Auto-detect".

**"Never silently skip"** has three safeguards:
1. The extractor also returns a flat *index* of every question number it saw per page. Any number in the index without a matching question becomes a placeholder row with `needs_review = true` and reason "Could not read this question".
2. Gaps in numbering (e.g. 1–7 then 9) create a flagged placeholder row.
3. Low confidence, or any `issues`, sets `needs_review`. The solver is told to return `status: "cannot_answer"` with a reason instead of inventing an answer when a question is incomplete or ambiguous.

## 4. Answer generation

- One call per batch of ~8 questions, in original order, with structured output keyed by `question_id` (order never depends on position in the response). For diagram questions in a PDF, the relevant source pages are attached; for DOCX, the extracted images are.
- System prompt is stable and cached (prompt caching). It contains: class-band language rules (1–3 / 4–5 / 6–8 / 9–10), board, subject, exam type (Olympiad → reasoning-first), detail level, and per-type rules (MCQ: option + why; maths: formula → steps → **final answer**; English: grammatical; etc.).
- Per-answer output: `answer_short` (used in the answer key), `correct_option`, `answer_md`, `explanation_md`, `steps[]`, `final_answer`, `confidence`, `status` (answered / cannot_answer), `review_reason`.
- Regenerating a single question re-runs only that question, with the same context.
- Paper text is only extracted once and stored, so regenerations never re-read the whole paper.

## 5. Database (migration `019_question_paper_solver.sql`)

```
qps_jobs
  id uuid pk, user_id uuid → auth.users (on delete cascade)
  file_name text, file_ext text check in ('pdf','docx'), mime_type text, file_size int,
  storage_path text, page_count int, is_scanned bool
  class_level int check 1..10 null, board text, subject text, exam_type text,
  detail_level text check in ('short','detailed','step_by_step'), auto_detect bool,
  detected_meta jsonb
  status text check in ('awaiting_upload','queued','extracting','solving','finalizing',
                        'completed','failed','cancelled')
  stage text, progress int, total_questions int, solved_questions int, flagged_questions int,
  attempts int, locked_until timestamptz, last_error text (user-safe), error_detail text (internal)
  extraction jsonb (raw extractor output, kept for debugging and re-runs)
  export_pdf_path text, export_docx_path text, exports_version int, answers_version int
  ai_input_tokens int, ai_output_tokens int
  created_at, updated_at, completed_at, source_deleted_at

qps_questions
  id uuid pk, job_id → qps_jobs (cascade), user_id (denormalised for RLS)
  order_index int, section text, number_label text, type text,
  question_md text, options jsonb, match_pairs jsonb, has_diagram bool, diagram_description text,
  source_pages int[], marks numeric,
  extraction_confidence text, needs_review bool, review_reason text, review_source text ('ai'|'user'),
  answer_status text check in ('pending','answered','cannot_answer','failed'),
  answer_short text, correct_option text, answer_md text, explanation_md text, final_answer text,
  answer_confidence text, edited_by_user bool, regen_count int,
  created_at, updated_at
  unique (job_id, order_index)

qps_usage  (rate limiting: user_id, kind ('job'|'regen'), created_at) + index
```

- **RLS:** owner can `select` / `update` limited columns (via server actions) / `delete` own rows; `is_platform_admin()` can `select` all. `insert` happens only through server code. Statuses are `text + CHECK` like the SEO Agent.
- **Storage:** private bucket `question-papers`, path `{user_id}/{job_id}/source.{ext}` and `{user_id}/{job_id}/exports/answers-v{n}.{pdf|docx}`. Storage policies restrict each user to their own top-level folder; admins can read. Bucket-level `file_size_limit` and `allowed_mime_types` are set as well, so the limit holds even if app code is bypassed.

## 6. Answer sheet + export

- **Preview** (in-app): a React document view styled as an A4 sheet. It has a header block, sections, collapsible Q/A cards, KaTeX maths, an amber "Needs review" badge, the answer key table and the flagged list. Each card has Edit (Markdown with live preview), Regenerate, and Mark/Unmark for review.
- **PDF:** the same HTML template is rendered server-side with headless Chromium (`puppeteer-core` + `@sparticuz/chromium`). A4, OlympiadIQ header and footer with page *n of N*, `break-inside: avoid` on each Q/A block, and KaTeX for true fraction/superscript layout.
- **DOCX:** the `docx` package with real Heading 1–3 styles, numbering, tables (answer key, match-the-following), and header/footer with page numbers. LaTeX is converted to native Word equations (OMML) for the common subset: fractions, powers, subscripts, roots, Greek letters, operators. Anything outside that subset falls back to clear inline text.
- Exports are generated on demand, stored under `exports/`, and reused until `answers_version` changes (any edit or regeneration bumps it). Downloads are served via a 5-minute signed URL.

## 7. Security and limits (proposed defaults)

| Control | Default |
|---|---|
| Max file size | 15 MB (client check + server check + bucket limit) |
| Max pages | 40 |
| Allowed | `.pdf` (`%PDF-` magic) and `.docx` (ZIP magic + `[Content_Types].xml` with the wordprocessingml main part; any `vbaProject.bin` → reject) |
| Rate limits | 5 papers/day and 1 active job per user; 30 single-answer regenerations/day; admins exempt |
| Retention | Source file deleted 30 days after upload (daily cron); exports deleted with it; users can delete a job (rows + files) any time |
| Secrets | `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, new `QPS_WORKER_SECRET` are only read in `server-only` modules |
| Errors | Users see friendly messages; internal detail is logged to `error_detail` (not selectable by the user's RLS view) |

## 8. Dependencies and services

New npm packages: `unpdf`, `pdf-lib`, `mammoth`, `docx`, `katex`, `remark-math`, `rehype-katex`, `puppeteer-core`, `@sparticuz/chromium`.

No new third-party services: Supabase (existing), Vercel (existing), Anthropic API (existing key).

## 9. Estimated AI cost per paper

Assumptions: a typical 8-page paper with 40 questions, about 2.5k input tokens per PDF page, and solving with adaptive thinking. These are rough planning numbers; real usage is recorded per job in `ai_input_tokens` / `ai_output_tokens`.

| Model | Price (in / out per 1M tokens) | Extraction | Solving | **Per paper** | Single regeneration |
|---|---|---|---|---|---|
| Claude Opus 5.5 | $4 / $20 | ~$0.25 | ~$0.90 | **~$1.15** | ~$0.03 |
| Claude Sonnet 5.5 | $2 / $10 | ~$0.12 | ~$0.45 | **~$0.57** | ~$0.015 |

Maths-heavy Olympiad papers with step-by-step answers sit at the top of these ranges. Caching the system prompt across batches reduces input cost a little.

Infrastructure: Supabase storage for PDFs is negligible at this scale (a 30-day retention limit caps growth). Vercel function time is roughly 2–6 minutes of compute per paper across several invocations, which fits both Hobby and Pro.

## 10. Known limitations (expected)

- Handwritten question papers: OCR quality varies; such questions are more likely to be flagged than answered.
- DOCX equations created with the legacy Equation Editor 3.0 (OLE objects) can't be read; those questions are flagged.
- Diagrams are interpreted, not reproduced. The answer sheet describes the diagram rather than redrawing it.
- AI answers can be wrong. The sheet carries a "verify before relying on it" note, and low-confidence answers are flagged.
