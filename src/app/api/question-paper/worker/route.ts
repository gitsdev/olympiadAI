// POST /api/question-paper/worker — internal. Processes one job in the
// background (see src/lib/question-paper/worker.ts). Authenticated with
// QPS_WORKER_SECRET (falls back to CRON_SECRET); replies 202 immediately and
// does the work in after(), within this route's maxDuration.

import { after } from "next/server";
import { verifyBearer } from "@/lib/seo-agent/publishing/auth";
import { runWorker } from "@/lib/question-paper/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const secret = process.env.QPS_WORKER_SECRET || process.env.CRON_SECRET;
  if (!verifyBearer(request.headers.get("authorization"), secret)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { jobId?: string } | null;
  const jobId = body?.jobId;
  if (!jobId || !UUID.test(jobId)) return Response.json({ ok: false, error: "Bad request" }, { status: 400 });

  const origin = new URL(request.url).origin;
  after(async () => {
    try {
      await runWorker(jobId, origin);
    } catch (err) {
      console.error(JSON.stringify({ scope: "qps", jobId, event: "worker.crashed", message: (err as Error)?.message }));
    }
  });
  return Response.json({ ok: true }, { status: 202 });
}
