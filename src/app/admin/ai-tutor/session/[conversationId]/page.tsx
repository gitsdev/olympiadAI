import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getConversationById } from "@/lib/admin/ai-tutor";
import { AdminShell } from "@/components/admin/AdminShell";
import { AITutorConversation } from "@/components/admin/AITutorConversation";
import { OACard } from "@/components/ui";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function AiTutorSessionPage({ params }: PageProps) {
  const admin = await requireAdmin();
  const { conversationId } = await params;
  const conversation = await getConversationById(conversationId);
  if (!conversation) notFound();

  return (
    <AdminShell
      adminName={admin.fullName}
      title="AI Tutor Session"
      subtitle={`${conversation.student_name} · ${conversation.subject ?? "General"}${conversation.topic_name ? ` · ${conversation.topic_name}` : ""}`}
    >
      <div className="flex flex-col gap-4 max-w-3xl">
        <Link href={`/admin/students/${conversation.student_id}`} className="text-[13px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
          ← Back to {conversation.student_name}&apos;s profile
        </Link>
        <OACard>
          <AITutorConversation messages={conversation.messages} />
        </OACard>
      </div>
    </AdminShell>
  );
}
