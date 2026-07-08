"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clock, Check, X, CircleCheck, Trophy,
  Zap, Loader2, BookOpen, ChevronRight, RotateCcw,
  Home, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout";
import { OABadge, OACard, OASubjectDot, OARing, type Subject } from "@/components/ui";
import { submitTestAttempt } from "@/actions/assessment";
import { useStudent } from "@/contexts/StudentContext";
import { cn } from "@/lib/utils";

const DIFF_TONE: Record<string, "green" | "amber" | "red" | "cobalt" | "neutral"> = {
  Easy: "green", Medium: "amber", Hard: "red", HOTS: "cobalt", Adaptive: "neutral",
};
const LETTERS = ["A", "B", "C", "D"];
const COUNTS = [5, 10, 15, 20];
const DIFFICULTIES = ["Easy", "Medium", "Hard", "Adaptive"] as const;
type Difficulty = typeof DIFFICULTIES[number];

interface Question {
  id: string;
  subject: Subject;
  topic_name: string;
  difficulty: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
  estimated_time_seconds: number;
}

interface AnswerRecord {
  questionId: string;
  questionIdx: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
  timeTakenSeconds: number;
}

type Phase = "setup" | "loading" | "quiz" | "results";

/* ── Parse explanation into numbered steps ─────────────────────────── */
function parseSteps(text: string): string[] {
  // Explicit "Step N" markers
  if (/step\s*\d/i.test(text)) {
    const parts = text.split(/step\s*\d+\s*[:.]\s*/i).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  // Arrow chain: "A → B → C"
  if (text.includes(" → ")) {
    return text.split(" → ").map(s => s.trim()).filter(s => s.length > 2);
  }
  // Numbered list: "1. ... 2. ..."
  if (/^\d+\.\s/.test(text.trim())) {
    return text.split(/\d+\.\s+/).map(s => s.trim()).filter(Boolean);
  }
  // Sentence split — split on ". " keeping punctuation
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const filtered = sentences.map(s => s.trim()).filter(s => s.length > 8);
  return filtered.length >= 2 ? filtered : [text];
}

/* ── Main component ────────────────────────────────────────────────── */
function PracticeInner() {
  const params = useSearchParams();
  const user = useStudent();

  const ALL_SUBJECTS = (user.subjects.length > 0 ? user.subjects : ["Mathematics"]) as Subject[];

  /* ── setup state ── */
  const [phase, setPhase]           = useState<Phase>("setup");
  const [selSubject, setSelSubject] = useState<Subject>((params.get("subject") as Subject) ?? ALL_SUBJECTS[0]);
  const [selTopic, setSelTopic]     = useState(params.get("topic") ?? "");
  const [selDiff, setSelDiff]       = useState<Difficulty>((params.get("difficulty") as Difficulty) ?? "Medium");
  const [selCount, setSelCount]     = useState(Number(params.get("count") ?? 10));
  const selClassLevel               = params.get("classLevel") ? Number(params.get("classLevel")) : user.cls;

  /* ── quiz state ── */
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [fetchError, setFetchError]     = useState("");
  const [idx, setIdx]                   = useState(0);
  const [picked, setPicked]             = useState<number | null>(null);
  const [answers, setAnswers]           = useState<AnswerRecord[]>([]);
  const [qStart, setQStart]             = useState(Date.now());
  const [sessionStart, setSessionStart] = useState(Date.now());
  const [totalTime, setTotalTime]       = useState(0);

  useEffect(() => {
    if (params.get("subject") && params.get("autostart") === "1") {
      startPractice();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startPractice() {
    setPhase("loading");
    setFetchError("");
    setIdx(0);
    setPicked(null);
    setAnswers([]);
    setSessionStart(Date.now());
    setQStart(Date.now());

    try {
      const topic = selTopic.trim() || selSubject;
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject:    selSubject,
          topicName:  topic,
          difficulty: selDiff,
          count:      selCount,
          classLevel: selClassLevel,
          board:      user.board,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const { questions: q } = await res.json();
      if (!q?.length) throw new Error("No questions returned");

      setQuestions(
        q.map((item: Omit<Question, "id" | "subject">, i: number) => ({
          ...item,
          id: `ai-${i}`,
          subject: selSubject,
        }))
      );
      setPhase("quiz");
    } catch {
      setFetchError("Could not generate questions. Check your connection and try again.");
      setPhase("setup");
    }
  }

  function choose(i: number) {
    if (picked !== null) return; // already answered
    setPicked(i);
  }

  async function advance() {
    if (picked === null) return;
    const cur = questions[idx];
    const timeTaken = Math.round((Date.now() - qStart) / 1000);
    const newAnswer: AnswerRecord = {
      questionId:          cur.id,
      questionIdx:         idx,
      selectedOptionIndex: picked,
      isCorrect:           picked === cur.correct_answer_index,
      timeTakenSeconds:    timeTaken,
    };
    const allAnswers = [...answers, newAnswer];
    setAnswers(allAnswers);

    if (idx + 1 >= questions.length) {
      // Last question — compute total time and go to results
      const elapsed = Math.round((Date.now() - sessionStart) / 1000);
      setTotalTime(elapsed);
      setPhase("results");
      // Persist attempt in background
      submitTestAttempt({
        subject:          cur.subject,
        topicName:        cur.topic_name,
        answers:          allAnswers,
        totalTimeSeconds: elapsed,
      }).catch(() => {});
    } else {
      setIdx(idx + 1);
      setPicked(null);
      setQStart(Date.now());
    }
  }

  function resetToSetup() {
    setPhase("setup");
    setIdx(0);
    setPicked(null);
    setAnswers([]);
    setQuestions([]);
  }

  /* ══════════════════════════ SETUP ══════════════════════════════════ */
  if (phase === "setup") {
    return (
      <AppShell title="Practice" subtitle="Pick your subject and get started">
        <div className="max-w-[640px] mx-auto px-7 py-6 pb-10 flex flex-col gap-5">

          <OACard style={{ padding: "20px 24px" }}>
            <p className="text-[12px] font-semibold mb-3 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>Subject</p>
            <div className="flex flex-wrap gap-2.5">
              {ALL_SUBJECTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelSubject(s)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] border-[1.5px] text-[14px] font-semibold cursor-pointer transition-all duration-[140ms]"
                  style={{
                    borderColor: selSubject === s ? "var(--cobalt-400)" : "var(--line-300)",
                    background:  selSubject === s ? "var(--cobalt-50)"  : "var(--surface)",
                    color:       selSubject === s ? "var(--cobalt-700)" : "var(--ink-700)",
                  }}
                >
                  <OASubjectDot subject={s} size={9} />
                  {s}
                  {selSubject === s && <Check size={13} style={{ color: "var(--cobalt-600)" }} />}
                </button>
              ))}
            </div>
          </OACard>

          <OACard style={{ padding: "20px 24px" }}>
            <p className="text-[12px] font-semibold mb-1.5 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>
              Topic <span style={{ color: "var(--fg-subtle)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </p>
            <p className="text-[12.5px] mb-3" style={{ color: "var(--fg-muted)" }}>Leave blank for mixed questions across {selSubject}.</p>
            <input
              value={selTopic}
              onChange={(e) => setSelTopic(e.target.value)}
              placeholder="e.g. Fractions, Photosynthesis, Grammar…"
              className="w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[9px] text-[14px] outline-none focus:border-[var(--cobalt-400)] focus:ring-2 focus:ring-[var(--cobalt-500)]/20 transition-colors"
              style={{ background: "var(--surface)", color: "var(--ink-900)" }}
            />
          </OACard>

          <OACard style={{ padding: "20px 24px" }}>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[12px] font-semibold mb-2.5 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>Difficulty</p>
                <div className="flex gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button key={d} onClick={() => setSelDiff(d)}
                      className="flex-1 py-2 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-semibold cursor-pointer transition-all duration-[140ms]"
                      style={{
                        borderColor: selDiff === d ? "var(--cobalt-400)" : "var(--line-300)",
                        background:  selDiff === d ? "var(--cobalt-50)"  : "var(--surface)",
                        color:       selDiff === d ? "var(--cobalt-700)" : "var(--ink-700)",
                      }}>{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[12px] font-semibold mb-2.5 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>Questions</p>
                <div className="flex gap-2">
                  {COUNTS.map((c) => (
                    <button key={c} onClick={() => setSelCount(c)}
                      className="flex-1 py-2 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-bold cursor-pointer transition-all duration-[140ms]"
                      style={{
                        fontFamily:  "var(--font-mono)",
                        borderColor: selCount === c ? "var(--cobalt-400)" : "var(--line-300)",
                        background:  selCount === c ? "var(--cobalt-50)"  : "var(--surface)",
                        color:       selCount === c ? "var(--cobalt-700)" : "var(--ink-700)",
                      }}>{c}</button>
                  ))}
                </div>
              </div>
            </div>
          </OACard>

          {fetchError && (
            <p className="text-[13px] px-3 py-2 rounded-[var(--r-md)]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
              {fetchError}
            </p>
          )}

          <button onClick={startPractice}
            className="flex items-center justify-center gap-2 py-3 rounded-[var(--r-md)] text-[15px] font-semibold text-white border-none cursor-pointer"
            style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}>
            <BookOpen size={17} />
            Start {selCount} questions · {selSubject}
            <ChevronRight size={17} />
          </button>
        </div>
      </AppShell>
    );
  }

  /* ══════════════════════════ LOADING ════════════════════════════════ */
  if (phase === "loading") {
    return (
      <AppShell title="Practice" subtitle="Generating questions…">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--brand)" }} />
          <p className="text-[14px]" style={{ color: "var(--fg-muted)" }}>
            Building {selCount} {selDiff.toLowerCase()} questions for {selSubject}…
          </p>
        </div>
      </AppShell>
    );
  }

  /* ══════════════════════════ QUIZ ═══════════════════════════════════ */
  if (phase === "quiz") {
    const cur = questions[idx];
    if (!cur) return null;
    const isLast = idx + 1 >= questions.length;

    return (
      <AppShell title="Practice" subtitle={`${selSubject} · ${cur.topic_name}`}>
        <div className="max-w-[720px] mx-auto px-7 py-6 pb-10">

          {/* Header row */}
          <div className="flex items-center gap-3.5 mb-4">
            <OABadge tone="neutral" className="gap-1.5">
              <OASubjectDot subject={cur.subject} size={8} /> {cur.topic_name}
            </OABadge>
            <OABadge tone={DIFF_TONE[cur.difficulty] ?? "neutral"}>{cur.difficulty}</OABadge>
            <span className="flex-1" />
            <span className="flex items-center gap-1.5 text-[13px]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-700)" }}>
              <Clock size={15} style={{ color: "var(--fg-muted)" }} />
              ~{cur.estimated_time_seconds}s
            </span>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5 mb-6">
            {questions.map((_, i) => (
              <div key={i} className="flex-1 h-[5px] rounded-full transition-colors"
                style={{
                  background: i < idx
                    ? answers[i]?.isCorrect ? "var(--success)" : "var(--danger)"
                    : i === idx ? "var(--brand)" : "var(--fill-200)",
                }} />
            ))}
          </div>

          {idx === Math.floor(questions.length / 2) && idx > 0 && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-[var(--r-md)] text-[13px]"
              style={{ background: "var(--cobalt-50)", color: "var(--cobalt-700)" }}>
              <Zap size={15} fill="var(--brand)" color="var(--brand)" />
              Halfway there — keep going!
            </div>
          )}

          <p className="text-[12px] mb-2" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
            Question {idx + 1} of {questions.length}
          </p>
          <h2 className="font-bold text-[23px] leading-snug tracking-tight mb-6"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.015em" }}>
            {cur.question_text}
          </h2>

          {/* Options — no reveal, just selection highlight */}
          <div className="flex flex-col gap-2.5">
            {cur.options.map((o, i) => {
              const isSelected = i === picked;
              return (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  disabled={picked !== null}
                  className={cn(
                    "flex items-center gap-3 text-left w-full px-4 py-3.5 rounded-[var(--r-md)] border-[1.5px] transition-all duration-[120ms]",
                    picked === null && "cursor-pointer hover:border-[var(--cobalt-400)] hover:bg-[var(--cobalt-50)] active:scale-[0.995]",
                    isSelected && "border-[var(--cobalt-400)] bg-[var(--cobalt-50)]",
                    !isSelected && "border-[var(--line-300)] bg-[var(--surface)]",
                    picked !== null && !isSelected && "cursor-default opacity-60",
                  )}>
                  <span
                    className="w-7 h-7 rounded-[8px] shrink-0 flex items-center justify-center font-bold text-[13px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      background: isSelected ? "var(--cobalt-500)" : "var(--fill-100)",
                      color:      isSelected ? "#fff"              : "var(--ink-700)",
                    }}>
                    {LETTERS[i]}
                  </span>
                  <span className="flex-1 text-[15px] font-medium" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}>
                    {o}
                  </span>
                  {isSelected && <Check size={17} style={{ color: "var(--cobalt-500)" }} />}
                </button>
              );
            })}
          </div>

          {/* Next / Finish button — appears after picking */}
          <div className={cn("flex justify-end mt-5 transition-opacity duration-200", picked !== null ? "opacity-100" : "opacity-0 pointer-events-none")}>
            <button
              onClick={advance}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold text-white border-none cursor-pointer"
              style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}>
              {isLast ? (
                <><Trophy size={16} /> Finish &amp; see results</>
              ) : (
                <>Next question <ChevronRight size={16} /></>
              )}
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ══════════════════════════ RESULTS ════════════════════════════════ */
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const total        = questions.length;
  const pct          = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const wrongAnswers = answers.filter((a) => !a.isCorrect);
  const mins         = Math.floor(totalTime / 60);
  const secs         = totalTime % 60;

  const scoreLabel =
    pct === 100 ? "Perfect score!" :
    pct >= 80   ? "Excellent work" :
    pct >= 60   ? "Good effort"    :
    pct >= 40   ? "Keep practising" : "Needs more work";

  return (
    <AppShell title="Results" subtitle={`${selSubject} · ${selTopic || selSubject}`}>
      <div className="max-w-[720px] mx-auto px-7 py-6 pb-10 flex flex-col gap-5">

        {/* ── Score summary card ── */}
        <OACard noPadding className="overflow-hidden grid grid-cols-[auto_1fr]">
          {/* Ring */}
          <div className="p-6 border-r border-[var(--line-200)] flex items-center justify-center"
            style={{ background: pct === 100 ? "var(--gold-50)" : "var(--paper-2)" }}>
            <OARing
              value={pct}
              size={108}
              stroke={11}
              color={pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--brand)" : "var(--gold-500)"}
            >
              <span className="font-bold leading-none" style={{ fontFamily: "var(--font-mono)", fontSize: 30, color: "var(--ink-900)" }}>
                {pct}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-subtle)", letterSpacing: "0.06em" }}>
                / 100
              </span>
            </OARing>
          </div>

          {/* Stats */}
          <div className="p-6">
            <p className="t-overline mb-1">Your score</p>
            <h2 className="font-bold text-[24px] tracking-tight mb-3"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
              {scoreLabel}
            </h2>
            <div className="flex gap-5">
              <Stat label="Correct" value={`${correctCount} / ${total}`} tone="var(--success-tx)" />
              <Stat label="Wrong"   value={`${wrongAnswers.length}`}     tone={wrongAnswers.length > 0 ? "var(--danger)" : "var(--fg-muted)"} />
              <Stat label="Time"    value={mins > 0 ? `${mins}m ${secs}s` : `${secs}s`} tone="var(--ink-700)" />
            </div>
          </div>
        </OACard>

        {/* ── Wrong answer review ── */}
        {wrongAnswers.length === 0 ? (
          <OACard style={{ padding: "24px", textAlign: "center" }}>
            <Trophy size={32} style={{ color: "var(--gold-500)", margin: "0 auto 12px" }} />
            <h3 className="font-bold text-[18px] mb-1" style={{ fontFamily: "var(--font-display)" }}>
              Perfect — every answer correct!
            </h3>
            <p className="text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
              Try a harder difficulty or a new topic to keep challenging yourself.
            </p>
          </OACard>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={17} style={{ color: "var(--danger)" }} />
              <h3 className="font-bold text-[17px]" style={{ fontFamily: "var(--font-display)" }}>
                Review — {wrongAnswers.length} incorrect answer{wrongAnswers.length > 1 ? "s" : ""}
              </h3>
            </div>

            {wrongAnswers.map((ans, reviewIdx) => {
              const q = questions[ans.questionIdx];
              if (!q) return null;
              const steps = parseSteps(q.explanation);

              return (
                <OACard key={ans.questionId} noPadding className="overflow-hidden">
                  {/* Question header */}
                  <div className="px-5 pt-4 pb-3 border-b border-[var(--line-200)]"
                    style={{ background: "var(--paper-2)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                        style={{ fontFamily: "var(--font-mono)", background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
                        Q{ans.questionIdx + 1}
                      </span>
                      <OABadge tone={DIFF_TONE[q.difficulty] ?? "neutral"}>{q.difficulty}</OABadge>
                      <OABadge tone="neutral" className="gap-1">
                        <OASubjectDot subject={q.subject} size={7} />{q.topic_name}
                      </OABadge>
                    </div>
                    <p className="font-semibold text-[15px] leading-snug" style={{ color: "var(--ink-900)" }}>
                      {q.question_text}
                    </p>
                  </div>

                  <div className="px-5 py-4 flex flex-col gap-3">
                    {/* Wrong answer */}
                    <div className="flex items-start gap-3 rounded-[var(--r-md)] px-3.5 py-2.5"
                      style={{ background: "var(--danger-bg)", border: "1px solid oklch(0.85 0.08 25)" }}>
                      <X size={17} style={{ color: "var(--danger)", marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <p className="text-[11.5px] font-semibold mb-0.5 uppercase tracking-[0.04em]"
                          style={{ color: "var(--danger-tx)" }}>Your answer</p>
                        <p className="text-[14px] font-medium" style={{ color: "var(--ink-900)" }}>
                          {LETTERS[ans.selectedOptionIndex]}. {q.options[ans.selectedOptionIndex]}
                        </p>
                      </div>
                    </div>

                    {/* Correct answer */}
                    <div className="flex items-start gap-3 rounded-[var(--r-md)] px-3.5 py-2.5"
                      style={{ background: "var(--success-bg)", border: "1px solid oklch(0.85 0.1 145)" }}>
                      <CircleCheck size={17} style={{ color: "var(--success)", marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <p className="text-[11.5px] font-semibold mb-0.5 uppercase tracking-[0.04em]"
                          style={{ color: "var(--success-tx)" }}>Correct answer</p>
                        <p className="text-[14px] font-medium" style={{ color: "var(--ink-900)" }}>
                          {LETTERS[q.correct_answer_index]}. {q.options[q.correct_answer_index]}
                        </p>
                      </div>
                    </div>

                    {/* Step-by-step explanation */}
                    <div className="mt-1">
                      <p className="text-[11.5px] font-semibold uppercase tracking-[0.05em] mb-2.5"
                        style={{ color: "var(--fg-muted)" }}>
                        Step-by-step explanation
                      </p>
                      <div className="flex flex-col gap-2.5">
                        {steps.map((step, si) => (
                          <div key={si} className="flex items-start gap-3">
                            <span
                              className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5"
                              style={{ background: "var(--cobalt-100)", color: "var(--cobalt-700)", fontFamily: "var(--font-mono)" }}>
                              {si + 1}
                            </span>
                            <p className="text-[14px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </OACard>
              );
            })}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={resetToSetup}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold border cursor-pointer transition-colors hover:bg-[var(--fill-100)]"
            style={{ borderColor: "var(--line-300)", background: "var(--surface)", color: "var(--ink-700)" }}>
            <RotateCcw size={15} /> Practice again
          </button>
          <Link href="/tests">
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold border cursor-pointer transition-colors hover:bg-[var(--fill-100)]"
              style={{ borderColor: "var(--line-300)", background: "var(--surface)", color: "var(--ink-700)" }}>
              New test
            </button>
          </Link>
          <Link href="/dashboard" className="ml-auto">
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold text-white border-none cursor-pointer"
              style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}>
              <Home size={15} /> Dashboard
            </button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

/* ── Tiny helpers ──────────────────────────────────────────────────── */
function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.04em] mb-0.5" style={{ color: "var(--fg-muted)" }}>
        {label}
      </p>
      <p className="font-bold text-[20px] tracking-tight" style={{ fontFamily: "var(--font-mono)", color: tone }}>
        {value}
      </p>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense>
      <PracticeInner />
    </Suspense>
  );
}
