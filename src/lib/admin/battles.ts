import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/auth";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/pagination";
import { asBattleQuestions, asBattleAnswers } from "@/lib/supabase/types-helper";
import type { AdminBattleFilters, AdminBattleRow } from "@/types/admin";
import type { BattleRow, BattleParticipantRow, BattleQuestionRow, BattleAnswerRow, StudentBattleStatsRow } from "@/types/database";

export async function listBattles(filters: AdminBattleFilters, page: number, pageSize = ADMIN_PAGE_SIZE) {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_list_battles", {
    p_student_id: filters.studentId ?? null,
    p_status: filters.status ?? null,
    p_mode: filters.mode ?? null,
    p_subject: filters.subject ?? null,
    p_class_level: filters.classLevel ?? null,
    p_result: filters.result ?? null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_sort: filters.sort || "date_desc",
    p_page: page,
    p_page_size: pageSize,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AdminBattleRow[];
  return { rows, totalCount: rows[0]?.total_count ?? 0 };
}

export interface BattleDetail {
  battle: BattleRow;
  studentId: string;
  studentName: string;
  humanParticipant: BattleParticipantRow;
  aiParticipant: BattleParticipantRow | null;
  questions: (BattleQuestionRow & { humanAnswer: BattleAnswerRow | null; aiAnswer: BattleAnswerRow | null })[];
}

export async function getBattleDetail(battleId: string): Promise<BattleDetail | null> {
  await requireAdmin();
  const service = createServiceClient();

  const { data: battleData } = await service
    .from("battles")
    .select("*, student:students(id, profile:profiles(full_name)), participants:battle_participants(*)")
    .eq("id", battleId)
    .maybeSingle();
  if (!battleData) return null;

  type Raw = BattleRow & {
    student: { id: string; profile: { full_name: string } | null } | null;
    participants: BattleParticipantRow[];
  };
  const raw = battleData as unknown as Raw;
  const humanParticipant = raw.participants.find((p) => !p.is_ai) ?? null;
  const aiParticipant = raw.participants.find((p) => p.is_ai) ?? null;
  if (!humanParticipant) return null;

  const { data: questionsData } = await service
    .from("battle_questions").select("*").eq("battle_id", battleId).order("order_index", { ascending: true });
  const questions = asBattleQuestions(questionsData);

  const { data: answersData } = await service.from("battle_answers").select("*").eq("battle_id", battleId);
  const answers = asBattleAnswers(answersData);

  return {
    battle: raw,
    studentId: raw.student?.id ?? humanParticipant.student_id!,
    studentName: raw.student?.profile?.full_name ?? "Unknown student",
    humanParticipant,
    aiParticipant,
    questions: questions.map((q) => ({
      ...q,
      humanAnswer: answers.find((a) => a.battle_question_id === q.id && a.participant_id === humanParticipant.id) ?? null,
      aiAnswer: aiParticipant ? answers.find((a) => a.battle_question_id === q.id && a.participant_id === aiParticipant.id) ?? null : null,
    })),
  };
}

/** Noted for a later student-detail-tabs embed — not wired into any page in Phase 1. */
export async function getStudentBattleSummary(studentId: string): Promise<StudentBattleStatsRow | null> {
  await requireAdmin();
  const service = createServiceClient();
  const { data } = await service.from("student_battle_stats").select("*").eq("student_id", studentId).maybeSingle();
  return (data as StudentBattleStatsRow | null) ?? null;
}
