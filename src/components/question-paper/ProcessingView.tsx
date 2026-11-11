"use client";

import Link from "next/link";
import { AlertTriangle, Check, Loader2, ScanLine } from "lucide-react";
import { OAButton, OACard, OAProgressBar } from "@/components/ui";
import { STAGES } from "@/lib/question-paper/constants";
import type { PublicJob } from "@/lib/question-paper/types";

export function ProcessingView({ job }: { job: PublicJob }) {
  if (job.status === "failed" || job.status === "cancelled") {
    return (
      <OACard className="max-w-[640px] mx-auto p-6 text-center">
        <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3" style={{ background: "var(--danger-bg)" }}>
          <AlertTriangle size={22} style={{ color: "var(--danger-tx)" }} />
        </div>
        <h2 className="font-bold text-[18px]" style={{ fontFamily: "var(--font-display)" }}>
          {job.status === "cancelled" ? "This paper was cancelled" : "We couldn’t solve this paper"}
        </h2>
        <p className="text-[13.5px] mt-2" style={{ color: "var(--ink-700)" }}>
          {job.last_error ?? "Please try uploading it again."}
        </p>
        <Link href="/question-paper-solver" className="inline-block mt-5">
          <OAButton>Upload another paper</OAButton>
        </Link>
      </OACard>
    );
  }

  const currentIdx = Math.max(0, STAGES.findIndex((s) => s.value === job.stage));
  return (
    <OACard className="max-w-[640px] mx-auto p-6 sm:p-7">
      <h2 className="font-bold text-[18px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
        Preparing your answer sheet
      </h2>
      <p className="text-[13px] mt-1 truncate" style={{ color: "var(--fg-muted)" }} title={job.file_name}>{job.file_name}</p>

      {job.is_scanned && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] rounded-full px-2.5 py-1" style={{ background: "var(--cobalt-50)", color: "var(--cobalt-700)" }}>
          <ScanLine size={13} /> Scanned paper detected: reading it with OCR
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <OAProgressBar value={job.progress} className="flex-1" height={8} />
        <span className="text-[13px] font-semibold tabular-nums w-10 text-right" style={{ color: "var(--ink-700)" }}>{job.progress}%</span>
      </div>

      <ol className="mt-6 flex flex-col gap-3.5" aria-live="polite">
        {STAGES.map((s, i) => {
          const done = i < currentIdx || job.status === "completed";
          const active = i === currentIdx && job.status !== "completed";
          return (
            <li key={s.value} className="flex items-center gap-3">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold"
                style={{
                  background: done ? "var(--success)" : active ? "var(--cobalt-500)" : "var(--fill-200)",
                  color: done || active ? "#fff" : "var(--ink-500)",
                }}
              >
                {done ? <Check size={15} /> : active ? <Loader2 size={15} className="animate-spin" /> : i + 1}
              </span>
              <span className="text-[14px]" style={{ color: done || active ? "var(--ink-900)" : "var(--fg-muted)", fontWeight: active ? 600 : 400 }}>
                {s.label}
                {active && s.value === "solving" && job.total_questions > 0 && (
                  <span className="ml-2 text-[12.5px] font-normal tabular-nums" style={{ color: "var(--fg-muted)" }}>
                    {job.solved_questions} of {job.total_questions} questions
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-[12px]" style={{ color: "var(--fg-muted)" }}>
        You can leave this page. Your answer sheet will keep generating and will be under “Your answer sheets”.
      </p>
    </OACard>
  );
}
