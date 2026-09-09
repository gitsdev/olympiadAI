"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";

export function ArticleFeedback() {
  const [done, setDone] = useState(false);

  return (
    <div
      className="rounded-[var(--r-lg)] border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      style={{ background: "var(--surface)", borderColor: "var(--line-200)" }}
    >
      <div>
        <p className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>Was this guide helpful?</p>
        <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          Your feedback helps us decide what to write next.
        </p>
      </div>
      {done ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--success-tx)" }}>
          <Check size={16} /> Thanks for the feedback!
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDone(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--r-md)] border text-[13px] font-semibold transition-colors hover:bg-[var(--fill-100)]"
            style={{ borderColor: "var(--line-300)", color: "var(--ink-700)" }}
          >
            <ThumbsUp size={15} style={{ color: "var(--success-tx)" }} /> Yes
          </button>
          <button
            onClick={() => setDone(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--r-md)] border text-[13px] font-semibold transition-colors hover:bg-[var(--fill-100)]"
            style={{ borderColor: "var(--line-300)", color: "var(--ink-700)" }}
          >
            <ThumbsDown size={15} /> Not really
          </button>
        </div>
      )}
    </div>
  );
}
