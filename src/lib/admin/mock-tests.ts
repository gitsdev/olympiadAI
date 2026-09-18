import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/auth";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";
import type { AdminTestAttemptFilters, AdminTestAttemptRow } from "@/types/admin";
import type { AttemptAnswerRow, QuestionRow, QuestionOptionRow, TestAttemptRow, MockTestRow } from "@/types/database";

export async function listTestAttempts(filters: AdminTestAttemptFilters, page: number, pageSize = ADMIN_PAGE_SIZE) {
  await requireAdmin();
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
    p_page: page,
    p_page_size: pageSize,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AdminTestAttemptRow[];
  return { rows, totalCount: rows[0]?.total_count ?? 0 };
}

export interface AttemptDetail {
  attempt: TestAttemptRow;
  studentName: string;
  studentId: string;
  mockTest: MockTestRow | null;
  answers: (AttemptAnswerRow & { question: QuestionRow & { options: QuestionOptionRow[] } })[];
}

export async function getAttemptDetail(attemptId: string): Promise<AttemptDetail | null> {
  await requireAdmin();
  const service = createServiceClient();

  const { data: attemptData } = await service
    .from("test_attempts")
    .select("*, student:students(id, profile:profiles(full_name)), mock_test:mock_tests(*)")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attemptData) return null;

  type Raw = TestAttemptRow & {
    student: { id: string; profile: { full_name: string } | null } | null;
    mock_test: MockTestRow | null;
  };
  const raw = attemptData as Raw;

  const { data: answersData } = await service
    .from("attempt_answers")
    .select("*, question:questions(*, options:question_options(*))")
    .eq("attempt_id", attemptId)
    .order("created_at", { ascending: true });

  return {
    attempt: raw,
    studentId: raw.student?.id ?? raw.student_id,
    studentName: raw.student?.profile?.full_name ?? "Unknown student",
    mockTest: raw.mock_test,
    answers: (answersData ?? []) as AttemptDetail["answers"],
  };
}
