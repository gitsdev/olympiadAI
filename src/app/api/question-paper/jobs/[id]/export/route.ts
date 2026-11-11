// POST /api/question-paper/jobs/:id/export?format=pdf|docx — renders the
// answer sheet (or reuses the stored copy if no answer changed since) and
// returns a 5-minute signed download URL.

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { renderDocx } from "@/lib/question-paper/export-docx";
import { renderPdf } from "@/lib/question-paper/export-pdf";
import { HttpError, getOwnedJob, handle, json, requireUser } from "@/lib/question-paper/server";
import { buildSheet, exportFileName } from "@/lib/question-paper/sheet";
import { paths, signedDownloadUrl, uploadBytes } from "@/lib/question-paper/storage";
import { PUBLIC_QUESTION_COLUMNS, type PublicJob, type PublicQuestion } from "@/lib/question-paper/types";
import { log } from "@/lib/question-paper/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CONTENT_TYPE = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const format = new URL(request.url).searchParams.get("format");
    if (format !== "pdf" && format !== "docx") throw new HttpError(400, "Choose PDF or Word.");
    const { user } = await requireUser();
    const job = await getOwnedJob(id, user.id);
    if (job.status !== "completed") throw new HttpError(409, "The answer sheet isn't ready yet.");

    const db = createServiceClient();
    const downloadName = exportFileName(job.file_name, format);
    const storedPath = format === "pdf" ? job.export_pdf_path : job.export_docx_path;
    const storedVersion = format === "pdf" ? job.export_pdf_version : job.export_docx_version;
    if (storedPath && storedVersion === job.answers_version) {
      try {
        return json({ url: await signedDownloadUrl(db, storedPath, downloadName) });
      } catch {
        // Stored copy missing (e.g. retention cleanup): fall through and rebuild.
      }
    }

    const supabase = await createClient();
    const { data: questions, error } = await supabase.from("qps_questions").select(PUBLIC_QUESTION_COLUMNS).eq("job_id", id).order("order_index");
    if (error) throw new Error(error.message);
    const sheet = buildSheet(job as unknown as PublicJob, (questions ?? []) as unknown as PublicQuestion[]);

    let bytes: Uint8Array;
    try {
      bytes = format === "pdf" ? await renderPdf(sheet) : await renderDocx(sheet);
    } catch (err) {
      await log(db, id, "error", "export.failed", { format, message: (err as Error).message });
      throw new HttpError(500, `We couldn't create the ${format === "pdf" ? "PDF" : "Word"} file. Please try again.`);
    }

    const path = paths.export(user.id, id, job.answers_version, format);
    await uploadBytes(db, path, bytes, CONTENT_TYPE[format]);
    await db.from("qps_jobs").update(
      format === "pdf"
        ? { export_pdf_path: path, export_pdf_version: job.answers_version }
        : { export_docx_path: path, export_docx_version: job.answers_version },
    ).eq("id", id);
    return json({ url: await signedDownloadUrl(db, path, downloadName) });
  });
}
