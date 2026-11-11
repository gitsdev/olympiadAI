"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileQuestion, FileText, FileType2 } from "lucide-react";
import { OABadge, OACard } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { examTypeLabel, type JobStatus } from "@/lib/question-paper/constants";
import type { PublicJob } from "@/lib/question-paper/types";
import { qpsApi } from "./api";

export function statusBadge(status: JobStatus) {
  switch (status) {
    case "completed": return <OABadge tone="green">Ready</OABadge>;
    case "failed": return <OABadge tone="red">Failed</OABadge>;
    case "cancelled": return <OABadge tone="neutral">Cancelled</OABadge>;
    default: return <OABadge tone="cobalt">Processing</OABadge>;
  }
}

export function JobHistory() {
  const [jobs, setJobs] = useState<PublicJob[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    qpsApi.listJobs().then((r) => setJobs(r.jobs)).catch(() => setError(true));
  }, []);

  return (
    <OACard noPadding>
      <div className="px-5 pt-4 pb-3 border-b border-[var(--line-200)]">
        <h2 className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>Your answer sheets</h2>
      </div>
      {error ? (
        <p className="px-5 py-6 text-[13px]" style={{ color: "var(--fg-muted)" }}>Couldn&apos;t load your papers. Refresh to try again.</p>
      ) : jobs === null ? (
        <div className="p-4 flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--r-md)]" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="px-5 py-9 flex flex-col items-center text-center gap-2">
          <FileQuestion size={30} style={{ color: "var(--ink-400)" }} />
          <p className="text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>No papers yet</p>
          <p className="text-[12.5px] max-w-[240px]" style={{ color: "var(--fg-muted)" }}>Upload your first question paper and its answer sheet will appear here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--line-200)]">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link href={`/question-paper-solver/${j.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--fill-100)] transition-colors">
                {j.file_ext === "pdf"
                  ? <FileText size={18} className="shrink-0" style={{ color: "var(--danger-tx)" }} />
                  : <FileType2 size={18} className="shrink-0" style={{ color: "var(--brand)" }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{j.file_name}</p>
                  <p className="text-[11.5px] truncate" style={{ color: "var(--fg-muted)" }}>
                    {[j.subject, j.class_level ? `Class ${j.class_level}` : null, j.exam_type ? examTypeLabel(j.exam_type) : null].filter(Boolean).join(" · ") || "Details pending"}
                    {" · "}
                    {new Date(j.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
                {statusBadge(j.status)}
                <ChevronRight size={16} style={{ color: "var(--ink-400)" }} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OACard>
  );
}
