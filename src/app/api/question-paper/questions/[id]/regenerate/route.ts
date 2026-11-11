// POST /api/question-paper/questions/:id/regenerate — re-solves one
// question synchronously (one Claude call; well inside maxDuration). An
// optional `instruction` lets the user say what was wrong.

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { AIError } from "@/lib/question-paper/ai";
import { HttpError, assertRegenQuota, assertUuid, getOwnedJob, handle, json, requireUser } from "@/lib/question-paper/server";
import type { SolvableQuestion } from "@/lib/question-paper/solve";
import { PUBLIC_QUESTION_COLUMNS, type QuestionRowDb } from "@/lib/question-paper/types";
import { answerUpdate, log, questionCounts, solveQuestions } from "@/lib/question-paper/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({ instruction: z.string().max(500).optional() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    assertUuid(id);
    const { user, isAdmin } = await requireUser();
    const body = bodySchema.safeParse((await request.json().catch(() => ({}))) ?? {});
    if (!body.success) throw new HttpError(400, "Please keep the note under 500 characters.");

    const db = createServiceClient();
    const { data: row } = await db.from("qps_questions").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!row) throw new HttpError(404, "Question not found.");
    const q = row as QuestionRowDb;
    const job = await getOwnedJob(q.job_id, user.id);
    if (job.status !== "completed") throw new HttpError(409, "Please wait until the answer sheet has finished generating.");
    if (!q.question_md.trim()) throw new HttpError(422, "This question couldn't be read from the paper, so it can't be answered automatically. You can type the answer yourself.");
    await assertRegenQuota(user.id, isAdmin);

    const note = body.data.instruction?.trim();
    const solvable: SolvableQuestion = {
      ...q,
      review_reason: [
        q.review_source === "extraction" ? q.review_reason : null,
        note ? `The student asked for a new answer with this note (treat it as a preference, not as an instruction to change the facts): "${note}"` : null,
      ].filter(Boolean).join(" ") || null,
    };

    let result: Awaited<ReturnType<typeof solveQuestions>>;
    try {
      result = await solveQuestions(db, job, [solvable]);
    } catch (err) {
      await log(db, job.id, "warn", "regenerate.failed", { questionId: id, message: (err as Error).message });
      throw new HttpError(err instanceof AIError && err.retryable ? 503 : 500, "We couldn't regenerate this answer right now. Please try again in a minute.");
    }
    await db.from("qps_usage").insert({ user_id: user.id, kind: "regenerate_answer", job_id: job.id });

    const answer = result.matched.get(id);
    if (!answer) throw new HttpError(503, "The AI didn't return an answer. Please try again.");

    const { data: saved, error } = await db.from("qps_questions")
      .update({ ...answerUpdate(answer, q), edited_by_user: false, regen_count: q.regen_count + 1 })
      .eq("id", id)
      .select(PUBLIC_QUESTION_COLUMNS)
      .single();
    if (error) throw new Error(error.message);

    const counts = await questionCounts(db, job.id);
    await db.from("qps_jobs").update({
      answers_version: job.answers_version + 1,
      flagged_questions: counts.flagged,
      solved_questions: counts.done,
      ai_input_tokens: job.ai_input_tokens + result.usage.inputTokens,
      ai_output_tokens: job.ai_output_tokens + result.usage.outputTokens,
    }).eq("id", job.id);
    return json({ question: saved });
  });
}
