"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/service";
import { toCsv } from "@/lib/admin/csv";
import type { AdminStudentFilters, AdminTestAttemptFilters, AdminStudentListRow, AdminTestAttemptRow } from "@/types/admin";

// Admin-triggered, infrequent, bounded — a hard cap keeps a single export
// from ever pulling an unbounded number of rows into memory.
const EXPORT_CAP = 5000;

export async function exportStudentsCsv(filters: AdminStudentFilters): Promise<{ csv: string; truncated: boolean }> {
  const admin = await requireAdmin();
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
    p_page: 1,
    p_page_size: EXPORT_CAP,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AdminStudentListRow[];
  const csv = toCsv(
    ["Name", "Email", "Class", "Board", "Registered", "Last Active", "Status", "Mock Tests", "Avg Score", "AI Sessions", "Progress %"],
    rows.map((r) => [
      r.full_name, r.email, r.class_level, r.board, r.registered_at,
      r.last_active_at ?? "", r.account_status, r.mock_tests_taken,
      r.avg_score.toFixed(1), r.ai_sessions, r.overall_progress.toFixed(1),
    ])
  );

  await logAdminAction(admin.id, "data_exported", "students", null, { count: rows.length });
  return { csv, truncated: rows.length >= EXPORT_CAP };
}

export async function exportMockTestsCsv(filters: AdminTestAttemptFilters): Promise<{ csv: string; truncated: boolean }> {
  const admin = await requireAdmin();
  const service = createServiceClient();

  const { data, error } = await service.rpc("admin_list_test_attempts", {
    p_student_id: filters.studentId ?? null,
    p_class_level: filters.classLevel ?? null,
    p_subject: filters.subject ?? null,
    p_mock_test_id: filters.mockTestId ?? null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_score_min: filters.scoreMin ?? null,
    p_score_max: filters.scoreMax ?? null,
    p_status: filters.status ?? null,
    p_sort: filters.sort || "date_desc",
    p_page: 1,
    p_page_size: EXPORT_CAP,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AdminTestAttemptRow[];
  const csv = toCsv(
    ["Student", "Test", "Subject", "Class", "Started", "Completed", "Score", "Accuracy", "Correct", "Attempted", "Time (s)", "Status"],
    rows.map((r) => [
      r.student_name, r.test_title, r.subject, r.class_level, r.started_at,
      r.completed_at ?? "", r.score.toFixed(1), r.accuracy.toFixed(1),
      r.questions_correct, r.questions_attempted, r.total_time_seconds, r.status,
    ])
  );

  await logAdminAction(admin.id, "data_exported", "mock_tests", null, { count: rows.length });
  return { csv, truncated: rows.length >= EXPORT_CAP };
}
