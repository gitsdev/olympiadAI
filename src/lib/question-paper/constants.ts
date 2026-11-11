// Shared constants for the AI Question Paper Solver. Client-safe: no secrets,
// no server imports. Enum lists mirror the CHECK constraints in
// supabase/migrations/019_question_paper_solver.sql.

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_PAGES = 40;
export const DAILY_JOB_LIMIT = 5;
export const DAILY_REGEN_LIMIT = 30;
export const RETENTION_DAYS = 30;

export const ACCEPTED_EXTENSIONS = ["pdf", "docx"] as const;
export type FileExt = (typeof ACCEPTED_EXTENSIONS)[number];

export const MIME_BY_EXT: Record<FileExt, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const BOARDS = ["CBSE", "ICSE", "Other"] as const;
export const SUBJECTS = ["Mathematics", "Science", "English", "General Knowledge", "Social Studies", "Other"] as const;

export const EXAM_TYPES = [
  { value: "school_exam", label: "School Exam" },
  { value: "olympiad", label: "Olympiad" },
  { value: "practice_test", label: "Practice Test" },
] as const;
export type ExamType = (typeof EXAM_TYPES)[number]["value"];

export const DETAIL_LEVELS = [
  { value: "short", label: "Short Answers", hint: "Just the answer with a one-line reason" },
  { value: "detailed", label: "Detailed Answers", hint: "Answer plus a clear explanation" },
  { value: "step_by_step", label: "Step-by-Step", hint: "Every step worked out in full" },
] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number]["value"];

export const JOB_STATUSES = [
  "awaiting_upload", "queued", "extracting", "solving", "finalizing", "completed", "failed", "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const ACTIVE_STATUSES: readonly JobStatus[] = ["queued", "extracting", "solving", "finalizing"];

/** The six user-visible processing stages, in order. */
export const STAGES = [
  { value: "reading", label: "Reading question paper" },
  { value: "extracting", label: "Extracting questions" },
  { value: "identifying", label: "Identifying question types" },
  { value: "solving", label: "Generating solutions" },
  { value: "formatting", label: "Formatting answer sheet" },
  { value: "finalizing", label: "Finalizing document" },
] as const;
export type Stage = (typeof STAGES)[number]["value"] | "done";

export const QUESTION_TYPES = [
  "mcq", "fill_blank", "match", "true_false", "short", "long", "numerical",
  "diagram", "comprehension", "assertion_reason", "other",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple choice",
  fill_blank: "Fill in the blanks",
  match: "Match the following",
  true_false: "True / False",
  short: "Short answer",
  long: "Long answer",
  numerical: "Numerical",
  diagram: "Diagram-based",
  comprehension: "Comprehension",
  assertion_reason: "Assertion & Reason",
  other: "Question",
};

export const CONFIDENCE = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export const ANSWER_STATUSES = ["pending", "answered", "cannot_answer", "failed"] as const;
export type AnswerStatus = (typeof ANSWER_STATUSES)[number];

export function examTypeLabel(v: string | null | undefined): string {
  return EXAM_TYPES.find((e) => e.value === v)?.label ?? "—";
}

export function detailLevelLabel(v: string | null | undefined): string {
  return DETAIL_LEVELS.find((d) => d.value === v)?.label ?? "—";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Printed label without a "Q"/"Question"/"No." prefix: "Q1" → "1", "Question 5(b)" → "5(b)". */
export function displayLabel(label: string): string {
  return label.trim().replace(/^(?:q(?:uestion)?|no)\.?\s*(?=[0-9ivxlc(])/i, "").replace(/[.:]$/, "") || label.trim();
}

/** "Question 5(b)", or the label itself for non-numbered rows ("Unreadable (page 2)"). */
export function questionHeading(label: string): string {
  return /^unreadable/i.test(label.trim()) ? label.trim() : `Question ${displayLabel(label)}`;
}

/** Lower-case extension of a file name, or "" if none. */
export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}
