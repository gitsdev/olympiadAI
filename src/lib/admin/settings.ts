import { createServiceClient } from "@/lib/supabase/service";
import { asAdminSettings } from "@/lib/supabase/types-helper";
import type { AdminSettingsRow } from "@/types/database";

const FALLBACK: AdminSettingsRow = {
  id: 1,
  inactive_days_warning: 7,
  inactive_days_critical: 30,
  low_score_threshold: 40,
  low_ai_engagement_sessions: 1,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

/** Configurable thresholds — never hard-code these in dashboard/queries. */
export async function getAdminSettings(): Promise<AdminSettingsRow> {
  const service = createServiceClient();
  const { data } = await service.from("admin_settings").select("*").eq("id", 1).maybeSingle();
  return asAdminSettings(data) ?? FALLBACK;
}
