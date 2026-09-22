"use client";

import { useState, useEffect, useRef } from "react";
import { Clock, Check } from "lucide-react";
import { OABadge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { StartAiBattleQuestion } from "@/actions/battle";

const LETTERS = ["A", "B", "C", "D"];

interface BattleQuestionCardProps {
  question: StartAiBattleQuestion;
  index: number;
  total: number;
  timeLimitSeconds: number;
  onSubmit: (selectedIndex: number | null, timeTakenSeconds: number, timedOut: boolean) => void;
}

/**
 * One question, one countdown. The parent remounts this component (via a
 * `key={battleQuestionId}` on the caller) between questions, which is what
 * resets the local pick/timer state — there's no explicit reset effect here.
 */
export function BattleQuestionCard({ question, index, total, timeLimitSeconds, onSubmit }: BattleQuestionCardProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(timeLimitSeconds);
  const startRef = useRef(0);
  const submittedRef = useRef(false);

  function submit(selectedIndex: number | null, timedOut: boolean) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const taken = Math.min(timeLimitSeconds, Math.max(0, Math.round((Date.now() - startRef.current) / 1000)));
    onSubmit(selectedIndex, taken, timedOut);
  }

  useEffect(() => {
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          submit(picked, true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urgent = remaining <= 10;

  return (
    <div>
      <div className="flex items-center gap-3.5 mb-4">
        <OABadge tone="neutral">Question {index + 1} of {total}</OABadge>
        {question.topicName && <OABadge tone="cobalt">{question.topicName}</OABadge>}
        <span className="flex-1" />
        <span
          className="flex items-center gap-1.5 text-[13px] font-bold px-2.5 py-1 rounded-full"
          style={{
            fontFamily: "var(--font-mono)",
            color: urgent ? "var(--danger-tx)" : "var(--ink-700)",
            background: urgent ? "var(--danger-bg)" : "var(--fill-100)",
          }}
        >
          <Clock size={14} />
          {remaining}s
        </span>
      </div>

      <div className="h-[5px] rounded-full mb-6 overflow-hidden" style={{ background: "var(--fill-200)" }}>
        <div
          className="h-full rounded-full transition-[width] duration-1000 linear"
          style={{ width: `${(remaining / timeLimitSeconds) * 100}%`, background: urgent ? "var(--danger)" : "var(--brand)" }}
        />
      </div>

      <h2
        className="font-bold text-[22px] leading-snug tracking-tight mb-6"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.015em" }}
      >
        {question.questionText}
      </h2>

      <div className="flex flex-col gap-2.5">
        {question.options.map((option, i) => {
          const isSelected = i === picked;
          return (
            <button
              key={i}
              onClick={() => setPicked(i)}
              className={cn(
                "flex items-center gap-3 text-left w-full px-4 py-3.5 rounded-[var(--r-md)] border-[1.5px] transition-all duration-[120ms]",
                "cursor-pointer hover:border-[var(--cobalt-400)] hover:bg-[var(--cobalt-50)] active:scale-[0.995]",
                isSelected ? "border-[var(--cobalt-400)] bg-[var(--cobalt-50)]" : "border-[var(--line-300)] bg-[var(--surface)]"
              )}
            >
              <span
                className="w-7 h-7 rounded-[8px] shrink-0 flex items-center justify-center font-bold text-[13px]"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: isSelected ? "var(--cobalt-500)" : "var(--fill-100)",
                  color: isSelected ? "#fff" : "var(--ink-700)",
                }}
              >
                {LETTERS[i]}
              </span>
              <span className="flex-1 text-[15px] font-medium" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}>
                {option}
              </span>
              {isSelected && <Check size={17} style={{ color: "var(--cobalt-500)" }} />}
            </button>
          );
        })}
      </div>

      <div className={cn("flex justify-end mt-5 transition-opacity duration-200", picked !== null ? "opacity-100" : "opacity-0 pointer-events-none")}>
        <button
          onClick={() => submit(picked, false)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold text-white border-none cursor-pointer"
          style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}
        >
          {index + 1 >= total ? "Finish battle" : "Next question"}
        </button>
      </div>
    </div>
  );
}
