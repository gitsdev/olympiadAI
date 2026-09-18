import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/auth";
import { ADMIN_PAGE_SIZE, pageRange } from "@/lib/admin/pagination";
import type { AdminAiTutorUsageRow, AdminAiTutorAnalyticsRow } from "@/types/admin";
import type { AIConversationRow } from "@/types/database";

export async function listAiTutorUsage(search: string | undefined, sort: string | undefined, page: number) {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_list_ai_tutor_usage", {
    p_search: search || null,
    p_sort: sort || "last_session_desc",
    p_page: page,
    p_page_size: ADMIN_PAGE_SIZE,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AdminAiTutorUsageRow[];
  return { rows, totalCount: rows[0]?.total_count ?? 0 };
}

export async function getAiTutorAnalytics(from: Date, to: Date) {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_ai_tutor_analytics", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminAiTutorAnalyticsRow[];
}

export async function getStudentAiSessions(studentId: string, page: number) {
  await requireAdmin();
  const service = createServiceClient();
  const [from, to] = pageRange(page);
  const { data, error, count } = await service
    .from("ai_conversations")
    .select("id, subject, topic_name, messages, created_at, updated_at", { count: "exact" })
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as AIConversationRow[], totalCount: count ?? 0 };
}

/** Full conversation for the chat-style viewer. Never call this outside a requireAdmin()-gated path. */
export async function getConversationById(conversationId: string): Promise<(AIConversationRow & { student_name: string }) | null> {
  await requireAdmin();
  const service = createServiceClient();
  const { data } = await service
    .from("ai_conversations")
    .select("*, student:students(profile:profiles(full_name))")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data) return null;
  const row = data as AIConversationRow & { student: { profile: { full_name: string } | null } | null };
  return { ...row, student_name: row.student?.profile?.full_name ?? "Unknown student" };
}
