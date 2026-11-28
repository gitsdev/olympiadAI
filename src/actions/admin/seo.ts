"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runSiteAudit, saveSiteAudit } from "@/lib/admin/site-audit";

export type SiteAuditActionResult =
  | { ok: true; score: number; pages: number; issues: number }
  | { ok: false; error: string };

/** "Update score" on /admin/seo: audits the live site and saves the result. */
export async function updateSiteSeoScore(): Promise<SiteAuditActionResult> {
  const admin = await requireAdmin();

  // With maintenance mode on, every page is the maintenance screen, so the score would be meaningless.
  const { data: status } = await createServiceClient().from("site_status").select("maintenance_mode").eq("id", 1).maybeSingle();
  if ((status as { maintenance_mode?: boolean } | null)?.maintenance_mode) {
    return { ok: false, error: "Maintenance mode is on, so the site only shows the maintenance page. Turn it off, then update the score." };
  }

  try {
    const run = await runSiteAudit();
    await saveSiteAudit(await createClient(), run, admin.id);
    await logAdminAction(admin.id, "seo_site_audit", "seo_site_audits", null, { score: run.score, pages: run.pages.length });
    revalidatePath("/admin/seo");
    return { ok: true, score: run.score, pages: run.pages.length, issues: run.issues.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: /seo_site_audits/.test(message) ? `${message}. Has migration 026 been run?` : message };
  }
}
