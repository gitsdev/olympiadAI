// Pure aggregation for the admin Question Paper Solver page (no DB access,
// so it's unit-tested directly).

export interface QpsJobLite {
  id: string;
  user_id: string;
  status: string;
  file_ext: string;
  is_scanned: boolean | null;
  page_count: number | null;
  class_level: number | null;
  board: string | null;
  subject: string | null;
  exam_type: string | null;
  detail_level: string;
  total_questions: number;
  solved_questions: number;
  flagged_questions: number;
  ai_model: string | null;
  ai_input_tokens: number;
  ai_output_tokens: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface QpsUsageLite {
  user_id: string;
  kind: string;
  created_at: string;
}

/**
 * Anthropic list prices, USD per 1M tokens. Used only for an *estimate*:
 * recorded input tokens include prompt-cache reads, which are billed lower,
 * so real spend is at or below this figure. Unknown models → no estimate.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

const ACTIVE = new Set(["queued", "extracting", "solving", "finalizing"]);

export type QpsBucket = "completed" | "processing" | "failed" | "rejected" | "abandoned";

/**
 * completed  — answer sheet produced
 * processing — still running
 * failed     — accepted, then failed during processing
 * rejected   — upload refused by the server checks (bad/oversized/protected file)
 * abandoned  — never uploaded, or cancelled before starting
 */
export function bucketOf(job: Pick<QpsJobLite, "status" | "started_at">): QpsBucket {
  if (job.status === "completed") return "completed";
  if (ACTIVE.has(job.status)) return "processing";
  if (job.status === "failed") return job.started_at ? "failed" : "rejected";
  return "abandoned";
}

export function estimateCostUsd(model: string | null, input: number, output: number): number | null {
  const p = model ? MODEL_PRICING[model] : undefined;
  if (!p) return input === 0 && output === 0 ? 0 : null;
  return (input * p.input + output * p.output) / 1_000_000;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function countBy<T>(items: T[], key: (t: T) => string | null | undefined): Array<{ label: string; count: number }> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it) || "Not set";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, undefined, { numeric: true }));
}

/** Local YYYY-MM-DD (matches how the admin date filter builds its ranges). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function summarizeQps(jobs: QpsJobLite[], usage: QpsUsageLite[], from: Date, to: Date) {
  const buckets: Record<QpsBucket, number> = { completed: 0, processing: 0, failed: 0, rejected: 0, abandoned: 0 };
  for (const j of jobs) buckets[bucketOf(j)]++;

  // "Submitted" = the server accepted the file and started work on it.
  const submitted = jobs.filter((j) => j.started_at);
  const completed = jobs.filter((j) => j.status === "completed");
  const finished = buckets.completed + buckets.failed;

  const durationsMin = completed
    .filter((j) => j.started_at && j.completed_at)
    .map((j) => (new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime()) / 60_000)
    .filter((m) => m >= 0);

  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;
  let costKnown = true;
  for (const j of jobs) {
    inputTokens += j.ai_input_tokens;
    outputTokens += j.ai_output_tokens;
    const c = estimateCostUsd(j.ai_model, j.ai_input_tokens, j.ai_output_tokens);
    if (c === null) costKnown = false;
    else cost += c;
  }

  const questions = completed.reduce((s, j) => s + j.total_questions, 0);
  const flagged = completed.reduce((s, j) => s + j.flagged_questions, 0);

  // Daily submitted papers, zero-filled across the range (capped at a year).
  const series: Array<{ day: string; papers: number }> = [];
  const perDay = new Map<string, number>();
  for (const j of submitted) {
    const k = dayKey(new Date(j.created_at));
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; cursor <= to && i < 366; i++) {
    const k = dayKey(cursor);
    series.push({ day: k, papers: perDay.get(k) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const perUser = new Map<string, { papers: number; completed: number; questions: number }>();
  for (const j of submitted) {
    const u = perUser.get(j.user_id) ?? { papers: 0, completed: 0, questions: 0 };
    u.papers++;
    if (j.status === "completed") {
      u.completed++;
      u.questions += j.total_questions;
    }
    perUser.set(j.user_id, u);
  }
  const topUsers = [...perUser.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.papers - a.papers || b.questions - a.questions)
    .slice(0, 10);

  return {
    buckets,
    submitted: submitted.length,
    uniqueUsers: new Set(submitted.map((j) => j.user_id)).size,
    successRate: finished ? buckets.completed / finished : null,
    questions,
    flagged,
    flaggedRate: questions ? flagged / questions : null,
    avgQuestionsPerPaper: completed.length ? questions / completed.length : null,
    medianMinutes: median(durationsMin),
    pages: submitted.reduce((s, j) => s + (j.page_count ?? 0), 0),
    inputTokens,
    outputTokens,
    estimatedCostUsd: costKnown ? cost : null,
    costPerPaperUsd: costKnown && completed.length ? cost / completed.length : null,
    regenerations: {
      answers: usage.filter((u) => u.kind === "regenerate_answer").length,
      sheets: usage.filter((u) => u.kind === "regenerate_sheet").length,
    },
    series,
    breakdowns: {
      subject: countBy(submitted, (j) => j.subject),
      classLevel: countBy(submitted, (j) => (j.class_level ? `Class ${j.class_level}` : null)),
      examType: countBy(submitted, (j) => ({ school_exam: "School Exam", olympiad: "Olympiad", practice_test: "Practice Test" } as Record<string, string>)[j.exam_type ?? ""] ?? null),
      format: countBy(submitted, (j) => (j.file_ext === "docx" ? "Word (.docx)" : j.is_scanned ? "Scanned PDF" : "Text PDF")),
      detailLevel: countBy(submitted, (j) => ({ short: "Short", detailed: "Detailed", step_by_step: "Step-by-step" } as Record<string, string>)[j.detail_level] ?? j.detail_level),
    },
    topUsers,
  };
}

export type QpsSummary = ReturnType<typeof summarizeQps>;
