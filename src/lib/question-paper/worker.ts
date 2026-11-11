// Background pipeline for a question-paper job.
//
// Vercel functions are time-limited (300 s on Hobby), so a job is processed
// as a sequence of small, idempotent steps: prepare → extract chunk 1..N →
// build question list → solve batch 1..M → finalize. All state lives in
// qps_jobs / qps_questions. Each worker invocation claims the job with a
// lease, runs steps until its time budget is used, then re-invokes itself
// (POST /api/question-paper/worker). If an invocation dies, the lease
// expires and the next status poll or the daily cron restarts it.

import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { AIError, QPS_MODEL, type ContentPart, type Usage } from "./ai";
import { convertDocx } from "./docx";
import { detectedMeta, mergeChunks, type StoredChunk } from "./extract";
import { FileRejectedError } from "./file-check";
import { EXTRACT_PAGES_PER_CHUNK, planChunks } from "./pdf";
import { docxContent, extractQuestions, imageParts, pdfChunkContent, pdfSourceParts, solveBatch, type VisionImage } from "./pipeline";
import type { SolveContext } from "./prompts";
import { batchSize, type SolvableQuestion, type SolvedAnswer } from "./solve";
import { downloadBytes, paths, uploadBytes } from "./storage";
import type { JobRow, QuestionRowDb } from "./types";

const LEASE_SECONDS = 290;
/** Don't start another step after this much time in one invocation. */
const STEP_BUDGET_MS = 40_000;
const MAX_STEP_ATTEMPTS = 3;
const MAX_SOLVE_ATTEMPTS_PER_QUESTION = 2;

type Db = SupabaseClient;

export async function log(db: Db, jobId: string | null, level: "info" | "warn" | "error", event: string, detail?: Record<string, unknown>) {
  await db.from("qps_job_logs").insert({ job_id: jobId, level, event, detail: detail ?? null });
  if (level !== "info") console[level === "warn" ? "warn" : "error"](JSON.stringify({ scope: "qps", jobId, event, ...detail }));
}

/* ── Lease ─────────────────────────────────────────────────────────────── */

async function claim(db: Db, jobId: string): Promise<{ job: JobRow; token: string } | null> {
  const token = randomUUID();
  const now = new Date();
  const { data } = await db
    .from("qps_jobs")
    .update({ lock_token: token, locked_until: new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString() })
    .eq("id", jobId)
    .in("status", ["queued", "extracting", "solving", "finalizing"])
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select("*")
    .maybeSingle();
  return data ? { job: data as JobRow, token } : null;
}

async function release(db: Db, jobId: string, token: string) {
  await db.from("qps_jobs").update({ locked_until: null, lock_token: null }).eq("id", jobId).eq("lock_token", token);
}

/**
 * Updates the job only while we still hold its lease and it is still being
 * processed (a user cancel/delete mid-step must not be overwritten).
 */
async function patch(db: Db, jobId: string, token: string, values: Partial<JobRow>) {
  const { error } = await db.from("qps_jobs").update(values)
    .eq("id", jobId).eq("lock_token", token)
    .in("status", ["queued", "extracting", "solving", "finalizing"]);
  if (error) throw new Error(`Job update failed: ${error.message}`);
}

/* ── Entry points ──────────────────────────────────────────────────────── */

/**
 * Asks a fresh function invocation to process the job. Returns once the
 * worker has accepted the request (it replies 202 immediately).
 */
export async function kickWorker(origin: string, jobId: string): Promise<void> {
  const secret = process.env.QPS_WORKER_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    console.error(JSON.stringify({ scope: "qps", event: "worker.no_secret" }));
    return;
  }
  const headers: Record<string, string> = { authorization: `Bearer ${secret}`, "content-type": "application/json" };
  // Lets the self-call through Vercel Deployment Protection on preview URLs.
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  try {
    await fetch(`${origin}/api/question-paper/worker`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jobId }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    // The poll endpoint and cron will retry; just record it.
    console.error(JSON.stringify({ scope: "qps", jobId, event: "worker.kick_failed", message: (err as Error).message }));
  }
}

