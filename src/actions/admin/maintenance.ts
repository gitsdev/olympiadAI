"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/service";

export async function setMaintenanceMode(enabled: boolean, message: string | null) {
  const admin = await requireAdmin();
  const service = createServiceClient();

  const trimmed = message?.trim().slice(0, 500) || null;
  const { error } = await service
    .from("site_status")
    .update({ maintenance_mode: enabled, maintenance_message: trimmed, updated_by: admin.id })
    .eq("id", 1);

  if (error) return { error: error.message };

  await logAdminAction(admin.id, enabled ? "maintenance_enabled" : "maintenance_disabled", "site_status", null, {
    message: trimmed,
  });
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/settings");
  return { error: null };
}
