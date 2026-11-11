// GET  /api/question-paper/jobs — the caller's recent papers.
// POST /api/question-paper/jobs — creates a job and returns a one-off signed
//      upload URL for the file. The browser uploads straight to private
//      Storage (no 4.5 MB serverless body limit), then calls /start.

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ACTIVE_STATUSES, BOARDS, DETAIL_LEVELS, EXAM_TYPES, MAX_FILE_BYTES, MIME_BY_EXT, extOf } from "@/lib/question-paper/constants";
import { sanitizeFileName } from "@/lib/question-paper/file-check";
import { HttpError, assertJobQuota, handle, json, requireUser } from "@/lib/question-paper/server";
import { createUploadUrl, paths, removeJobFiles } from "@/lib/question-paper/storage";
import { PUBLIC_JOB_COLUMNS } from "@/lib/question-paper/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  classLevel: z.number().int().min(1).max(10).nullable(),
  board: z.enum(BOARDS).nullable(),
  subject: z.string().trim().min(1).max(60).nullable(),
  examType: z.enum(EXAM_TYPES.map((e) => e.value) as [string, ...string[]]).nullable(),
  detailLevel: z.enum(DETAIL_LEVELS.map((d) => d.value) as [string, ...string[]]),
  autoDetect: z.boolean(),
});

export async function GET() {
  return handle(async () => {
    const { user } = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("qps_jobs")
      .select(PUBLIC_JOB_COLUMNS)
      .eq("user_id", user.id)
      .neq("status", "awaiting_upload")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return json({ jobs: data ?? [] });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { user, isAdmin } = await requireUser();
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Please check the paper details and try again.");
    const input = parsed.data;

    const ext = extOf(input.fileName);
    if (ext !== "pdf" && ext !== "docx") throw new HttpError(400, "Only PDF and Word (.docx) files are supported.");
    if (input.fileSize > MAX_FILE_BYTES) throw new HttpError(400, "The file is larger than 15 MB.");

    await assertJobQuota(user.id, isAdmin);

    const db = createServiceClient();
    // A previous upload that never started is replaced by this one.
    const { data: stale } = await db.from("qps_jobs").select("id").eq("user_id", user.id).eq("status", "awaiting_upload");
    for (const s of stale ?? []) {
      await removeJobFiles(db, user.id, s.id).catch(() => undefined);
      await db.from("qps_jobs").update({ status: "cancelled" }).eq("id", s.id);
    }
    const { data: active } = await db.from("qps_jobs").select("id").eq("user_id", user.id).in("status", ACTIVE_STATUSES as string[]).limit(1);
    if (active?.length) throw new HttpError(409, "You already have a paper being solved. Please wait for it to finish.");

    const jobId = crypto.randomUUID();
    const storagePath = paths.source(user.id, jobId, ext);
    const { error } = await db.from("qps_jobs").insert({
      id: jobId,
      user_id: user.id,
      file_name: sanitizeFileName(input.fileName),
      file_ext: ext,
      mime_type: MIME_BY_EXT[ext],
      file_size: input.fileSize,
      storage_path: storagePath,
      class_level: input.classLevel,
      board: input.board,
      subject: input.subject,
      exam_type: input.examType,
      detail_level: input.detailLevel,
      auto_detect: input.autoDetect,
      status: "awaiting_upload",
    });
    if (error) {
      if (/qps_jobs_one_active_per_user/.test(error.message)) throw new HttpError(409, "You already have a paper being solved. Please wait for it to finish.");
      throw new Error(error.message);
    }

    const upload = await createUploadUrl(db, storagePath);
    return json({ jobId, uploadUrl: upload.signedUrl }, 201);
  });
}
