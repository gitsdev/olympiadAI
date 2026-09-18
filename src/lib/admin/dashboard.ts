import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/auth";
import type {
  AdminDashboardStats, AdminActivitySeriesPoint, AdminPlatformSubjectPerformance,
  AdminAttentionStudentRow,
} from "@/types/admin";

export async function getDashboardStats(from: Date, to: Date): Promise<AdminDashboardStats> {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_dashboard_stats", {
    p_from: from.toISOString(), p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return (data ?? [])[0] as AdminDashboardStats;
}

export async function getActivitySeries(from: Date, to: Date): Promise<AdminActivitySeriesPoint[]> {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_activity_series", {
    p_from: from.toISOString(), p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminActivitySeriesPoint[];
}

export async function getPlatformSubjectPerformance(from: Date, to: Date): Promise<AdminPlatformSubjectPerformance[]> {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_platform_subject_performance", {
    p_from: from.toISOString(), p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminPlatformSubjectPerformance[];
}

export async function getStudentsNeedingAttention(
  inactiveDays: number, lowScoreThreshold: number, lowAiSessions: number, page = 1,
): Promise<{ rows: AdminAttentionStudentRow[]; totalCount: number }> {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_students_needing_attention", {
    p_inactive_days: inactiveDays,
    p_low_score_threshold: lowScoreThreshold,
    p_low_ai_sessions: lowAiSessions,
    p_page: page,
    p_page_size: 20,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AdminAttentionStudentRow[];
  return { rows, totalCount: rows[0]?.total_count ?? 0 };
}
