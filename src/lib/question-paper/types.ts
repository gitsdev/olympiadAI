// Row shapes for the qps_ tables (hand-written, like src/types/database.ts).

import type { AnswerStatus, Confidence, DetailLevel, ExamType, FileExt, JobStatus, QuestionType, Stage } from "./constants";

export interface JobRow {
  id: string;
  user_id: string;
  file_name: string;
  file_ext: FileExt;
  mime_type: string;
  file_size: number;
  storage_path: string;
  page_count: number | null;
  is_scanned: boolean | null;
  class_level: number | null;
  board: string | null;
  subject: string | null;
  exam_type: ExamType | null;
  detail_level: DetailLevel;
  auto_detect: boolean;
  detected_meta: { title?: string | null; class_level?: number | null; board?: string | null; subject?: string | null; exam_type?: string | null } | null;
  status: JobStatus;
  stage: Stage;
  progress: number;
  total_questions: number;
  solved_questions: number;
  flagged_questions: number;
  extract_cursor: number;
  extract_chunks: number;
  attempts: number;
  locked_until: string | null;
  lock_token: string | null;
  last_error: string | null;
  source_markdown: string | null;
  source_images: Array<{ id: string; path: string | null; mime: string; supported: boolean }> | null;
  extraction: Array<{ pageOffset: number; result: unknown }>;
  answers_version: number;
  export_pdf_path: string | null;
  export_pdf_version: number | null;
  export_docx_path: string | null;
  export_docx_version: number | null;
  ai_model: string | null;
  ai_input_tokens: number;
  ai_output_tokens: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  source_deleted_at: string | null;
}

export interface QuestionRowDb {
  id: string;
  job_id: string;
  user_id: string;
  order_index: number;
  section: string | null;
  number_label: string;
  type: QuestionType;
  context_md: string | null;
  question_md: string;
  options: Array<{ label: string; text: string }> | null;
  match_pairs: { left: string[]; right: string[] } | null;
  has_diagram: boolean;
  diagram_description: string | null;
  image_refs: string[];
  source_pages: number[];
  marks: number | null;
  extraction_confidence: Confidence;
  needs_review: boolean;
  review_reason: string | null;
  review_source: "extraction" | "solver" | "user" | null;
  answer_status: AnswerStatus;
  answer_short: string | null;
  correct_option: string | null;
  answer_md: string | null;
  explanation_md: string | null;
  final_answer: string | null;
  answer_confidence: Confidence | null;
  edited_by_user: boolean;
  regen_count: number;
  solve_attempts: number;
  created_at: string;
  updated_at: string;
}

/** Columns safe to send to the browser (no internal worker/extraction state). */
export const PUBLIC_JOB_COLUMNS =
  "id, file_name, file_ext, file_size, page_count, is_scanned, class_level, board, subject, exam_type, detail_level, auto_detect, detected_meta, status, stage, progress, total_questions, solved_questions, flagged_questions, last_error, answers_version, ai_model, created_at, updated_at, completed_at, source_deleted_at";

export type PublicJob = Pick<JobRow,
  "id" | "file_name" | "file_ext" | "file_size" | "page_count" | "is_scanned" | "class_level" | "board" | "subject" | "exam_type" |
  "detail_level" | "auto_detect" | "detected_meta" | "status" | "stage" | "progress" | "total_questions" | "solved_questions" |
  "flagged_questions" | "last_error" | "answers_version" | "ai_model" | "created_at" | "updated_at" | "completed_at" | "source_deleted_at">;

export const PUBLIC_QUESTION_COLUMNS =
  "id, order_index, section, number_label, type, context_md, question_md, options, match_pairs, has_diagram, diagram_description, source_pages, marks, extraction_confidence, needs_review, review_reason, review_source, answer_status, answer_short, correct_option, answer_md, explanation_md, final_answer, answer_confidence, edited_by_user, regen_count, updated_at";

export type PublicQuestion = Pick<QuestionRowDb,
  "id" | "order_index" | "section" | "number_label" | "type" | "context_md" | "question_md" | "options" | "match_pairs" |
  "has_diagram" | "diagram_description" | "source_pages" | "marks" | "extraction_confidence" | "needs_review" | "review_reason" |
  "review_source" | "answer_status" | "answer_short" | "correct_option" | "answer_md" | "explanation_md" | "final_answer" |
  "answer_confidence" | "edited_by_user" | "regen_count" | "updated_at">;
