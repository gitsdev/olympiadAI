import { Bot } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { formatZoned } from "@/lib/seo-agent/datetime";
import type { AgentTaskSummary } from "@/lib/seo-agent/dashboard-data";
import { StatusBadge } from "./StatusBadge";

export function AgentActivityList({ tasks, timezone }: { tasks: AgentTaskSummary[]; timezone: string }) {
  if (tasks.length === 0) {
    return <EmptyState Icon={Bot} title="No agent activity yet" description="Every AI operation will be logged here." />;
  }

  return (
    <ul className="flex flex-col divide-y divide-[var(--line-200)]">
      {tasks.map((t) => (
        <li key={t.id} className="py-2.5 flex items-start justify-between gap-3 text-[13px]">
          <div className="flex flex-col min-w-0">
            <span className="font-semibold truncate" style={{ color: "var(--ink-900)" }}>
              {t.agent_type} <span className="font-normal" style={{ color: "var(--fg-muted)" }}>· {t.task_type}</span>
            </span>
            {(t.error || t.output_summary) && (
              <span className="truncate" style={{ color: t.error ? "var(--danger-tx)" : "var(--fg-muted)" }}>
                {t.error ?? t.output_summary}
              </span>
            )}
            <span className="text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>{formatZoned(t.created_at, timezone)}</span>
          </div>
          <StatusBadge status={t.status} />
        </li>
      ))}
    </ul>
  );
}
