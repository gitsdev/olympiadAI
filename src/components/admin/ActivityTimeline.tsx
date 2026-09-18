import { FileText, Sparkles, PencilLine, Clock } from "lucide-react";
import { EmptyState } from "./EmptyState";
import type { AdminActivityEvent } from "@/types/admin";

const ICONS: Record<AdminActivityEvent["activity_type"], React.ElementType> = {
  mock_test: FileText,
  practice: PencilLine,
  ai_tutor: Sparkles,
};

function label(e: AdminActivityEvent): string {
  switch (e.activity_type) {
    case "mock_test":
      return `Completed ${e.subject ?? "a"} mock test${typeof e.detail.score === "number" ? ` — ${Math.round(e.detail.score as number)}%` : ""}`;
    case "practice":
      return `Practiced ${e.topic_name ? `${e.topic_name} (${e.subject})` : e.subject ?? "a topic"}`;
    case "ai_tutor":
      return `AI Tutor session${e.subject ? ` — ${e.subject}` : ""}${typeof e.detail.message_count === "number" ? ` (${e.detail.message_count} messages)` : ""}`;
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today — ${time}`;
  if (isYesterday) return `Yesterday — ${time}`;
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function ActivityTimeline({ events }: { events: AdminActivityEvent[] }) {
  if (events.length === 0) {
    return <EmptyState Icon={Clock} title="No activity yet" description="This student hasn't taken any tests or used the AI Tutor yet." />;
  }

  return (
    <ol className="flex flex-col gap-4">
      {events.map((e, i) => {
        const Icon = ICONS[e.activity_type];
        return (
          <li key={i} className="flex gap-3">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--cobalt-50)" }}
              aria-hidden
            >
              <Icon size={15} style={{ color: "var(--cobalt-600)" }} />
            </span>
            <div className="min-w-0 pb-1">
              <p className="text-[13.5px] font-medium" style={{ color: "var(--ink-900)" }}>{label(e)}</p>
              <p className="text-[11.5px]" style={{ color: "var(--fg-muted)" }}>{formatWhen(e.occurred_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
