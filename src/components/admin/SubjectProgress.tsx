import { OAProgressBar } from "@/components/ui";
import { EmptyState } from "./EmptyState";
import { BarChart3 } from "lucide-react";
import type { AdminSubjectProgress, AdminPlatformSubjectPerformance } from "@/types/admin";

export function SubjectProgress({ rows }: { rows: AdminSubjectProgress[] }) {
  if (rows.length === 0) {
    return <EmptyState Icon={BarChart3} title="No subject data yet" description="Progress appears once the student completes tests or practice." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <div key={r.subject}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>{r.subject}</span>
            <span className="text-[12.5px] tabular-nums" style={{ color: "var(--fg-muted)" }}>
              {Math.round(r.progress_pct)}% mastery · {r.accuracy.toFixed(0)}% accuracy · {r.tests_completed} tests
            </span>
          </div>
          <OAProgressBar value={r.progress_pct} height={8} />
        </div>
      ))}
    </div>
  );
}

export function PlatformSubjectPerformance({ rows }: { rows: AdminPlatformSubjectPerformance[] }) {
  if (rows.length === 0) {
    return <EmptyState Icon={BarChart3} title="No mock-test data in this period" />;
  }
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <div key={r.subject}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>{r.subject}</span>
            <span className="text-[12.5px] tabular-nums" style={{ color: "var(--fg-muted)" }}>
              {r.avg_score.toFixed(0)}% avg · {r.attempts_count} attempts
            </span>
          </div>
          <OAProgressBar value={r.avg_score} height={8} />
        </div>
      ))}
    </div>
  );
}