/**
 * Runs steps for one job until it finishes or this invocation's budget is
 * used, then hands over to a new invocation.
 */
export async function runWorker(jobId: string, origin: string): Promise<void> {
  const db = createServiceClient();
  const started = Date.now();

  while (Date.now() - started < STEP_BUDGET_MS) {
    const claimed = await claim(db, jobId);
    if (!claimed) return; // finished, cancelled, or another invocation holds it
    const { job, token } = claimed;
    let more = false;
    try {
      more = await runStep(db, job, token);
    } catch (err) {
      more = await handleStepError(db, job, token, err);
    } finally {
      await release(db, jobId, token);
    }
    if (!more) return;
  }
  await kickWorker(origin, jobId);
}

/** True if the job needs more steps. */
async function runStep(db: Db, job: JobRow, token: string): Promise<boolean> {
  switch (job.status) {
    case "queued":
      await prepare(db, job, token);
      return true;
    case "extracting":
      return extractNextChunk(db, job, token);
    case "solving":
      return solveNextBatch(db, job, token);
    case "finalizing":
      await finalize(db, job, token);
      return false;
    default:
      return false;
  }
}

async function failJob(db: Db, job: JobRow, token: string, userMessage: string, detail: Record<string, unknown>) {
  await patch(db, job.id, token, { status: "failed", last_error: userMessage, attempts: 0 });
  await log(db, job.id, "error", "job.failed", { userMessage, ...detail });
}

async function handleStepError(db: Db, job: JobRow, token: string, err: unknown): Promise<boolean> {
  const message = (err as Error)?.message ?? String(err);
  if (err instanceof FileRejectedError) {
    await failJob(db, job, token, err.message, { step: job.status });
    return false;
  }
  const retryable = !(err instanceof AIError) || err.retryable;
  const attempts = job.attempts + 1;
  if (!retryable || attempts >= MAX_STEP_ATTEMPTS) {
    await failJob(db, job, token,
      job.status === "extracting" || job.status === "queued"
        ? "We couldn't read this question paper. Please try again in a few minutes, or upload a clearer copy."
        : "Something went wrong while preparing the answer sheet. Please try again in a few minutes.",
      { step: job.status, attempts, message });
    return false;
  }
  await patch(db, job.id, token, { attempts });
  await log(db, job.id, "warn", "step.retry", { step: job.status, attempts, message });
  return true;
}

/* ── Steps ─────────────────────────────────────────────────────────────── */

async function addUsage(db: Db, job: JobRow, token: string, usage: Usage, model: string, extra: Partial<JobRow> = {}) {
  job.ai_input_tokens += usage.inputTokens;
  job.ai_output_tokens += usage.outputTokens;
  await patch(db, job.id, token, {
    ai_input_tokens: job.ai_input_tokens,
    ai_output_tokens: job.ai_output_tokens,
    ai_model: model,
    ...extra,
  });
}

async function prepare(db: Db, job: JobRow, token: string) {
  if (job.file_ext === "docx") {
    const bytes = await downloadBytes(db, job.storage_path);
    const content = await convertDocx(bytes);
    const images: NonNullable<JobRow["source_images"]> = [];
    for (const img of content.images) {
      let path: string | null = null;
      if (img.supported) {
        const ext = img.mime.split("/")[1].replace("jpeg", "jpg");
        path = paths.image(job.user_id, job.id, img.id, ext);
        await uploadBytes(db, path, img.bytes, img.mime);
      }
      images.push({ id: img.id, path, mime: img.mime, supported: img.supported });
    }
    await patch(db, job.id, token, {
      source_markdown: content.markdown,
      source_images: images,
      extract_chunks: 1,
      extract_cursor: 0,
      status: "extracting",
      stage: "extracting",
      progress: 8,
      attempts: 0,
      started_at: new Date().toISOString(),
    });
  } else {
    const chunks = planChunks(job.page_count ?? 1, EXTRACT_PAGES_PER_CHUNK);
    await patch(db, job.id, token, {
      extract_chunks: chunks.length,
      extract_cursor: 0,
      status: "extracting",
      stage: "extracting",
      progress: 8,
      attempts: 0,
      started_at: new Date().toISOString(),
    });
  }
  await log(db, job.id, "info", "job.prepared", { ext: job.file_ext, pages: job.page_count });
}

