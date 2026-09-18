import Link from "next/link";
import { Sparkles } from "lucide-react";
import { EmptyState } from "./EmptyState";
import type { AIConversationRow } from "@/types/database";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function AITutorSessionList({ sessions, basePath = "/admin/ai-tutor" }: {
  sessions: AIConversationRow[]; basePath?: string;
}) {
  if (sessions.length === 0) {
    return <EmptyState Icon={Sparkles} title="No AI Tutor sessions yet" />;
  }

  return (
    <ul className="flex flex-col divide-y" style={{ borderColor: "var(--line-200)" }}>
      {sessions.map((s) => (
        <li key={s.id} className="py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href={`${basePath}/${s.id}`} className="font-semibold text-[13.5px] hover:underline" style={{ color: "var(--ink-900)" }}>
              {s.subject ?? "General"}{s.topic_name ? ` · ${s.topic_name}` : ""}
            </Link>
            <p className="text-[11.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
              {formatDateTime(s.created_at)} · {s.messages.length} messages
            </p>
          </div>
          <Link href={`${basePath}/${s.id}`} className="text-[12.5px] font-medium shrink-0 hover:underline" style={{ color: "var(--brand)" }}>
            View
          </Link>
        </li>
      ))}
    </ul>
  );
}
