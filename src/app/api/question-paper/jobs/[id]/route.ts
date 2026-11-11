// GET    /api/question-paper/jobs/:id — status (polled while processing) and,
//        with ?questions=1, the questions and answers.
// DELETE /api/question-paper/jobs/:id — cancels if running, then deletes the
//        job, its answers and every stored file.

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HttpError, assertUuid, handle, json, originOf, requireUser } from "@/lib/question-paper/server";
import { removeJobFiles } from "@/lib/question-paper/storage";
import { PUBLIC_JOB_COLUMNS, PUBLIC_QUESTION_COLUMNS, type JobRow } from "@/lib/question-paper/types";
import { isStalled, kickWorker } from "@/lib/question-paper/worker";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    assertUuid(id);
    await requireUser();
    const supabase = await createClient();
    // RLS returns the row only to its owner (or a platform admin).
    const { data } = await supabase.from("qps_jobs").select(`${PUBLIC_JOB_COLUMNS}, locked_until`).eq("id", id).maybeSingle();
    if (!data) throw new HttpError(404, "Question paper not found.");
    const { locked_until, ...job } = data as unknown as JobRow;

    // Self-healing: if the worker died mid-step, restart it.
    if (isStalled({ status: job.status, locked_until, updated_at: job.updated_at })) {
      const origin = originOf(request);
      after(() => kickWorker(origin, id));
    }

    let questions: unknown[] | undefined;
    if (new URL(request.url).searchParams.get("questions") === "1") {
      const { data: rows, error } = await supabase.from("qps_questions").select(PUBLIC_QUESTION_COLUMNS).eq("job_id", id).order("order_index");
      if (error) throw new Error(error.message);
      questions = rows ?? [];
    }
    return json({ job, questions });
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    assertUuid(id);
    const { user } = await requireUser();
    const db = createServiceClient();
    const { data } = await db.from("qps_jobs").select("id, user_id").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!data) throw new HttpError(404, "Question paper not found.");
    // Stop the worker first (its writes are conditional on an active status).
    await db.from("qps_jobs").update({ status: "cancelled" }).eq("id", id);
    await removeJobFiles(db, user.id, id);
    const { error } = await db.from("qps_jobs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return json({ ok: true });
  });
}
