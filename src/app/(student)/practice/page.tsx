"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock, Sparkles, ArrowRight, Check, X, CircleCheck,
  Lightbulb, Zap, Loader2, BookOpen, ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { OABadge, OACard, OASubjectDot, type Subject } from "@/components/ui";
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
  selectedOptionIndex: number;
  isCorrect: boolean;
  timeTakenSeconds: number;
}

type Phase = "setup" | "loading" | "quiz";

function PracticeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useStudent();

  const ALL_SUBJECTS = (user.subjects.length > 0 ? user.subjects : ["Mathematics"]) as Subject[];

  /* ── setup state ── */
  const [phase, setPhase]             = useState<Phase>("setup");
  const [selSubject, setSelSubject]   = useState<Subject>((params.get("subject") as Subject) ?? ALL_SUBJECTS[0]);
  const [selTopic, setSelTopic]       = useState(params.get("topic") ?? "");
  const [selDiff, setSelDiff]         = useState<Difficulty>((params.get("difficulty") as Difficulty) ?? "Medium");
  const [selCount, setSelCount]       = useState(Number(params.get("count") ?? 10));

  /* ── quiz state ── */
  const [questions, setQuestions]     = useState<Question[]>([]);
  const [fetchError, setFetchError]   = useState("");
  const [idx, setIdx]                 = useState(0);
  const [picked, setPicked]           = useState<number | null>(null);
  const [revealed, setRevealed]       = useState(false);
  const [answers, setAnswers]         = useState<AnswerRecord[]>([]);
  const [qStart, setQStart]           = useState(Date.now());
  const [sessionStart, setSessionStart] = useState(Date.now());

  // Auto-start if URL params include subject (coming from tests page)
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
    setRevealed(false);
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
          classLevel: user.cls,
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
      setFetchError("Could not generate questions. Check your internet connection and try again.");
      setPhase("setup");
    }
  }

  function choose(i: number) {
    if (revealed) return;
    const cur = questions[idx];
    if (!cur) return;
    const timeTaken = Math.round((Date.now() - qStart) / 1000);
    setPicked(i);
    setRevealed(true);
    setAnswers((prev) => [
      ...prev,
      {
        questionId:          cur.id,
        selectedOptionIndex: i,
        isCorrect:           i === cur.correct_answer_index,
        timeTakenSeconds:    timeTaken,
      },
    ]);
  }

  async function next() {
    const cur = questions[idx];
    if (idx + 1 >= questions.length) {
      const totalTime = Math.round((Date.now() - sessionStart) / 1000);
      await submitTestAttempt({
        subject:          cur.subject,
        topicName:        cur.topic_name,
        answers,
        totalTimeSeconds: totalTime,
      });
      router.push("/results");
      return;
    }
    setIdx(idx + 1);
    setPicked(null);
    setRevealed(false);
    setQStart(Date.now());
  }

  /* ─────────────────────────────── SETUP SCREEN ─────────────────────────────── */
  if (phase === "setup") {
    return (
      <AppShell title="Practice" subtitle="Pick your subject and get started">
        <div className="max-w-[640px] mx-auto px-7 py-6 pb-10 flex flex-col gap-5">

          {/* Subject */}
          <OACard style={{ padding: "20px 24px" }}>
            <p className="text-[12px] font-semibold mb-3 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>
              Subject
            </p>
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

          {/* Topic (optional) */}
          <OACard style={{ padding: "20px 24px" }}>
            <p className="text-[12px] font-semibold mb-1.5 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>
              Topic <span style={{ color: "var(--fg-subtle)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </p>
            <p className="text-[12.5px] mb-3" style={{ color: "var(--fg-muted)" }}>
              Leave blank to get mixed questions across {selSubject}.
            </p>
            <input
              value={selTopic}
              onChange={(e) => setSelTopic(e.target.value)}
              placeholder={`e.g. Fractions, Photosynthesis, Grammar…`}
              className="w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[9px] text-[14px] outline-none focus:border-[var(--cobalt-400)] focus:ring-2 focus:ring-[var(--cobalt-500)]/20 transition-colors"
              style={{ background: "var(--surface)", color: "var(--ink-900)" }}
            />
          </OACard>

          {/* Difficulty + Count */}
          <OACard style={{ padding: "20px 24px" }}>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[12px] font-semibold mb-2.5 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>Difficulty</p>
                <div className="flex gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelDiff(d)}
                      className="flex-1 py-2 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-semibold cursor-pointer transition-all duration-[140ms]"
                      style={{
                        borderColor: selDiff === d ? "var(--cobalt-400)" : "var(--line-300)",
                        background:  selDiff === d ? "var(--cobalt-50)"  : "var(--surface)",
                        color:       selDiff === d ? "var(--cobalt-700)" : "var(--ink-700)",
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold mb-2.5 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>
                  Questions
                </p>
                <div className="flex gap-2">
                  {COUNTS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelCount(c)}
                      className="flex-1 py-2 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-bold cursor-pointer transition-all duration-[140ms]"
                      style={{
                        fontFamily:  "var(--font-mono)",
                        borderColor: selCount === c ? "var(--cobalt-400)" : "var(--line-300)",
                        background:  selCount === c ? "var(--cobalt-50)"  : "var(--surface)",
                        color:       selCount === c ? "var(--cobalt-700)" : "var(--ink-700)",
                      }}
                    >
                      {c}
                    </button>
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

          <button
            onClick={startPractice}
            className="flex items-center justify-center gap-2 py-3 rounded-[var(--r-md)] text-[15px] font-semibold text-white border-none cursor-pointer"
            style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}
          >
            <BookOpen size={17} />
            Start {selCount} questions · {selSubject}
            <ChevronRight size={17} />
          </button>
        </div>
      </AppShell>
    );
  }

  /* ─────────────────────────────── LOADING ─────────────────────────────── */
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

  /* ─────────────────────────────── QUIZ ─────────────────────────────── */
  const cur = questions[idx];
  if (!cur) return null;

  return (
    <AppShell title="Practice" subtitle={`${selSubject} · ${cur.topic_name}`}>
      <div className="max-w-[720px] mx-auto px-7 py-6 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <OABadge tone="neutral" className="gap-1.5">
            <OASubjectDot subject={cur.subject} size={8} /> {cur.topic_name}
          </OABadge>
          <OABadge tone={DIFF_TONE[cur.difficulty] ?? "neutral"}>{cur.difficulty}</OABadge>
          <span className="flex-1" />
          <span className="flex items-center gap-1.5 text-[13px]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-700)" }}>
            <Clock size={15} style={{ color: "var(--fg-muted)" }} />
            {Math.floor(cur.estimated_time_seconds / 60)}:{String(cur.estimated_time_seconds % 60).padStart(2, "0")}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-6">
          {questions.map((_, i) => (
            <div key={i} className="flex-1 h-[5px] rounded-full"
              style={{ background: i < idx ? "var(--success)" : i === idx ? "var(--brand)" : "var(--fill-200)" }} />
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

        <div className="flex flex-col gap-2.5">
          {cur.options.map((o, i) => {
            const isCorrect = i === cur.correct_answer_index, isPicked = i === picked;
            return (
              <button key={i} onClick={() => choose(i)} disabled={revealed}
                className={cn(
                  "flex items-center gap-3 text-left w-full px-4 py-3.5 rounded-[var(--r-md)] border-[1.5px] transition-all duration-[120ms]",
                  !revealed && "cursor-pointer hover:border-[var(--cobalt-400)] hover:bg-[var(--cobalt-50)] active:scale-[0.995]",
                  revealed && isCorrect && "border-[var(--success)] bg-[var(--success-bg)]",
                  revealed && isPicked && !isCorrect && "border-[var(--danger)] bg-[var(--danger-bg)]",
                  (!revealed || (!isCorrect && !isPicked)) && "border-[var(--line-300)] bg-[var(--surface)]",
                  revealed && "cursor-default"
                )}>
                <span className="w-7 h-7 rounded-[8px] shrink-0 flex items-center justify-center font-bold text-[13px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: revealed && isCorrect ? "var(--success)" : revealed && isPicked && !isCorrect ? "var(--danger)" : "var(--fill-100)",
                    color: revealed && (isCorrect || (isPicked && !isCorrect)) ? "#fff" : "var(--ink-700)",
                  }}>
                  {LETTERS[i]}
                </span>
                <span className="flex-1 text-[15px] font-medium" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}>{o}</span>
                {revealed && isCorrect && <Check size={19} style={{ color: "var(--success)" }} />}
                {revealed && isPicked && !isCorrect && <X size={19} style={{ color: "var(--danger)" }} />}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {revealed && (
          <div className="mt-5 rounded-[var(--r-lg)] border border-[var(--line-200)] p-4" style={{ background: "var(--paper-2)" }}>
            <div className="flex items-center gap-2 mb-2">
              {picked === cur.correct_answer_index
                ? <CircleCheck size={18} style={{ color: "var(--success)" }} />
                : <Lightbulb size={18} style={{ color: "var(--gold-500)" }} />}
              <span className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)", color: picked === cur.correct_answer_index ? "var(--success-tx)" : "var(--ink-900)" }}>
                {picked === cur.correct_answer_index ? "Correct — nicely done." : "Not quite. Here's why."}
              </span>
            </div>
            <p className="text-[14px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>{cur.explanation}</p>
            <div className="flex items-center mt-3.5">
              <button className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--brand)", background: "none", border: "none", cursor: "pointer" }}>
                <Sparkles size={14} /> Explain more
              </button>
              <span className="flex-1" />
              <button onClick={next}
                className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold text-white border-none cursor-pointer"
                style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}>
                {idx + 1 >= questions.length ? "See results" : "Next question"} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function PracticePage() {
  return (
    <Suspense>
      <PracticeInner />
    </Suspense>
  );
}
