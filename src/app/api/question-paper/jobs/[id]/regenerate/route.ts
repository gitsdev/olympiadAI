// POST /api/question-paper/jobs/:id/regenerate — regenerates the whole
// answer sheet from the already-extracted questions (the paper is not
// re-read). Answers the user edited by hand are kept. Counts towards the
// daily paper limit.

import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ACTIVE_STATUSES } from "@/lib/question-paper/constants";
import { HttpError, assertJobQuota, getOwnedJob, handle, json, originOf, requireUser } from "@/lib/question-paper/server";
import { kickWorker, log } from "@/lib/question-paper/worker";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const { user, isAdmin } = await requireUser();
    const job = await getOwnedJob(id, user.id);
    if (job.status !== "completed") throw new HttpError(409, "Only a finished answer sheet can be regenerated.");
    await assertJobQuota(user.id, isAdmin);

    const db = createServiceClient();
    const { data: active } = await db.from("qps_jobs").select("id").eq("user_id", user.id).in("status", ACTIVE_STATUSES as string[]).limit(1);
    if (active?.length) throw new HttpError(409, "You already have a paper being solved. Please wait for it to finish.");

    // Reset every answer except hand-edited ones and unreadable placeholders.
    const { error: qErr } = await db.from("qps_questions")
      .update({
        answer_status: "pending", answer_short: null, correct_option: null, answer_md: null, explanation_md: null,
        final_answer: null, answer_confidence: null, solve_attempts: 0,
      })
      .eq("job_id", id)
      .eq("edited_by_user", false)
      .neq("question_md", "");
    if (qErr) throw new Error(qErr.message);
    // Clear solver-raised review flags; extraction and user flags stay.
    await db.from("qps_questions").update({ needs_review: false, review_reason: null, review_source: null })
      .eq("job_id", id).eq("edited_by_user", false).eq("review_source", "solver");

    const { error } = await db.from("qps_jobs").update({
      status: "solving", stage: "solving", progress: 40, attempts: 0, completed_at: null, last_error: null,
      answers_version: job.answers_version + 1,
    }).eq("id", id).eq("status", "completed");
    if (error) {
      if (/qps_jobs_one_active_per_user/.test(error.message)) throw new HttpError(409, "You already have a paper being solved. Please wait for it to finish.");
      throw new Error(error.message);
    }
    await db.from("qps_usage").insert({ user_id: user.id, kind: "regenerate_sheet", job_id: id });
    await log(db, id, "info", "job.regenerate", {});

    const origin = originOf(request);
    after(() => kickWorker(origin, id));
    return json({ ok: true });
  });
}
