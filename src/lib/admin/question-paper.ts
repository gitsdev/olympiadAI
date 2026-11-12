// Admin analytics for the AI Question Paper Solver (qps_* tables, migration
// 019). Reads with the service role; every exported loader calls
// requireAdmin() itself, like the rest of src/lib/admin.

import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/auth";
import { ADMIN_PAGE_SIZE, pageRange } from "@/lib/admin/pagination";
import { summarizeQps, type QpsJobLite, type QpsUsageLite } from "@/lib/admin/question-paper-stats";

/** Cap on jobs aggregated for one date range (keeps the page fast). */
const MAX_JOBS_IN_RANGE = 10_000;

const JOB_LITE_COLUMNS =
  "id, user_id, status, file_ext, is_scanned, page_count, class_level, board, subject, exam_type, detail_level, total_questions, solved_questions, flagged_questions, ai_model, ai_input_tokens, ai_output_tokens, created_at, started_at, completed_at";

export async function getQpsOverview(from: Date, to: Date) {
  await requireAdmin();
  const db = createServiceClient();
  const [jobsRes, usageRes] = await Promise.all([
    db.from("qps_jobs").select(JOB_LITE_COLUMNS)
      .gte("created_at", from.toISOString()).lte("created_at", to.toISOString())
      .order("created_at", { ascending: false }).limit(MAX_JOBS_IN_RANGE),
    db.from("qps_usage").select("user_id, kind, created_at")
      .gte("created_at", from.toISOString()).lte("created_at", to.toISOString())
      .limit(MAX_JOBS_IN_RANGE * 5),
  ]);
  if (jobsRes.error) throw new Error(jobsRes.error.message);
  if (usageRes.error) throw new Error(usageRes.error.message);
  const jobs = (jobsRes.data ?? []) as QpsJobLite[];
  const summary = summarizeQps(jobs, (usageRes.data ?? []) as QpsUsageLite[], from, to);

  const names = await profileNames(summary.topUsers.map((u) => u.userId));
  return {
    ...summary,
    topUsers: summary.topUsers.map((u) => ({ ...u, ...(names.get(u.userId) ?? { name: "Unknown user", email: "" }) })),
    truncated: jobs.length >= MAX_JOBS_IN_RANGE,
  };
}

export type QpsStatusFilter = "all" | "completed" | "processing" | "failed" | "abandoned";

export interface AdminQpsJobRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  file_name: string;
  file_ext: string;
  is_scanned: boolean | null;
  page_count: number | null;
  class_level: number | null;
  subject: string | null;
  exam_type: string | null;
  status: string;
  started_at: string | null;
  total_questions: number;
  flagged_questions: number;
  ai_model: string | null;
  ai_input_tokens: number;
  ai_output_tokens: number;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
}

/** PostgREST `or()` filters are comma/parenthesis-delimited; strip those from user input. */
function cleanSearch(q: string): string {
  return q.replace(/[,()*%\\]/g, " ").trim().slice(0, 100);
}

export async function listQpsJobs(opts: { q?: string; status?: string; page: number; from: Date; to: Date }) {
  await requireAdmin();
  const db = createServiceClient();
  const [a, b] = pageRange(opts.page);
  let query = db.from("qps_jobs")
    .select("id, user_id, file_name, file_ext, is_scanned, page_count, class_level, subject, exam_type, status, started_at, total_questions, flagged_questions, ai_model, ai_input_tokens, ai_output_tokens, last_error, created_at, completed_at", { count: "exact" })
    .gte("created_at", opts.from.toISOString()).lte("created_at", opts.to.toISOString());

  switch (opts.status as QpsStatusFilter) {
    case "completed": query = query.eq("status", "completed"); break;
    case "processing": query = query.in("status", ["queued", "extracting", "solving", "finalizing"]); break;
    case "failed": query = query.eq("status", "failed"); break;
    case "abandoned": query = query.in("status", ["awaiting_upload", "cancelled"]); break;
  }

  const q = opts.q ? cleanSearch(opts.q) : "";
  if (q) {
    const { data: people } = await db.from("profiles").select("id")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).limit(200);
    const ids = (people ?? []).map((p) => p.id as string);
    query = ids.length
      ? query.or(`file_name.ilike.%${q}%,user_id.in.(${ids.join(",")})`)
      : query.ilike("file_name", `%${q}%`);
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(a, b);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<AdminQpsJobRow, "user_name" | "user_email">[];
  const names = await profileNames(rows.map((r) => r.user_id));
  return {
    rows: rows.map((r): AdminQpsJobRow => ({
      ...r,
      user_name: names.get(r.user_id)?.name ?? "Unknown user",
      user_email: names.get(r.user_id)?.email ?? "",
    })),
    totalCount: count ?? 0,
  };
}

/** One paper with its event log and questions, for the admin detail page. */
export async function getQpsJobDetail(jobId: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const db = createServiceClient();
  const { data: job } = await db.from("qps_jobs")
    .select("id, user_id, file_name, file_ext, file_size, page_count, is_scanned, class_level, board, subject, exam_type, detail_level, auto_detect, detected_meta, status, stage, progress, total_questions, solved_questions, flagged_questions, attempts, last_error, answers_version, ai_model, ai_input_tokens, ai_output_tokens, created_at, updated_at, started_at, completed_at, source_deleted_at")
    .eq("id", jobId).maybeSingle();
  if (!job) return null;

  const [logs, questions, regens, names] = await Promise.all([
    db.from("qps_job_logs").select("id, level, event, detail, created_at").eq("job_id", jobId).order("created_at", { ascending: true }).limit(500),
    db.from("qps_questions").select("id, order_index, section, number_label, type, answer_status, answer_short, needs_review, review_reason, review_source, extraction_confidence, answer_confidence, edited_by_user, regen_count").eq("job_id", jobId).order("order_index"),
    db.from("qps_usage").select("kind").eq("job_id", jobId),
    profileNames([job.user_id as string]),
  ]);
  return {
    job,
    user: names.get(job.user_id as string) ?? { name: "Unknown user", email: "" },
    logs: logs.data ?? [],
    questions: questions.data ?? [],
    regenerations: {
      answers: (regens.data ?? []).filter((r) => r.kind === "regenerate_answer").length,
      sheets: (regens.data ?? []).filter((r) => r.kind === "regenerate_sheet").length,
    },
  };
}

async function profileNames(userIds: string[]): Promise<Map<string, { name: string; email: string }>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, { name: string; email: string }>();
  if (!ids.length) return out;
  const db = createServiceClient();
  const { data } = await db.from("profiles").select("id, full_name, email").in("id", ids);
  for (const p of data ?? []) out.set(p.id as string, { name: (p.full_name as string) || "Unnamed", email: (p.email as string) ?? "" });
  return out;
}

export { ADMIN_PAGE_SIZE };