async function docxImages(db: Db, job: JobRow, ids: string[] | null): Promise<VisionImage[]> {
  const out: VisionImage[] = [];
  for (const img of job.source_images ?? []) {
    if (!img.supported || !img.path) continue;
    if (ids && !ids.includes(img.id)) continue;
    out.push({ id: img.id, mime: img.mime, bytes: await downloadBytes(db, img.path) });
  }
  return out;
}

async function extractNextChunk(db: Db, job: JobRow, token: string): Promise<boolean> {
  const i = job.extract_cursor;
  if (i >= job.extract_chunks) {
    // All chunks were read but building the question list failed last time.
    await buildQuestions(db, job, token);
    return true;
  }
  let content: ContentPart[];
  let pageOffset = 1;

  if (job.file_ext === "pdf") {
    const bytes = await downloadBytes(db, job.storage_path);
    const [from, to] = planChunks(job.page_count ?? 1, EXTRACT_PAGES_PER_CHUNK)[i];
    pageOffset = from;
    const prev = (job.extraction ?? [])[i - 1] as StoredChunk | undefined;
    content = await pdfChunkContent(bytes, {
      from, to, pageCount: job.page_count ?? 1, chunkIndex: i, chunkCount: job.extract_chunks, fileName: job.file_name,
      carrySection: prev?.result.questions.at(-1)?.section ?? null,
    });
  } else {
    content = docxContent(job.source_markdown ?? "", await docxImages(db, job, null));
  }

  const { data, usage, model } = await extractQuestions(content);

  const extraction = [...(job.extraction ?? []).slice(0, i), { pageOffset, result: data }];
  const done = i + 1 >= job.extract_chunks;
  await addUsage(db, job, token, usage, model, {
    extraction,
    extract_cursor: i + 1,
    attempts: 0,
    progress: Math.round(8 + (27 * (i + 1)) / job.extract_chunks),
    stage: done ? "identifying" : "extracting",
  });
  await log(db, job.id, "info", "extract.chunk", { chunk: i + 1, of: job.extract_chunks, questions: data.questions.length, index: data.question_index.length });

  if (done) await buildQuestions(db, { ...job, extraction }, token);
  return true;
}

async function buildQuestions(db: Db, job: JobRow, token: string) {
  const chunks = job.extraction as StoredChunk[];
  const unsupported = (job.source_images ?? []).filter((i) => !i.supported).map((i) => i.id);
  const rows = mergeChunks(chunks, unsupported);

  if (rows.length === 0) {
    throw new FileRejectedError("We couldn't find any questions in this document. Please check that it is a question paper.");
  }

  // Idempotent: a retry after a partial insert starts clean.
  await db.from("qps_questions").delete().eq("job_id", job.id);
  const { error } = await db.from("qps_questions").insert(rows.map((r) => ({ ...r, job_id: job.id, user_id: job.user_id })));
  if (error) throw new Error(`Could not save questions: ${error.message}`);

  const meta = detectedMeta(chunks);
  const fill: Partial<JobRow> = {};
  // Auto-detect fills only what the user left blank; their choice always wins.
  if (job.class_level === null && meta.class_level) fill.class_level = meta.class_level;
  if (!job.board && meta.board) fill.board = /cbse/i.test(meta.board) ? "CBSE" : /icse/i.test(meta.board) ? "ICSE" : "Other";
  if (!job.subject && meta.subject) fill.subject = meta.subject;
  if (!job.exam_type && meta.exam_type) fill.exam_type = meta.exam_type as JobRow["exam_type"];

  await patch(db, job.id, token, {
    ...fill,
    detected_meta: meta,
    total_questions: rows.length,
    flagged_questions: rows.filter((r) => r.needs_review).length,
    solved_questions: 0,
    status: "solving",
    stage: "solving",
    progress: 40,
    attempts: 0,
  });
  await log(db, job.id, "info", "extract.done", { questions: rows.length, flagged: rows.filter((r) => r.needs_review).length });
}

