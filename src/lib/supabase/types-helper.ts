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
  StudyPlanRow, AchievementRow, AIConversationRow, TopicPageRow,
  BlogPostRow, AdminSettingsRow, AdminAuditLogRow,
  BattleRow, BattleParticipantRow, BattleQuestionRow, BattleAnswerRow,
  StudentBattleStatsRow, BattleConfigRow,
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
export function asTopicPages(data: unknown): TopicPageRow[] { return (data ?? []) as TopicPageRow[]; }
export function asTopicPage(data: unknown): TopicPageRow | null { return data as TopicPageRow | null; }
export function asBlogPosts(data: unknown): BlogPostRow[] { return (data ?? []) as BlogPostRow[]; }
export function asBlogPost(data: unknown): BlogPostRow | null { return data as BlogPostRow | null; }
export function asAttempts(data: unknown): TestAttemptRow[] { return (data ?? []) as TestAttemptRow[]; }
export function asConversations(data: unknown): AIConversationRow[] { return (data ?? []) as AIConversationRow[]; }
export function asAdminSettings(data: unknown): AdminSettingsRow | null { return data as AdminSettingsRow | null; }
export function asAuditLog(data: unknown): AdminAuditLogRow[] { return (data ?? []) as AdminAuditLogRow[]; }
export function asBattle(data: unknown): BattleRow | null { return data as BattleRow | null; }
export function asBattleParticipants(data: unknown): BattleParticipantRow[] { return (data ?? []) as BattleParticipantRow[]; }
export function asBattleQuestions(data: unknown): BattleQuestionRow[] { return (data ?? []) as BattleQuestionRow[]; }
export function asBattleAnswers(data: unknown): BattleAnswerRow[] { return (data ?? []) as BattleAnswerRow[]; }
export function asBattleStats(data: unknown): StudentBattleStatsRow | null { return data as StudentBattleStatsRow | null; }
export function asBattleConfigs(data: unknown): BattleConfigRow[] { return (data ?? []) as BattleConfigRow[]; }
