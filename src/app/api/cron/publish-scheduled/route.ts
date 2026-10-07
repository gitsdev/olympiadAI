// GET /api/cron/publish-scheduled: publishes SCHEDULED articles whose time has come.
// Called by Vercel Cron with Authorization: Bearer $CRON_SECRET (see vercel.json).

import { createServiceClient } from "@/lib/supabase/service";
import { verifyBearer } from "@/lib/seo-agent/publishing/auth";
import { publishDueArticles, runCronJob } from "@/lib/seo-agent/cron/jobs";
import { seoLog } from "@/lib/seo-agent/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    seoLog.warn("cron.unauthorized", { path: "publish-scheduled" });
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  const result = await runCronJob(db, "publish-scheduled", () => publishDueArticles(db, { createdBy: null, triggeredBy: "CRON" }));
  // 200 even on job failure: the failure is logged, and the next scheduled run continues normally.
  return Response.json(result);
}