export function solveContext(job: Pick<JobRow, "class_level" | "board" | "subject" | "exam_type" | "detail_level">): SolveContext {
  return { classLevel: job.class_level, board: job.board, subject: job.subject, examType: job.exam_type, detailLevel: job.detail_level };
}

/** The original pages / figures for a batch, so Claude can check the transcription. */
async function sourceParts(db: Db, job: JobRow, questions: SolvableQuestion[]): Promise<ContentPart[]> {
  if (job.source_deleted_at) return [];
  if (job.file_ext === "pdf") {
    return pdfSourceParts(await downloadBytes(db, job.storage_path), questions.flatMap((q) => q.source_pages));
  }
  const ids = [...new Set(questions.flatMap((q) => q.image_refs))];
  return ids.length ? imageParts(await docxImages(db, job, ids)) : [];
}

/** Solves `questions` and returns answers by question id. Shared with single-answer regeneration. */
export async function solveQuestions(db: Db, job: JobRow, questions: SolvableQuestion[]): Promise<{ matched: Map<string, SolvedAnswer>; missing: string[]; usage: Usage; model: string }> {
  return solveBatch(solveContext(job), questions, await sourceParts(db, job, questions));
}

/** Rough word-overlap test, so two wordings of the same problem aren't both shown. */
export function similarReasons(a: string, b: string): boolean {
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return false;
  let shared = 0;
  x.forEach((w) => { if (y.has(w)) shared++; });
  return shared / Math.min(x.size, y.size) >= 0.5;
}

export function answerUpdate(a: SolvedAnswer, existingReview: { needs_review: boolean; review_reason: string | null; review_source: string | null }) {
  const solverFlag = a.status === "cannot_answer" || a.confidence === "low" || !!a.review_reason;
  const keepExisting = existingReview.needs_review && existingReview.review_source !== "solver";
  const solverReason = solverFlag && a.review_reason && !(existingReview.review_reason && similarReasons(existingReview.review_reason, a.review_reason))
    ? a.review_reason : null;
  return {
    answer_status: a.status,
    correct_option: a.correct_option,
    answer_short: a.answer_short,
    answer_md: a.answer_md,
    explanation_md: a.explanation_md,
    final_answer: a.final_answer,
    answer_confidence: a.confidence,
    needs_review: keepExisting || solverFlag,
    review_reason: keepExisting
      ? [existingReview.review_reason, keepExisting ? solverReason : null].filter(Boolean).join(" ")
      : solverFlag ? (a.review_reason || (a.status === "cannot_answer" ? "The question could not be answered confidently." : "The AI was not fully confident in this answer.")) : null,
    review_source: keepExisting ? existingReview.review_source : solverFlag ? "solver" : null,
  };
}

