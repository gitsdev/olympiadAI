import { OAProgressBar } from "@/components/ui";
import { EmptyState } from "./EmptyState";
import { ListTree } from "lucide-react";
import type { AdminTopicProgress } from "@/types/admin";

export function TopicProgressTree({ rows }: { rows: AdminTopicProgress[] }) {
  if (rows.length === 0) {
    return <EmptyState Icon={ListTree} title="No topic-level data yet" description="Appears once the student completes topic practice." />;
  }

  const bySubject = new Map<string, Map<string, AdminTopicProgress[]>>();
  for (const row of rows) {
    if (!bySubject.has(row.subject)) bySubject.set(row.subject, new Map());
    const chapters = bySubject.get(row.subject)!;
    if (!chapters.has(row.chapter_name)) chapters.set(row.chapter_name, []);
    chapters.get(row.chapter_name)!.push(row);
  }

  return (
    <div className="flex flex-col gap-2">
      {[...bySubject.entries()].map(([subject, chapters]) => (
        <details key={subject} className="group" open>
          <summary
            className="cursor-pointer list-none flex items-center justify-between px-3 py-2 rounded-[var(--r-md)] text-[13.5px] font-semibold"
            style={{ background: "var(--paper-2)", color: "var(--ink-900)" }}
          >
            {subject}
            <span className="text-[11px] font-normal" style={{ color: "var(--fg-muted)" }}>
              {[...chapters.values()].flat().length} topics
            </span>
          </summary>
          <div className="pl-3 mt-1.5 flex flex-col gap-2">
            {[...chapters.entries()].map(([chapter, topics]) => (
              <details key={chapter} className="group/chapter">
                <summary className="cursor-pointer list-none text-[12.5px] font-medium py-1" style={{ color: "var(--ink-700)" }}>
                  {chapter}
                </summary>
                <div className="pl-3 flex flex-col gap-2 py-1">
                  {topics.map((t) => (
                    <div key={t.topic_name} className="flex items-center gap-2">
                      <span className="text-[12px] flex-1 min-w-0 truncate" style={{ color: "var(--ink-700)" }}>{t.topic_name}</span>
                      <OAProgressBar value={t.mastery_score} height={5} className="w-20" />
                      <span className="text-[11px] tabular-nums w-9 text-right" style={{ color: "var(--fg-muted)" }}>
                        {Math.round(t.mastery_score)}%
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
