// PATCH /api/question-paper/questions/:id — save a hand-edited answer, or
// mark/unmark a question for manual review.

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HttpError, assertUuid, handle, json, requireUser } from "@/lib/question-paper/server";
import { PUBLIC_QUESTION_COLUMNS } from "@/lib/question-paper/types";

export const dynamic = "force-dynamic";

const text = (max: number) => z.string().max(max).transform((s) => s.replace(/\u0000/g, ""));

const patchSchema = z.object({
  answer_md: text(20_000).optional(),
  explanation_md: text(30_000).optional(),
  answer_short: text(300).optional(),
  correct_option: text(20).nullable().optional(),
  final_answer: text(500).nullable().optional(),
  needs_review: z.boolean().optional(),
  review_reason: text(1000).nullable().optional(),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    assertUuid(id);
    const { user } = await requireUser();
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "That change couldn't be saved. Please check the text and try again.");
    const input = parsed.data;

    const supabase = await createClient();
    const { data: q } = await supabase.from("qps_questions").select("id, job_id, user_id, answer_status").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!q) throw new HttpError(404, "Question not found.");
    const { data: job } = await supabase.from("qps_jobs").select("status, answers_version").eq("id", q.job_id).single();
    if (job?.status !== "completed") throw new HttpError(409, "Please wait until the answer sheet has finished generating.");

    const editsAnswer = ["answer_md", "explanation_md", "answer_short", "correct_option", "final_answer"].some((k) => k in input);
    const update: Record<string, unknown> = {};
    for (const k of ["answer_md", "explanation_md", "answer_short", "correct_option", "final_answer"] as const) {
      if (k in input) update[k] = input[k];
    }
    if (editsAnswer) {
      update.edited_by_user = true;
      if (q.answer_status !== "answered" && (input.answer_md ?? "").trim()) update.answer_status = "answered";
    }
    if (input.needs_review !== undefined) {
      update.needs_review = input.needs_review;
      update.review_source = input.needs_review ? "user" : null;
      update.review_reason = input.needs_review ? (input.review_reason?.trim() || "Marked for review.") : null;
    }
    if (Object.keys(update).length === 0) throw new HttpError(400, "Nothing to save.");

    const db = createServiceClient();
    const { data: saved, error } = await db.from("qps_questions").update(update).eq("id", id).select(PUBLIC_QUESTION_COLUMNS).single();
    if (error) throw new Error(error.message);

    const { count: flagged } = await db.from("qps_questions").select("id", { count: "exact", head: true }).eq("job_id", q.job_id).eq("needs_review", true);
    const { count: answered } = await db.from("qps_questions").select("id", { count: "exact", head: true }).eq("job_id", q.job_id).neq("answer_status", "pending");
    await db.from("qps_jobs").update({
      answers_version: (job.answers_version as number) + 1,
      flagged_questions: flagged ?? 0,
      solved_questions: answered ?? 0,
    }).eq("id", q.job_id);
    return json({ question: saved });
  });
}
