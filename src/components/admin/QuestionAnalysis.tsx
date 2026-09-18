import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttemptAnswerRow, QuestionRow, QuestionOptionRow } from "@/types/database";

type AnswerWithQuestion = AttemptAnswerRow & { question: QuestionRow & { options: QuestionOptionRow[] } };

export function QuestionAnalysis({ answers }: { answers: AnswerWithQuestion[] }) {
  if (answers.length === 0) {
    return (
      <p className="text-[13px] p-4" style={{ color: "var(--fg-muted)" }}>
        Individual question responses aren&apos;t available for this attempt.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {answers.map((a, i) => {
        const options = [...a.question.options].sort((x, y) => x.option_index - y.option_index);
        const unanswered = a.selected_option_index === null;
        return (
          <li key={a.id} className="rounded-[var(--r-lg)] border p-4" style={{ borderColor: "var(--line-200)" }}>
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <p className="text-[13.5px] font-medium flex-1" style={{ color: "var(--ink-900)" }}>
                <span style={{ color: "var(--fg-muted)" }}>Q{i + 1}.</span> {a.question.question_text}
              </p>
              {unanswered ? (
                <MinusCircle size={18} style={{ color: "var(--fg-muted)" }} aria-label="Unanswered" />
              ) : a.is_correct ? (
                <CheckCircle2 size={18} style={{ color: "var(--success)" }} aria-label="Correct" />
              ) : (
                <XCircle size={18} style={{ color: "var(--danger)" }} aria-label="Incorrect" />
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-1.5">
              {options.map((opt) => {
                const isSelected = opt.option_index === a.selected_option_index;
                const isCorrectOption = opt.is_correct;
                return (
                  <div
                    key={opt.id}
                    className={cn("text-[12.5px] px-2.5 py-1.5 rounded-[var(--r-sm)] border")}
                    style={{
                      borderColor: isCorrectOption ? "var(--success)" : isSelected ? "var(--danger)" : "var(--line-200)",
                      background: isCorrectOption ? "var(--success-bg)" : isSelected ? "var(--danger-bg)" : "transparent",
                      color: isCorrectOption ? "var(--success-tx)" : isSelected ? "var(--danger-tx)" : "var(--ink-700)",
                    }}
                  >
                    {opt.option_text}
                    {isSelected && " · Student's answer"}
                    {isCorrectOption && !isSelected && " · Correct answer"}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-2 text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>
              <span>{a.question.difficulty} · {a.question.chapter_name ?? a.question.topic_name ?? a.question.subject}</span>
              <span>{a.time_taken_seconds}s spent</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
