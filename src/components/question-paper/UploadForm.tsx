"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileText, FileType2, Loader2, RefreshCw, Sparkles, UploadCloud, X } from "lucide-react";
import { OAButton, OACard } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  BOARDS, DETAIL_LEVELS, EXAM_TYPES, MAX_FILE_BYTES, MAX_PAGES, SUBJECTS, extOf, formatBytes,
} from "@/lib/question-paper/constants";
import { ApiError, qpsApi, uploadWithProgress } from "./api";

const AUTO = "";

type Phase = "idle" | "uploading" | "verifying";

function validateFile(file: File): string | null {
  const ext = extOf(file.name);
  if (ext !== "pdf" && ext !== "docx") {
    if (ext === "doc") return "Old Word (.doc) files aren't supported. Open it in Word and save as .docx, or export it as PDF.";
    if (ext === "docm") return "Macro-enabled Word files aren't accepted. Save it as a normal .docx.";
    return "Please choose a PDF or Word (.docx) file.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) return `This file is ${formatBytes(file.size)}. The limit is 15 MB.`;
  return null;
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={htmlFor} className="text-[12.5px] font-semibold" style={{ color: "var(--ink-700)" }}>{label}</label>
      {children}
      {hint && <span className="text-[11.5px]" style={{ color: "var(--fg-muted)" }}>{hint}</span>}
    </div>
  );
}

