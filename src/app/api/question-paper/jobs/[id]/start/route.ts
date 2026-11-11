// POST /api/question-paper/jobs/:id/start — called after the browser's
// upload finishes. Re-checks the stored file server-side (size, real format
// from its bytes, page count, password protection, macros), then queues the
// job and starts the background worker.

import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MAX_FILE_BYTES } from "@/lib/question-paper/constants";
import { FileRejectedError, verifyFileBytes } from "@/lib/question-paper/file-check";
import { EXTRACT_PAGES_PER_CHUNK, inspectPdf } from "@/lib/question-paper/pdf";
import { HttpError, assertJobQuota, getOwnedJob, handle, json, originOf, requireUser } from "@/lib/question-paper/server";
import { downloadBytes, objectSize, removeJobFiles } from "@/lib/question-paper/storage";
import { kickWorker, log } from "@/lib/question-paper/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const { user, isAdmin } = await requireUser();
    const job = await getOwnedJob(id, user.id);
    if (job.status !== "awaiting_upload") {
      // Double-click / retry after success: report the current state.
      return json({ ok: true, status: job.status });
    }
    await assertJobQuota(user.id, isAdmin);

    const db = createServiceClient();
    const fileName = job.storage_path.split("/").pop()!;
    const size = await objectSize(db, user.id, id, fileName);
    if (size === null) throw new HttpError(400, "The upload didn't finish. Please upload the file again.");

    const reject = async (message: string) => {
      await db.from("qps_jobs").update({ status: "failed", last_error: message }).eq("id", id);
      await removeJobFiles(db, user.id, id).catch(() => undefined);
      await log(db, id, "warn", "upload.rejected", { message });
      throw new HttpError(422, message);
    };

    if (size > MAX_FILE_BYTES) return reject("The file is larger than 15 MB.");

    let pageCount: number | null = null;
    let isScanned: boolean | null = null;
    try {
      const bytes = await downloadBytes(db, job.storage_path);
      await verifyFileBytes(bytes, job.file_ext);
      if (job.file_ext === "pdf") {
        const info = await inspectPdf(bytes);
        if (info.encrypted && info.pageCount > EXTRACT_PAGES_PER_CHUNK) {
          return reject(`This PDF is protected against editing, so only papers up to ${EXTRACT_PAGES_PER_CHUNK} pages can be read. Print it to a new PDF and upload that.`);
        }
        pageCount = info.pageCount;
        isScanned = info.isScanned;
      }
    } catch (err) {
      if (err instanceof FileRejectedError) return reject(err.message);
      throw err;
    }

    const { error } = await db.from("qps_jobs").update({
      status: "queued",
      stage: "reading",
      progress: 3,
      page_count: pageCount,
      is_scanned: isScanned,
      file_size: size || job.file_size,
      started_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", id).eq("status", "awaiting_upload");
    if (error) throw new Error(error.message);
    await log(db, id, "info", "job.queued", { ext: job.file_ext, pages: pageCount, scanned: isScanned, size });

    const origin = originOf(request);
    after(() => kickWorker(origin, id));
    return json({ ok: true, status: "queued", pageCount, isScanned });
  });
}
