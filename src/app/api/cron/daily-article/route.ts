// GET /api/cron/daily-article: prepares tomorrow's article (spec §20), then
// publishes anything that's due. Called by Vercel Cron with
// Authorization: Bearer $CRON_SECRET (see vercel.json).

import { createServiceClient } from "@/lib/supabase/service";
import { verifyBearer } from "@/lib/seo-agent/publishing/auth";
import { prepareTomorrowsArticle, publishDueArticles, runCronJob } from "@/lib/seo-agent/cron/jobs";
import { seoLog } from "@/lib/seo-agent/logger";

export const dynamic = "force-dynamic";
// Planning + writing + SEO check takes ~2–3 minutes; 300 s is the limit on every Vercel plan.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    seoLog.warn("cron.unauthorized", { path: "daily-article" });
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  const actor = { createdBy: null, triggeredBy: "CRON" as const };
  const article = await runCronJob(db, "daily-article", () => prepareTomorrowsArticle(db, actor));
  // A second daily publishing window (useful on Vercel Hobby, where crons run once a day).
  const publish = await runCronJob(db, "publish-scheduled", () => publishDueArticles(db, actor));
  return Response.json({ ok: article.ok && publish.ok, article, publish });
}
