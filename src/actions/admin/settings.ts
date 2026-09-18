"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/service";

export async function updateAdminSettings(updates: {
  inactiveDaysWarning: number;
  inactiveDaysCritical: number;
  lowScoreThreshold: number;
  lowAiEngagementSessions: number;
}) {
  const admin = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service.from("admin_settings").update({
    inactive_days_warning: updates.inactiveDaysWarning,
    inactive_days_critical: updates.inactiveDaysCritical,
    low_score_threshold: updates.lowScoreThreshold,
    low_ai_engagement_sessions: updates.lowAiEngagementSessions,
    updated_by: admin.id,
  }).eq("id", 1);

  if (error) return { error: error.message };

  await logAdminAction(admin.id, "settings_updated", "admin_settings", null, { updates });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/progress");
  return { error: null };
}
