// Answer generation: the per-batch schema, how a batch of questions is
// presented to Claude, and how replies are matched back to questions (by id,
// never by position).

import { z } from "zod";
import type { DetailLevel } from "./constants";

export const solveSchema = z.object({
  answers: z.array(z.object({
    question_id: z.string(),
    status: z.enum(["answered", "cannot_answer"]),
    correct_option: z.string().nullable(),
    answer_short: z.string(),
    answer_md: z.string(),
    explanation_md: z.string(),
    final_answer: z.string().nullable(),
    confidence: z.enum(["high", "medium", "low"]),
    review_reason: z.string().nullable(),
  })),
});
export type SolveResult = z.infer<typeof solveSchema>;
export type SolvedAnswer = SolveResult["answers"][number];

export interface SolvableQuestion {
  id: string;
  number_label: string;
  section: string | null;
  type: string;
  context_md: string | null;
  question_md: string;
  options: Array<{ label: string; text: string }> | null;
  match_pairs: { left: string[]; right: string[] } | null;
  has_diagram: boolean;
  diagram_description: string | null;
  image_refs: string[];
  source_pages: number[];
  marks: number | null;
  review_reason: string | null;
}

/** Questions per solve call, by detail level (more detail → fewer per call, to stay inside the time budget). */
export function batchSize(detail: DetailLevel, attempt: number): number {
  const base = detail === "short" ? 10 : detail === "detailed" ? 6 : 4;
  // A batch that timed out is retried smaller.
  return Math.max(1, base >> attempt);
}

/** Plain-text rendering of a batch for the user turn. */
export function renderBatch(questions: SolvableQuestion[]): string {
  const parts = questions.map((q) => {
    const lines = [
      `<question id="${q.id}">`,
      `Number: ${q.number_label}${q.section ? ` | Section: ${q.section}` : ""} | Type: ${q.type}${q.marks !== null ? ` | Marks: ${q.marks}` : ""}${q.source_pages.length ? ` | Page(s): ${q.source_pages.join(", ")}` : ""}`,
    ];
    if (q.context_md) lines.push(`Context:\n${q.context_md}`);
    lines.push(`Question:\n${q.question_md}`);
    if (q.options?.length) lines.push(`Options:\n${q.options.map((o) => `(${o.label}) ${o.text}`).join("\n")}`);
    if (q.match_pairs) {
      lines.push(`Column A:\n${q.match_pairs.left.map((l, i) => `${i + 1}. ${l}`).join("\n")}`);
      lines.push(`Column B:\n${q.match_pairs.right.map((r, i) => `${String.fromCharCode(97 + i)}. ${r}`).join("\n")}`);
    }
    if (q.has_diagram && q.diagram_description) lines.push(`Figure description: ${q.diagram_description}`);
    if (q.image_refs.length) lines.push(`Figures attached: ${q.image_refs.join(", ")}`);
    if (q.review_reason) lines.push(`Note from transcription: ${q.review_reason}`);
    lines.push("</question>");
    return lines.join("\n");
  });
  return `Answer each of these ${questions.length} question(s). Return one entry per question id.\n\n${parts.join("\n\n")}`;
}

/** Matches answers to questions by id; unknown ids are ignored, missing ones reported. */
export function matchAnswers(questionIds: string[], result: SolveResult): { matched: Map<string, SolvedAnswer>; missing: string[] } {
  const wanted = new Set(questionIds);
  const matched = new Map<string, SolvedAnswer>();
  for (const a of result.answers) {
    if (wanted.has(a.question_id) && !matched.has(a.question_id)) matched.set(a.question_id, a);
  }
  return { matched, missing: questionIds.filter((id) => !matched.has(id)) };
}
