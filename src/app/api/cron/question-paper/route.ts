// GET /api/cron/question-paper — daily housekeeping for the Question Paper
// Solver. Called by Vercel Cron with Authorization: Bearer $CRON_SECRET.
//   1. Retention: deletes uploaded papers, extracted images and exports
//      older than RETENTION_DAYS (answers stay viewable and re-exportable).
//   2. Abandoned uploads: cancels jobs stuck in awaiting_upload for > 1 day.
//   3. Recovery: restarts any job whose worker died.

import { createServiceClient } from "@/lib/supabase/service";
import { verifyBearer } from "@/lib/seo-agent/publishing/auth";
import { ACTIVE_STATUSES, RETENTION_DAYS } from "@/lib/question-paper/constants";
import { removeJobFiles } from "@/lib/question-paper/storage";
import { isStalled, kickWorker, log } from "@/lib/question-paper/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  const origin = new URL(request.url).origin;
  const result = { purged: 0, abandoned: 0, restarted: 0, errors: 0 };

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
  const { data: old } = await db.from("qps_jobs").select("id, user_id")
    .lt("created_at", cutoff).is("source_deleted_at", null).not("status", "in", `(${ACTIVE_STATUSES.join(",")})`).limit(500);
  for (const j of old ?? []) {
    try {
      await removeJobFiles(db, j.user_id, j.id);
      await db.from("qps_jobs").update({
        source_deleted_at: new Date().toISOString(),
        export_pdf_path: null, export_pdf_version: null, export_docx_path: null, export_docx_version: null,
        source_markdown: null, source_images: null, extraction: [],
      }).eq("id", j.id);
      result.purged++;
    } catch (err) {
      result.errors++;
      await log(db, j.id, "error", "retention.failed", { message: (err as Error).message });
    }
  }

  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const { data: abandoned } = await db.from("qps_jobs").select("id, user_id").eq("status", "awaiting_upload").lt("created_at", dayAgo).limit(500);
  for (const j of abandoned ?? []) {
    await removeJobFiles(db, j.user_id, j.id).catch(() => undefined);
    await db.from("qps_jobs").update({ status: "cancelled", source_deleted_at: new Date().toISOString() }).eq("id", j.id);
    result.abandoned++;
  }

  const { data: running } = await db.from("qps_jobs").select("id, status, locked_until, updated_at").in("status", ACTIVE_STATUSES as string[]).limit(100);
  for (const j of running ?? []) {
    if (isStalled(j)) {
      await kickWorker(origin, j.id);
      result.restarted++;
    }
  }

  return Response.json({ ok: true, ...result });
}