async function solveNextBatch(db: Db, job: JobRow, token: string): Promise<boolean> {
  const size = batchSize(job.detail_level, job.attempts);
  const { data: rows, error } = await db
    .from("qps_questions")
    .select("*")
    .eq("job_id", job.id)
    .eq("answer_status", "pending")
    .order("order_index")
    .limit(size);
  if (error) throw new Error(`Could not load questions: ${error.message}`);
  const batch = (rows ?? []) as QuestionRowDb[];

  if (batch.length === 0) {
    await patch(db, job.id, token, { status: "finalizing", stage: "formatting", progress: 92, attempts: 0 });
    return true;
  }

  let result: Awaited<ReturnType<typeof solveQuestions>>;
  try {
    result = await solveQuestions(db, job, batch);
  } catch (err) {
    // A failing batch is retried smaller (attempts halves the batch size)
    // until it is a single question. A single question that keeps failing,
    // or is declined, is flagged and skipped so it can't stall the paper.
    if (err instanceof AIError && !err.retryable && err.status === 401) throw err; // config problem: fail the job
    const message = (err as Error)?.message ?? String(err);
    if (batch.length > 1) {
      await patch(db, job.id, token, { attempts: job.attempts + 1 });
      await log(db, job.id, "warn", "solve.batch_retry", { size: batch.length, message });
      return true;
    }
    const q = batch[0];
    const retryable = !(err instanceof AIError) || err.retryable;
    if (!retryable || q.solve_attempts + 1 >= MAX_SOLVE_ATTEMPTS_PER_QUESTION) {
      await markFailed(db, q, "The AI could not generate an answer for this question. Try regenerating it, or answer it manually.");
      await log(db, job.id, "warn", "solve.question_failed", { questionId: q.id, message });
    } else {
      await db.from("qps_questions").update({ solve_attempts: q.solve_attempts + 1 }).eq("id", q.id);
      await log(db, job.id, "warn", "solve.question_retry", { questionId: q.id, message });
    }
    return true;
  }

  for (const q of batch) {
    const a = result.matched.get(q.id);
    if (a) {
      const { error: upErr } = await db.from("qps_questions").update(answerUpdate(a, q)).eq("id", q.id);
      if (upErr) throw new Error(`Could not save answer: ${upErr.message}`);
    } else if (q.solve_attempts + 1 >= MAX_SOLVE_ATTEMPTS_PER_QUESTION) {
      await markFailed(db, q, "The AI did not return an answer for this question. Try regenerating it, or answer it manually.");
    } else {
      await db.from("qps_questions").update({ solve_attempts: q.solve_attempts + 1 }).eq("id", q.id);
    }
  }

  const counts = await questionCounts(db, job.id);
  await addUsage(db, job, token, result.usage, result.model, {
    attempts: 0,
    solved_questions: counts.done,
    flagged_questions: counts.flagged,
    progress: Math.min(90, 40 + Math.round((50 * counts.done) / Math.max(1, counts.total))),
  });
  if (result.missing.length) await log(db, job.id, "warn", "solve.missing_answers", { ids: result.missing });
  return true;
}

async function markFailed(db: Db, q: QuestionRowDb, reason: string) {
  await db.from("qps_questions").update({
    answer_status: "failed",
    needs_review: true,
    review_reason: [q.needs_review && q.review_source !== "solver" ? q.review_reason : null, reason].filter(Boolean).join(" "),
    review_source: q.needs_review && q.review_source !== "solver" ? q.review_source : "solver",
  }).eq("id", q.id);
}

export async function questionCounts(db: Db, jobId: string) {
  const { data } = await db.from("qps_questions").select("answer_status, needs_review").eq("job_id", jobId);
  const rows = (data ?? []) as Array<{ answer_status: string; needs_review: boolean }>;
  return {
    total: rows.length,
    done: rows.filter((r) => r.answer_status !== "pending").length,
    flagged: rows.filter((r) => r.needs_review).length,
  };
}

async function finalize(db: Db, job: JobRow, token: string) {
  const counts = await questionCounts(db, job.id);
  await patch(db, job.id, token, {
    status: "completed",
    stage: "done",
    progress: 100,
    total_questions: counts.total,
    solved_questions: counts.done,
    flagged_questions: counts.flagged,
    completed_at: new Date().toISOString(),
    attempts: 0,
    ai_model: job.ai_model ?? QPS_MODEL,
  });
  await log(db, job.id, "info", "job.completed", { ...counts, inputTokens: job.ai_input_tokens, outputTokens: job.ai_output_tokens });
}

/** Jobs whose lease expired mid-run (the invocation died). Used by poll + cron. */
export function isStalled(job: Pick<JobRow, "status" | "locked_until" | "updated_at">): boolean {
  if (!["queued", "extracting", "solving", "finalizing"].includes(job.status)) return false;
  const now = Date.now();
  if (job.locked_until && new Date(job.locked_until).getTime() > now) return false;
  // Not locked, and nothing has happened for a while: nobody is working on it.
  return now - new Date(job.updated_at).getTime() > 20_000;
}
