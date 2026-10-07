"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { seoDb } from "@/lib/seo-agent/db";
import { errorMessage, seoLog } from "@/lib/seo-agent/logger";
import { seoSettingsSchema, settingsToRow } from "@/lib/seo-agent/settings-schema";

export type SaveSeoSettingsResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Validates and saves SEO Agent settings. `input` is untrusted client data. */
export async function saveSeoSettings(input: unknown): Promise<SaveSeoSettingsResult> {
  const admin = await requireAdmin();

  const parsed = seoSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Some settings are invalid. Check the highlighted fields.", fieldErrors };
  }

  try {
    const db = await seoDb();
    const { error } = await db
      .from("seo_settings")
      .update({ ...settingsToRow(parsed.data), updated_by: admin.id })
      .eq("id", 1);
    if (error) throw error;

    await logAdminAction(admin.id, "seo_settings_updated", "seo_settings", null, {
      publishingMode: parsed.data.publishingMode,
      aiModel: parsed.data.aiModel,
    });
  } catch (err) {
    seoLog.error("settings.save_failed", { adminId: admin.id, error: errorMessage(err) });
    return { ok: false, error: `Could not save settings: ${errorMessage(err)}` };
  }

  revalidatePath("/admin/seo-agent", "layout");
  return { ok: true };
}
