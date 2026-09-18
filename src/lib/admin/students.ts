import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/auth";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";
import type {
  AdminStudentListRow, AdminStudentFilters, AdminStudentStats,
  AdminSubjectProgress, AdminTopicProgress, AdminActivityEvent,
} from "@/types/admin";
import type { StudentRow, ProfileRow, AchievementRow } from "@/types/database";

export async function listStudents(filters: AdminStudentFilters, page: number) {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_list_students", {
    p_search: filters.q || null,
    p_class_level: filters.classLevel ?? null,
    p_board: filters.board ?? null,
    p_account_status: filters.status ?? null,
    p_activity: filters.activity ?? null,
    p_registered_from: filters.registeredFrom || null,
    p_registered_to: filters.registeredTo || null,
    p_test_count_min: filters.testCountMin ?? null,
    p_test_count_max: filters.testCountMax ?? null,
    p_score_min: filters.scoreMin ?? null,
    p_score_max: filters.scoreMax ?? null,
    p_sort: filters.sort || "created_at_desc",
    p_page: page,
    p_page_size: ADMIN_PAGE_SIZE,
  });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AdminStudentListRow[];
  return { rows, totalCount: rows[0]?.total_count ?? 0 };
}

export interface AdminStudentProfile {
  student: StudentRow;
  profile: Pick<ProfileRow, "full_name" | "email" | "avatar_url" | "created_at">;
}

export async function getStudentById(studentId: string): Promise<AdminStudentProfile | null> {
  await requireAdmin();
  const service = createServiceClient();
  const { data } = await service
    .from("students")
    .select("*, profile:profiles(full_name, email, avatar_url, created_at)")
    .eq("id", studentId)
    .maybeSingle();

  if (!data) return null;
  const row = data as StudentRow & { profile: AdminStudentProfile["profile"] | null };
  if (!row.profile) return null;
  return { student: row, profile: row.profile };
}

export async function getStudentStats(studentId: string): Promise<AdminStudentStats | null> {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_student_stats", { p_student_id: studentId });
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as AdminStudentStats) ?? null;
}

export async function getStudentSubjectProgress(studentId: string): Promise<AdminSubjectProgress[]> {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_student_subject_progress", { p_student_id: studentId });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminSubjectProgress[];
}

export async function getStudentTopicProgress(studentId: string): Promise<AdminTopicProgress[]> {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_student_topic_progress", { p_student_id: studentId });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminTopicProgress[];
}

export async function getStudentActivity(studentId: string, limit = 30): Promise<AdminActivityEvent[]> {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_student_activity", { p_student_id: studentId, p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminActivityEvent[];
}

export async function getStudentAchievements(studentId: string): Promise<AchievementRow[]> {
  await requireAdmin();
  const service = createServiceClient();
  const { data } = await service.from("achievements").select("*").eq("student_id", studentId).order("earned_at", { ascending: false });
  return (data ?? []) as AchievementRow[];
}

export async function getStudentMockTests(studentId: string, page: number) {
  const { listTestAttempts } = await import("@/lib/admin/mock-tests");
  return listTestAttempts({ studentId }, page);
}
