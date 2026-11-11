# AI Question Paper Solver

Students upload a question paper (PDF or DOCX) at `/question-paper-solver`. In the background, Claude reads every question, solves them, and produces an answer sheet that can be edited in the app and downloaded as PDF or Word. The design is in [architecture.md](architecture.md).

## Where things live

```
supabase/migrations/019_question_paper_solver.sql   qps_jobs, qps_questions, qps_usage, qps_job_logs, RLS, private bucket
src/lib/question-paper/
  constants.ts        limits, enums, labels                                   [client-safe]
  types.ts            row types + the column lists safe to send to the browser
  file-check.ts       byte-level PDF/DOCX verification, macro rejection
  pdf.ts              page count, scanned detection, chunk planning, slicing
  docx.ts, omml.ts    DOCX → Markdown; Word equations → LaTeX; image extraction
  ai.ts               Claude client (streaming, structured output, refusal fallback)
  prompts.ts          extraction + answer prompts (class bands, detail levels, honesty rules)
  extract.ts          extraction schema + merge/coverage (stitching, placeholders, gap checks)
  solve.ts            answer schema, batching, id-based matching
  pipeline.ts         the AI steps as pure functions (used by the worker and live tests)
  worker.ts           background state machine: lease, steps, retries, self-chaining
  sheet.ts            format-neutral answer-sheet model
  export-html.ts, export-pdf.ts   KaTeX HTML → A4 PDF via headless Chromium
  export-docx.ts, latex.ts        Word export with native equations
  storage.ts, server.ts           private Storage access; route helpers, auth, quotas
src/app/api/question-paper/       jobs, start, status, export, regenerate, question edit, worker
src/app/api/cron/question-paper/  daily retention + recovery
src/app/(student)/question-paper-solver/   pages (upload/history, job view)
src/components/question-paper/    UI
tests/question-paper/             unit tests + opt-in live AI test
```

Existing files changed: `Sidebar.tsx` (new "Paper Solver" Library item), `GlobalSpinner.tsx` (opts this page out of the click spinner, as `/tutor` does), `next.config.ts` (`serverExternalPackages` for Chromium), `vercel.json` (one daily cron), `.env.example`, `tests/seo-agent/cron.test.ts` (now allows crons from other features).

## Deploying to Vercel

1. **Run the migration.** Paste `supabase/migrations/019_question_paper_solver.sql` into the Supabase SQL editor and run it. It is safe to re-run. It also creates the private `question-papers` bucket.
2. **Environment variables.** `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are already set. Optional:
   - `QPS_WORKER_SECRET` (≥16 chars) authenticates the worker's self-calls. If it isn't set, `CRON_SECRET` is used.
   - `QPS_AI_MODEL` overrides `claude-opus-5-5`.
   - `VERCEL_AUTOMATION_BYPASS_SECRET` is only needed if you test on **preview** deployments with Deployment Protection on. Otherwise the worker's self-call is blocked.
3. **Deploy** as usual. The PDF route uses `@sparticuz/chromium` (about 60 MB, within Vercel's function size limit). Fluid compute must be on (the default) so the worker gets `maxDuration = 300` on Hobby.
4. After deploying, check **Settings → Cron Jobs** for `/api/cron/question-paper` (daily, 02:00 UTC).

## Limits and costs

- 15 MB per file, 40 pages, 5 papers per user per day (including full-sheet regenerations), 1 active paper at a time, 30 single-answer regenerations per day. Admins are exempt. Change these in `constants.ts`; the 15 MB cap is also set in the migration's bucket and CHECK constraint.
- Uploaded papers, extracted images and exports are deleted 30 days after upload. Answers stay viewable and can still be exported.
- AI cost on Opus 5.5 ($4/$20 per M tokens): the live test's 5 solved papers (23 questions) and the 21-page extraction used about 145k input and 30k output tokens in total, roughly **$1.20**. A typical 40-question paper costs about $1. Real usage per job is stored in `qps_jobs.ai_input_tokens` / `ai_output_tokens`.

## Tests

```
npx vitest run tests/question-paper                      # unit tests, no network
QPS_LIVE=1 npx vitest run tests/question-paper/live.test.ts   # real Claude calls (~$1), needs local Chrome
```

Results on 2026-11-11 (unit tests: 58 pass; full repo suite: 322 pass):

| # | Scenario | How | Result |
|---|---|---|---|
| 1 | Text PDF | live: typeset maths paper | ✅ 6/6 questions, numbering kept, all correct |
| 2 | Scanned PDF | live: image-only, tinted and rotated scan | ✅ detected as scanned, 4/4 read by OCR, correct (2 A, hydrogen, mitochondria) |
| 3 | DOCX | live: Word equations + figure + match | ✅ 5/5; equations read as LaTeX; figure answered (30 cm²) |
| 4 | Maths with equations | live (paper 1) + exports | ✅ fractions/powers typeset in preview, PDF and native Word equations |
| 5 | Science with diagram | live: circuit diagram, scanned | ✅ diagram interpreted (6 V / 3 Ω → 2 A) |
| 6 | Olympiad MCQ | live: series, coding, clock, ordering | ✅ 4/4 correct options with reasoning |
| 7 | Multi-section | live (papers 1 and 8) | ✅ sections preserved, restarts handled |
| 8 | Large multi-page | live: 21 pages, 42 questions, 3 chunks | ✅ all 42 in order, sections carried across chunks, 0 false flags |
| 9 | Corrupted / unsupported | unit: truncated PDF/ZIP, wrong bytes, `.docm` macros, empty, over 40 pages | ✅ all rejected with friendly messages |
| 10 | Unreadable questions | live: stained question + missing figure | ✅ both flagged "cannot answer", not guessed; the others answered |

Also covered by unit tests: RLS (users only see their own rows, cannot write directly even with grants; admins read all; logs are admin-only), one active job per user, coverage placeholders and numbering gaps, cross-chunk stitching, id-based answer matching, HTML/script injection (shown as text, never rendered), A4 PDF with page numbers, and a DOCX with heading styles and page fields.

**Not tested end-to-end:** the deployed upload → worker → poll loop against a real Supabase project, because the migration hasn't been applied yet. Each piece is tested separately: the routes type-check and build, the worker uses the same pipeline functions as the live test, and RLS is tested on Postgres. After deploying, do one smoke test with a real paper.

## Known limitations

- Handwritten papers: OCR quality varies; unclear questions are flagged rather than answered.
- Legacy Equation Editor 3.0 objects in DOCX (OLE) can't be read; affected questions are flagged.
- Diagrams are described in the answer sheet, not redrawn.
- Password-protected PDFs are rejected. Edit-protected PDFs are only accepted up to 10 pages (they can't be split).
- Old `.doc` files aren't supported (the upload screen says to save them as .docx or PDF).
- The PDF export loads KaTeX CSS and fonts from jsDelivr and Google Fonts at render time. If those can't be reached, the PDF still renders but falls back to system fonts.
- AI answers can be wrong. The sheet carries a disclaimer, and anything low-confidence is flagged.
