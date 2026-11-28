"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/service";
import { seoDb } from "@/lib/seo-agent/db";
import { errorMessage, seoLog } from "@/lib/seo-agent/logger";
import { syncAdminSeoKeywords } from "@/lib/seo-agent/keyword-sync";
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

/** The autopilot switch on the dashboard. Turning it on also pulls in /admin/seo keywords straight away. */
export async function setAutopilotEnabled(enabled: boolean): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  if (typeof enabled !== "boolean") return { ok: false, error: "Invalid value." };
  try {
    const db = await seoDb();
    const { data, error } = await db.from("seo_settings").update({ automation_enabled: enabled, updated_by: admin.id }).eq("id", 1).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Settings row not found or not editable.");
    await logAdminAction(admin.id, enabled ? "seo_autopilot_enabled" : "seo_autopilot_disabled", "seo_settings", null, {});

    let message = enabled ? "Autopilot is on. The next run is tonight around 8 pm." : "Autopilot is off. Nothing will be written or published automatically.";
    if (enabled) {
      try {
        const sync = await syncAdminSeoKeywords(db, admin.id);
        if (sync.added) message += ` Added ${sync.added} keyword(s) from /admin/seo.`;
      } catch (err) {
        seoLog.warn("autopilot.enable_sync_failed", { error: errorMessage(err) });
      }
    }
    revalidatePath("/admin/seo-agent", "layout");
    return { ok: true, message };
  } catch (err) {
    seoLog.error("autopilot.toggle_failed", { error: errorMessage(err) });
    return { ok: false, error: `Could not change the autopilot: ${errorMessage(err)}. Has migration 026 been run?` };
  }
}

export async function runPublishDueNow(): Promise<JobResult> {
  const admin = await requireAdmin();
  const db = createServiceClient();
  const r = await runCronJob(db, "publish-scheduled (manual)", () => publishDueArticles(db, { createdBy: admin.id, triggeredBy: "USER" }));
  revalidatePath("/admin/seo-agent", "layout");
  revalidatePath("/blog", "layout");
  return r;
}
