import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/auth";
import { asAuditLog } from "@/lib/supabase/types-helper";
import type { AdminAuditLogRow } from "@/types/database";

/**
 * Records an administrative action. Call after the action succeeds, from
 * inside a requireAdmin()-gated server action. Never pass secrets/passwords
 * in `metadata`.
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  const service = createServiceClient();
  await service.from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    metadata,
  });
}

export async function listRecentAuditLog(limit = 25): Promise<(AdminAuditLogRow & { admin_name: string | null })[]> {
  await requireAdmin();
  const service = createServiceClient();
  const { data } = await service
    .from("admin_audit_log")
    .select("*, admin:profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = asAuditLog(data) as (AdminAuditLogRow & { admin?: { full_name: string } | null })[];
  return rows.map((r) => ({ ...r, admin_name: r.admin?.full_name ?? null }));
}
