"use client";

import { useState } from "react";
import { Check, ChevronDown, Flag, FlagOff, Loader2, Pencil, RotateCcw, X } from "lucide-react";
import { OABadge, OAButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { QUESTION_TYPE_LABELS, questionHeading } from "@/lib/question-paper/constants";
import type { PublicQuestion } from "@/lib/question-paper/types";
import { ApiError, qpsApi } from "./api";
import { MathMarkdown } from "./MathMarkdown";

interface Props {
  q: PublicQuestion;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: (q: PublicQuestion) => void;
  toast: (kind: "success" | "error", text: string) => void;
}

const area = cn(
  "w-full rounded-[var(--r-md)] border border-[var(--line-300)] bg-[var(--surface)] px-3 py-2 text-[13.5px] font-normal",
  "focus:outline-none focus:ring-2 focus:ring-[var(--cobalt-500)] focus:border-transparent",
);

function norm(s: string | null) {
  return (s ?? "").replace(/[().\s]/g, "").toLowerCase();
}

export function QuestionCard({ q, expanded, onToggle, onUpdated, toast }: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "regen" | "flag">("view");
  const [busy, setBusy] = useState<null | "save" | "regen" | "flag">(null);
  const [draft, setDraft] = useState({ answer_short: "", correct_option: "", answer_md: "", explanation_md: "", final_answer: "" });
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);

  const startEdit = () => {
    setDraft({
      answer_short: q.answer_short ?? "",
      correct_option: q.correct_option ?? "",
      answer_md: q.answer_md ?? "",
      explanation_md: q.explanation_md ?? "",
      final_answer: q.final_answer ?? "",
    });
    setPreview(false);
    setMode("edit");
  };

  async function run(kind: "save" | "regen" | "flag", fn: () => Promise<{ question: PublicQuestion }>, success: string) {
    setBusy(kind);
    try {
      const { question } = await fn();
      onUpdated(question);
      setMode("view");
      setNote("");
      toast("success", success);
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const save = () => run("save", () => qpsApi.updateQuestion(q.id, {
    answer_short: draft.answer_short.trim(),
    correct_option: draft.correct_option.trim() || null,
    answer_md: draft.answer_md,
    explanation_md: draft.explanation_md,
    final_answer: draft.final_answer.trim() || null,
  }), "Answer saved.");

  const regenerate = () => run("regen", () => qpsApi.regenerateQuestion(q.id, note.trim() || undefined), "New answer generated.");
  const setFlag = (on: boolean) => run("flag", () => qpsApi.updateQuestion(q.id, on ? { needs_review: true, review_reason: note.trim() || null } : { needs_review: false }), on ? "Marked for review." : "Review flag removed.");

  const unanswered = q.answer_status !== "answered";

  return (
    <article
      id={`q-${q.id}`}
      className={cn("rounded-[var(--r-lg)] border bg-[var(--surface)] transition-shadow", q.needs_review ? "border-[var(--warning)]" : "border-[var(--line-200)]")}
    >
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-start gap-3 text-left px-4 sm:px-5 py-3.5"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold text-[14.5px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>{questionHeading(q.number_label)}</span>
            <span className="text-[11.5px]" style={{ color: "var(--fg-muted)" }}>
              {QUESTION_TYPE_LABELS[q.type]}{q.marks !== null ? ` · ${q.marks} mark${q.marks === 1 ? "" : "s"}` : ""}
            </span>
            {q.needs_review && <OABadge tone="amber"><Flag />Needs review</OABadge>}
            {q.edited_by_user && <OABadge tone="neutral">Edited</OABadge>}
            {unanswered && <OABadge tone="red">{q.answer_status === "cannot_answer" ? "Not answered" : "Not generated"}</OABadge>}
          </div>
          {!expanded && (
            <p className="mt-1 text-[13px] line-clamp-1" style={{ color: "var(--ink-700)" }}>
              {q.answer_status === "answered" && q.answer_short ? <><strong style={{ color: "var(--brand)" }}>Answer:</strong> {q.answer_short}</> : (q.question_md || "Question could not be read").replace(/[$*_#>`]/g, "").slice(0, 140)}
            </p>
          )}
        </div>
        <ChevronDown size={18} className={cn("shrink-0 mt-0.5 transition-transform", expanded && "rotate-180")} style={{ color: "var(--ink-500)" }} />
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-4 border-t border-[var(--line-200)] pt-3.5">
          {q.context_md && (
            <div className="mb-2.5 pl-3 border-l-[3px] border-[var(--line-200)]" style={{ color: "var(--ink-700)" }}>
              <MathMarkdown>{q.context_md}</MathMarkdown>
            </div>
          )}
          {q.question_md ? <MathMarkdown>{q.question_md}</MathMarkdown> : (
            <p className="text-[13.5px] italic" style={{ color: "var(--fg-muted)" }}>The text of this question could not be read from the paper.</p>
          )}

          {q.options?.length ? (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {q.options.map((o) => {
                const correct = q.answer_status === "answered" && !!q.correct_option && norm(o.label) === norm(q.correct_option);
                return (
                  <li
                    key={o.label}
                    className="flex items-start gap-2 rounded-[var(--r-md)] border px-2.5 py-1.5 text-[13.5px]"
                    style={correct ? { borderColor: "var(--success)", background: "var(--success-bg)" } : { borderColor: "var(--line-200)" }}
                  >
                    <span className="font-semibold shrink-0">({o.label})</span>
                    <MathMarkdown inline className="flex-1">{o.text}</MathMarkdown>
                    {correct && <Check size={15} className="shrink-0 mt-0.5" style={{ color: "var(--success)" }} />}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {q.match_pairs && (
            <div className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
              <div><p className="font-semibold mb-1">Column A</p>{q.match_pairs.left.map((l, i) => <div key={i} className="flex gap-1.5"><span>{i + 1}.</span><MathMarkdown inline>{l}</MathMarkdown></div>)}</div>
              <div><p className="font-semibold mb-1">Column B</p>{q.match_pairs.right.map((r, i) => <div key={i} className="flex gap-1.5"><span>{String.fromCharCode(97 + i)}.</span><MathMarkdown inline>{r}</MathMarkdown></div>)}</div>
            </div>
          )}

          {q.has_diagram && q.diagram_description && (
            <p className="mt-2 text-[12.5px] italic" style={{ color: "var(--fg-muted)" }}><strong>Figure:</strong> {q.diagram_description}</p>
          )}

          {/* Answer */}
          {mode === "edit" ? (
            <div className="mt-4 rounded-[var(--r-md)] p-3.5" style={{ background: "var(--paper-2)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12.5px] font-semibold" style={{ color: "var(--ink-700)" }}>Edit answer · Markdown, maths as $x^2$</p>
                <OAButton variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</OAButton>
              </div>
              {preview ? (
                <div className="flex flex-col gap-3 bg-[var(--surface)] rounded-[var(--r-md)] p-3">
                  <MathMarkdown>{draft.answer_md}</MathMarkdown>
                  {draft.explanation_md.trim() && <MathMarkdown>{draft.explanation_md}</MathMarkdown>}
                </div>
              ) : (
                <div className="grid gap-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2.5">
                    <label className="text-[12px] font-semibold flex flex-col gap-1">Short answer (answer key)
                      <input className={area} maxLength={300} value={draft.answer_short} onChange={(e) => setDraft({ ...draft, answer_short: e.target.value })} />
                    </label>
                    {(q.options?.length ?? 0) > 0 && (
                      <label className="text-[12px] font-semibold flex flex-col gap-1">Correct option
                        <input className={area} maxLength={20} value={draft.correct_option} onChange={(e) => setDraft({ ...draft, correct_option: e.target.value })} />
                      </label>
                    )}
                  </div>
                  <label className="text-[12px] font-semibold flex flex-col gap-1">Answer
                    <textarea className={area} rows={5} value={draft.answer_md} onChange={(e) => setDraft({ ...draft, answer_md: e.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold flex flex-col gap-1">Explanation
                    <textarea className={area} rows={6} value={draft.explanation_md} onChange={(e) => setDraft({ ...draft, explanation_md: e.target.value })} />
                  </label>
                  <label className="text-[12px] font-semibold flex flex-col gap-1">Final answer (optional)
                    <input className={area} maxLength={500} value={draft.final_answer} onChange={(e) => setDraft({ ...draft, final_answer: e.target.value })} />
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-3">
                <OAButton variant="ghost" size="sm" onClick={() => setMode("view")} disabled={busy === "save"}>Cancel</OAButton>
                <OAButton size="sm" onClick={save} disabled={busy === "save" || !draft.answer_md.trim()}>
                  {busy === "save" ? <Loader2 className="animate-spin" /> : <Check />} Save
                </OAButton>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {q.answer_status === "answered" ? (
                <>
                  {q.correct_option && (
                    <p className="text-[13px]"><span className="font-bold uppercase tracking-wide text-[11.5px]" style={{ color: "var(--brand)" }}>Correct option </span>
                      <span className="inline-block ml-1 rounded px-2 py-0.5 text-white font-bold" style={{ background: "var(--cobalt-500)" }}>{q.correct_option}</span></p>
                  )}
                  <div>
                    <p className="font-bold uppercase tracking-wide text-[11.5px] mb-1" style={{ color: "var(--brand)" }}>Answer</p>
                    <MathMarkdown>{q.answer_md}</MathMarkdown>
                  </div>
                  {q.explanation_md?.trim() && (
                    <div>
                      <p className="font-bold uppercase tracking-wide text-[11.5px] mb-1" style={{ color: "var(--brand)" }}>Explanation</p>
                      <MathMarkdown>{q.explanation_md}</MathMarkdown>
                    </div>
                  )}
                  {q.final_answer && (
                    <div className="rounded-r-[var(--r-md)] border-l-4 px-3 py-2 font-bold text-[14px]" style={{ borderColor: "var(--cobalt-500)", background: "var(--cobalt-50)" }}>
                      <span className="uppercase text-[11px] tracking-wider mr-2" style={{ color: "var(--cobalt-700)" }}>Final answer</span>
                      <MathMarkdown inline>{q.final_answer}</MathMarkdown>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[13.5px]" style={{ color: "var(--ink-700)" }}>
                  <p>{q.answer_status === "cannot_answer" ? "This question wasn’t answered automatically because something is missing or unclear." : "An answer couldn’t be generated for this question."} You can regenerate it or type the answer yourself.</p>
                  {q.answer_md?.trim() && <div className="mt-2"><MathMarkdown>{q.answer_md}</MathMarkdown></div>}
                </div>
              )}

              {q.needs_review && (
                <div className="rounded-[var(--r-md)] px-3 py-2 text-[13px] flex items-start gap-2" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
                  <Flag size={15} className="shrink-0 mt-0.5" />
                  <span><strong>Needs review:</strong> {q.review_reason ?? "Please check this answer."}</span>
                </div>
              )}
            </div>
          )}

          {(mode === "regen" || mode === "flag") && (
            <div className="mt-3 rounded-[var(--r-md)] p-3" style={{ background: "var(--paper-2)" }}>
              <label className="text-[12.5px] font-semibold flex flex-col gap-1.5" style={{ color: "var(--ink-700)" }}>
                {mode === "regen" ? "What should be different? (optional)" : "Why does this need review? (optional)"}
                <input
                  className={area}
                  maxLength={mode === "regen" ? 500 : 1000}
                  placeholder={mode === "regen" ? "e.g. Explain more simply, or the answer should be 24" : "e.g. Diagram labels look wrong"}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={busy !== null}
                />
              </label>
              <div className="flex justify-end gap-2 mt-2.5">
                <OAButton variant="ghost" size="sm" onClick={() => { setMode("view"); setNote(""); }} disabled={busy !== null}><X /> Cancel</OAButton>
                {mode === "regen" ? (
                  <OAButton size="sm" onClick={regenerate} disabled={busy !== null}>
                    {busy === "regen" ? <><Loader2 className="animate-spin" /> Regenerating… up to a minute</> : <><RotateCcw /> Regenerate answer</>}
                  </OAButton>
                ) : (
                  <OAButton size="sm" variant="secondary" onClick={() => setFlag(true)} disabled={busy !== null}>
                    {busy === "flag" ? <Loader2 className="animate-spin" /> : <Flag />} Mark for review
                  </OAButton>
                )}
              </div>
            </div>
          )}

          {mode === "view" && (
            <div className="mt-4 flex flex-wrap gap-2 qps-no-print">
              <OAButton variant="secondary" size="sm" onClick={startEdit}><Pencil /> Edit</OAButton>
              {q.question_md.trim() && <OAButton variant="secondary" size="sm" onClick={() => setMode("regen")}><RotateCcw /> Regenerate</OAButton>}
              {q.needs_review ? (
                <OAButton variant="ghost" size="sm" onClick={() => setFlag(false)} disabled={busy === "flag"}>
                  {busy === "flag" ? <Loader2 className="animate-spin" /> : <FlagOff />} Clear review flag
                </OAButton>
              ) : (
                <OAButton variant="ghost" size="sm" onClick={() => setMode("flag")}><Flag /> Mark for review</OAButton>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
