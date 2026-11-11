"use client";

import { useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Download, Flag, Loader2, RotateCcw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OABadge, OAButton, OACard } from "@/components/ui";
import { Logo } from "@/components/brand";
import { detailLevelLabel, displayLabel, examTypeLabel, questionHeading } from "@/lib/question-paper/constants";
import { DISCLAIMER } from "@/lib/question-paper/sheet";
import type { PublicJob, PublicQuestion } from "@/lib/question-paper/types";
import { ApiError, qpsApi } from "./api";
import { MathMarkdown } from "./MathMarkdown";
import { QuestionCard } from "./QuestionCard";

interface Props {
  job: PublicJob;
  questions: PublicQuestion[];
  onQuestionUpdated: (q: PublicQuestion) => void;
  onRegenerateAll: () => Promise<void>;
  toast: (kind: "success" | "error", text: string) => void;
}

export function AnswerSheetView({ job, questions, onQuestionUpdated, onRegenerateAll, toast }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(questions.slice(0, 3).map((q) => q.id)));
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [exporting, setExporting] = useState<null | "pdf" | "docx">(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);

  const flagged = questions.filter((q) => q.needs_review);
  const visible = onlyFlagged ? flagged : questions;
  const sections = useMemo(() => {
    const out: Array<{ title: string | null; items: PublicQuestion[] }> = [];
    for (const q of visible) {
      const last = out[out.length - 1];
      if (last && last.title === q.section) last.items.push(q);
      else out.push({ title: q.section, items: [q] });
    }
    return out;
  }, [visible]);

  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  async function download(format: "pdf" | "docx") {
    setExporting(format);
    try {
      const { url } = await qpsApi.exportSheet(job.id, format);
      window.location.assign(url);
      toast("success", `${format === "pdf" ? "PDF" : "Word"} download started.`);
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Download failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  const jump = (id: string) => {
    setExpanded((s) => new Set(s).add(id));
    setOnlyFlagged(false);
    requestAnimationFrame(() => document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const meta = [
    ["Class", job.class_level ? `Class ${job.class_level}` : "—"],
    ["Board", job.board ?? "—"],
    ["Subject", job.subject ?? "—"],
    ["Exam", examTypeLabel(job.exam_type)],
    ["Style", detailLevelLabel(job.detail_level)],
    ["Generated", new Date(job.completed_at ?? job.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })],
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Cover */}
      <OACard className="p-5 sm:p-6" style={{ background: "linear-gradient(180deg, var(--cobalt-50), var(--surface) 75%)" }}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div className="min-w-0">
            <Logo size={24} />
            <h2 className="mt-3 font-bold text-[22px] tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>Question Paper Solutions</h2>
            <p className="text-[12.5px] truncate" style={{ color: "var(--fg-muted)" }} title={job.file_name}>{job.file_name}</p>
          </div>
          <div className="flex flex-wrap gap-2 qps-no-print">
            <OAButton onClick={() => download("pdf")} disabled={exporting !== null}>
              {exporting === "pdf" ? <Loader2 className="animate-spin" /> : <Download />} PDF
            </OAButton>
            <OAButton variant="secondary" onClick={() => download("docx")} disabled={exporting !== null}>
              {exporting === "docx" ? <Loader2 className="animate-spin" /> : <Download />} Word
            </OAButton>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {meta.map(([k, v]) => (
            <div key={k} className="rounded-[var(--r-md)] border border-[var(--line-200)] bg-[var(--surface)] px-3 py-2 min-w-0">
              <dt className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{k}</dt>
              <dd className="text-[13px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
          <OABadge tone="neutral">{job.total_questions} questions</OABadge>
          <OABadge tone="green">{questions.filter((q) => q.answer_status === "answered").length} answered</OABadge>
          {flagged.length > 0 && <OABadge tone="amber"><Flag />{flagged.length} need review</OABadge>}
        </div>
      </OACard>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 qps-no-print">
        <OAButton variant="secondary" size="sm" onClick={() => setExpanded(new Set(questions.map((q) => q.id)))}><ChevronsUpDown /> Expand all</OAButton>
        <OAButton variant="secondary" size="sm" onClick={() => setExpanded(new Set())}><ChevronsDownUp /> Collapse all</OAButton>
        {flagged.length > 0 && (
          <OAButton variant={onlyFlagged ? "soft" : "ghost"} size="sm" onClick={() => setOnlyFlagged((v) => !v)}>
            <Flag /> {onlyFlagged ? "Show all questions" : `Only flagged (${flagged.length})`}
          </OAButton>
        )}
        <div className="flex-1" />
        <OAButton variant="ghost" size="sm" onClick={() => setConfirmRegen(true)}><RotateCcw /> Regenerate all answers</OAButton>
      </div>

      {/* Questions */}
      {sections.map((s, si) => (
        <section key={`${s.title}-${si}`} className="flex flex-col gap-2.5">
          {s.title && (
            <h3 className="mt-2 font-bold text-[15px] pb-1.5 border-b-2" style={{ fontFamily: "var(--font-display)", color: "var(--cobalt-700)", borderColor: "var(--cobalt-500)" }}>
              {s.title}
            </h3>
          )}
          {s.items.map((q) => (
            <QuestionCard key={q.id} q={q} expanded={expanded.has(q.id)} onToggle={() => toggle(q.id)} onUpdated={onQuestionUpdated} toast={toast} />
          ))}
        </section>
      ))}
      {visible.length === 0 && (
        <OACard className="text-center text-[13.5px]" style={{ color: "var(--fg-muted)" }}>No questions are flagged for review.</OACard>
      )}

      {/* Answer key */}
      <OACard noPadding className="mt-2">
        <h3 className="px-5 pt-4 pb-3 font-bold text-[15px] border-b border-[var(--line-200)]" style={{ fontFamily: "var(--font-display)" }}>Quick Answer Key</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "var(--cobalt-50)" }}>
                <th className="text-left px-4 py-2 font-semibold w-[90px]">Question</th>
                <th className="text-left px-4 py-2 font-semibold">Answer</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id} className="border-t border-[var(--line-200)] hover:bg-[var(--fill-100)] cursor-pointer" onClick={() => jump(q.id)}>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap">{displayLabel(q.number_label)}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-2 flex-wrap">
                      {q.answer_status === "answered"
                        ? <MathMarkdown inline>{q.answer_short || q.final_answer || (q.correct_option ? `Option ${q.correct_option}` : "See solution")}</MathMarkdown>
                        : <span style={{ color: "var(--danger-tx)" }}>{q.answer_status === "cannot_answer" ? "Not answered" : "Not generated"}</span>}
                      {q.needs_review && <OABadge tone="amber"><Flag />Check</OABadge>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OACard>

      {/* Flagged list */}
      <OACard>
        <h3 className="font-bold text-[15px] mb-2" style={{ fontFamily: "var(--font-display)" }}>Questions flagged for manual review</h3>
        {flagged.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>None. Every question was read and answered with confidence.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {flagged.map((q) => (
              <li key={q.id}>
                <button className="text-left hover:underline" onClick={() => jump(q.id)}>
                  <strong>{questionHeading(q.number_label)}:</strong> <span style={{ color: "var(--ink-700)" }}>{q.review_reason ?? "Marked for review."}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[11.5px] italic" style={{ color: "var(--fg-muted)" }}>{DISCLAIMER}</p>
      </OACard>

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate all answers?</AlertDialogTitle>
            <AlertDialogDescription>
              Every AI answer will be written again from the questions already read from your paper. Answers you edited yourself are kept. This counts as one of your 5 papers for today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={regenBusy}
              onClick={async (e) => {
                e.preventDefault();
                setRegenBusy(true);
                try {
                  await onRegenerateAll();
                  setConfirmRegen(false);
                } finally {
                  setRegenBusy(false);
                }
              }}
            >
              {regenBusy ? <Loader2 className="animate-spin" size={16} /> : null} Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