const selectCls = cn(
  "h-10 w-full rounded-[var(--r-md)] border border-[var(--line-300)] bg-[var(--surface)] px-3 text-[14px]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--cobalt-500)] focus:border-transparent",
);

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);

  const [classLevel, setClassLevel] = useState(AUTO);
  const [board, setBoard] = useState(AUTO);
  const [subject, setSubject] = useState(AUTO);
  const [otherSubject, setOtherSubject] = useState("");
  const [examType, setExamType] = useState(AUTO);
  const [detailLevel, setDetailLevel] = useState<string>("detailed");

  const busy = phase !== "idle";

  const pick = useCallback((f: File | undefined | null) => {
    if (!f) return;
    const problem = validateFile(f);
    setError(problem);
    setFile(problem ? null : f);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    if (e.dataTransfer.files.length > 1) {
      setError("Please upload one question paper at a time.");
      return;
    }
    pick(e.dataTransfer.files[0]);
  };

  async function generate() {
    if (!file || busy) return;
    setError(null);
    setProgress(0);
    setPhase("uploading");
    const controller = new AbortController();
    abortRef.current = controller;
    const subjectValue = subject === "Other" ? (otherSubject.trim() || "Other") : subject || null;
    try {
      const { jobId, uploadUrl } = await qpsApi.createJob({
        fileName: file.name,
        fileSize: file.size,
        classLevel: classLevel ? Number(classLevel) : null,
        board: board || null,
        subject: subjectValue,
        examType: examType || null,
        detailLevel,
        autoDetect: !classLevel || !board || !subject || !examType,
      });
      await uploadWithProgress(uploadUrl, file, setProgress, controller.signal);
      setPhase("verifying");
      await qpsApi.startJob(jobId);
      router.push(`/question-paper-solver/${jobId}`);
    } catch (err) {
      setPhase("idle");
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      abortRef.current = null;
    }
  }

  const ext = file ? extOf(file.name) : "";

  return (
    <OACard className="p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0" style={{ background: "var(--cobalt-50)" }}>
          <Sparkles size={20} style={{ color: "var(--brand)" }} />
        </div>
        <div>
          <h2 className="font-bold text-[18px] tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
            Solve a question paper
          </h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
            Upload a paper and get a complete answer sheet with explanations: every question, in the original order.
          </p>
        </div>
      </div>

      {/* Upload */}
      {!file ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload question paper"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center text-center gap-2 rounded-[var(--r-lg)] border-2 border-dashed px-5 py-9 sm:py-11 cursor-pointer transition-colors",
            dragging ? "border-[var(--cobalt-500)] bg-[var(--cobalt-50)]" : "border-[var(--line-300)] hover:border-[var(--cobalt-300)] hover:bg-[var(--fill-100)]",
          )}
        >
          <UploadCloud size={34} style={{ color: "var(--brand)" }} />
          <p className="font-semibold text-[15px]" style={{ color: "var(--ink-900)" }}>
            <span className="hidden sm:inline">Drag &amp; drop your question paper, or </span>
            <span style={{ color: "var(--brand)" }}>browse files</span>
          </p>
          <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            PDF or Word (.docx) · up to 15 MB · up to {MAX_PAGES} pages · scanned papers work too
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--line-200)] p-3.5" style={{ background: "var(--paper-2)" }}>
          <div className="w-11 h-11 rounded-[var(--r-md)] flex items-center justify-center shrink-0" style={{ background: ext === "pdf" ? "var(--danger-bg)" : "var(--cobalt-50)" }}>
            {ext === "pdf" ? <FileText size={20} style={{ color: "var(--danger-tx)" }} /> : <FileType2 size={20} style={{ color: "var(--brand)" }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[14px] truncate" style={{ color: "var(--ink-900)" }} title={file.name}>{file.name}</p>
            <p className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
              {ext === "pdf" ? "PDF document" : "Word document"} · {formatBytes(file.size)}
            </p>
            {phase === "uploading" && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--fill-200)" }}>
                  <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${progress}%`, background: "var(--cobalt-500)" }} />
                </div>
                <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: "var(--ink-700)" }}>{progress}%</span>
              </div>
            )}
            {phase === "verifying" && (
              <p className="mt-1.5 text-[12px] flex items-center gap-1.5" style={{ color: "var(--ink-700)" }}>
                <Loader2 size={13} className="animate-spin" /> Checking the file…
              </p>
            )}
          </div>
          {phase === "uploading" ? (
            <OAButton variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>Cancel</OAButton>
          ) : !busy && (
            <div className="flex items-center gap-1 shrink-0">
              <OAButton variant="ghost" size="icon" aria-label="Replace file" title="Replace file" onClick={() => inputRef.current?.click()}>
                <RefreshCw />
              </OAButton>
              <OAButton variant="ghost" size="icon" aria-label="Remove file" title="Remove file" onClick={() => { setFile(null); setError(null); }}>
                <X />
              </OAButton>
            </div>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
      />

      {error && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-[var(--r-md)] px-3 py-2.5 text-[13px]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Academic info */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h3 className="font-bold text-[14.5px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>Paper details</h3>
          <span className="text-[11.5px] text-right" style={{ color: "var(--fg-muted)" }}>Leave on Auto-detect and we&apos;ll read it from the paper</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Class" htmlFor="qps-class">
            <select id="qps-class" className={selectCls} value={classLevel} onChange={(e) => setClassLevel(e.target.value)} disabled={busy}>
              <option value={AUTO}>Auto-detect</option>
              {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>Class {i + 1}</option>)}
            </select>
          </Field>
          <Field label="Board" htmlFor="qps-board">
            <select id="qps-board" className={selectCls} value={board} onChange={(e) => setBoard(e.target.value)} disabled={busy}>
              <option value={AUTO}>Auto-detect</option>
              {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Subject" htmlFor="qps-subject">
            <select id="qps-subject" className={selectCls} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy}>
              <option value={AUTO}>Auto-detect</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Exam type" htmlFor="qps-exam">
            <select id="qps-exam" className={selectCls} value={examType} onChange={(e) => setExamType(e.target.value)} disabled={busy}>
              <option value={AUTO}>Auto-detect</option>
              {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        {subject === "Other" && (
          <div className="mt-3 max-w-sm">
            <Field label="Subject name" htmlFor="qps-subject-other">
              <input
                id="qps-subject-other"
                className={selectCls}
                maxLength={60}
                placeholder="e.g. Computer Science, Hindi"
                value={otherSubject}
                onChange={(e) => setOtherSubject(e.target.value)}
                disabled={busy}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Detail level */}
      <fieldset className="mt-6" disabled={busy}>
        <legend className="font-bold text-[14.5px] mb-3" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>Answer style</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {DETAIL_LEVELS.map((d) => {
            const on = detailLevel === d.value;
            return (
              <label
                key={d.value}
                className={cn(
                  "flex items-start gap-2.5 rounded-[var(--r-md)] border p-3 cursor-pointer transition-colors",
                  on ? "border-[var(--cobalt-500)] bg-[var(--cobalt-50)]" : "border-[var(--line-200)] hover:bg-[var(--fill-100)]",
                )}
              >
                <input type="radio" name="qps-detail" value={d.value} checked={on} onChange={() => setDetailLevel(d.value)} className="mt-1 accent-[var(--cobalt-500)]" />
                <span>
                  <span className="block text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>{d.label}</span>
                  <span className="block text-[12px]" style={{ color: "var(--fg-muted)" }}>{d.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <OAButton size="lg" onClick={generate} disabled={!file || busy} className="w-full sm:w-auto">
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {phase === "uploading" ? `Uploading… ${progress}%` : phase === "verifying" ? "Checking file…" : "Generate Answer Sheet"}
        </OAButton>
        <p className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
          Usually takes 2–6 minutes. Your paper stays private and is deleted after 30 days.
        </p>
      </div>
    </OACard>
  );
}
