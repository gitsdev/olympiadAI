// GET /api/cron/backlinks: rechecks tracked backlinks (spec §29), on the
// configured run day (Settings → Backlink checking; default weekly).
// Called by Vercel Cron with Authorization: Bearer $CRON_SECRET (see vercel.json).

import { createServiceClient } from "@/lib/supabase/service";
import { verifyBearer } from "@/lib/seo-agent/publishing/auth";
import { checkBacklinksJob, runCronJob } from "@/lib/seo-agent/cron/jobs";
import { seoLog } from "@/lib/seo-agent/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    seoLog.warn("cron.unauthorized", { path: "backlinks" });
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  const result = await runCronJob(db, "backlinks", () => checkBacklinksJob(db, { createdBy: null, triggeredBy: "CRON" }));
  return Response.json(result);
}
