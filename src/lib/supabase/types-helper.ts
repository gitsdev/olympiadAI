/**
 * Cast helpers for Supabase query results.
 * Used because our hand-written Database type doesn't include Supabase's
 * internal `Relationships` field, so the generic inference falls to `never`.
 * Once we run `supabase gen types typescript` against a real project the
 * generated file replaces this approach.
 */
import type {
  ConceptRow, ResourceRow, QuestionRow, QuestionOptionRow,
  StudentRow, ProfileRow, TestAttemptRow, PerformanceMetricRow,
  StudyPlanRow, AchievementRow, AIConversationRow,
} from "@/types/database";

export function asConcepts(data: unknown): ConceptRow[] { return (data ?? []) as ConceptRow[]; }
export function asResources(data: unknown): ResourceRow[] { return (data ?? []) as ResourceRow[]; }
export function asQuestions(data: unknown): QuestionRow[] { return (data ?? []) as QuestionRow[]; }
export function asOptions(data: unknown): QuestionOptionRow[] { return (data ?? []) as QuestionOptionRow[]; }
export function asStudent(data: unknown): StudentRow | null { return data as StudentRow | null; }
export function asStudentWithProfile(data: unknown) {
  return data as (StudentRow & { profile: Pick<ProfileRow, "full_name" | "email" | "avatar_url"> | null }) | null;
}
export function asAttempt(data: unknown): TestAttemptRow | null { return data as TestAttemptRow | null; }
export function asMetrics(data: unknown): PerformanceMetricRow[] { return (data ?? []) as PerformanceMetricRow[]; }
export function asPlan(data: unknown): StudyPlanRow | null { return data as StudyPlanRow | null; }
export function asAchievements(data: unknown): AchievementRow[] { return (data ?? []) as AchievementRow[]; }
export function asConversation(data: unknown): AIConversationRow | null { return data as AIConversationRow | null; }
