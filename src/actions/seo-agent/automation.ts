"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { prepareTomorrowsArticle, publishDueArticles, runCronJob, type JobResult } from "@/lib/seo-agent/cron/jobs";

// "Run now" buttons for the scheduled jobs. Same code as the cron routes,
// recorded as triggered by this admin. The jobs need the service role for
// their database locks; access is gated by requireAdmin().

export async function runDailyArticleNow(): Promise<JobResult> {
  const admin = await requireAdmin();
  const db = createServiceClient();
  const r = await runCronJob(db, "daily-article (manual)", () => prepareTomorrowsArticle(db, { createdBy: admin.id, triggeredBy: "USER" }));
  revalidatePath("/admin/seo-agent", "layout");
  return r;
}

export async function runPublishDueNow(): Promise<JobResult> {
  const admin = await requireAdmin();
  const db = createServiceClient();
  const r = await runCronJob(db, "publish-scheduled (manual)", () => publishDueArticles(db, { createdBy: admin.id, triggeredBy: "USER" }));
  revalidatePath("/admin/seo-agent", "layout");
  revalidatePath("/blog", "layout");
  return r;
}
