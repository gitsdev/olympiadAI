"use client";

import Link from "next/link";
import { Target, Clock, Zap, Route, ArrowRight, CircleCheck, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OABadge, OAButton, OACard, OAProgressBar, OARing, OASubjectDot, type Subject } from "@/components/ui";
import type { TestAttemptRow, PerformanceMetricRow } from "@/types/database";


function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function readinessLabel(score: number) {
  if (score >= 86) return "Exam-ready!";
  if (score >= 76) return "Almost exam-ready";
  if (score >= 61) return "Good progress";
  if (score >= 41) return "Building skills";
  return "Getting started";
}

interface Props {
  attempt: TestAttemptRow | null;
  metrics: PerformanceMetricRow[];
}

function MasteryCard({ metrics }: { metrics: PerformanceMetricRow[] }) {
  return (
    <OACard style={{ padding: "18px 20px" }}>
      <h3 className="font-bold text-[17px] mb-1" style={{ fontFamily: "var(--font-display)" }}>Concept mastery</h3>
      <p className="text-[12.5px] mb-4" style={{ color: "var(--fg-muted)" }}>
        {metrics.length > 0 ? "Your weakest topics — focus here next." : "Complete more tests to see mastery data."}
      </p>
      <div className="flex flex-col gap-4">
        {metrics.length > 0 ? metrics.map((m) => (
          <div key={m.id}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <OASubjectDot subject={m.subject as Subject} />
              <span className="text-[13.5px] font-semibold flex-1" style={{ color: "var(--ink-900)" }}>{m.topic_name}</span>
              <span className="text-[12px] w-8 text-right" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
                {Math.round(Number(m.mastery_score))}%
              </span>
            </div>
            <OAProgressBar
              value={Math.round(Number(m.mastery_score))}
              tone={Number(m.mastery_score) < 50 ? "gold" : Number(m.mastery_score) > 85 ? "green" : "brand"}
              height={6}
            />
          </div>
        )) : (
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>No mastery data yet.</p>
        )}
      </div>
    </OACard>
  );
}

export default function ResultsClient({ attempt, metrics }: Props) {
  if (!attempt) {
    return (
      <AppShell title="Your progress" subtitle="Complete a test to see your results">
        <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-6 pb-11 flex flex-col gap-5">
          <OACard noPadding className="overflow-hidden relative" style={{ background: "var(--paper-2)" }}>
            <div className="absolute inset-0 graph-bg opacity-40" style={{ backgroundSize: "22px 22px" }} />
            <div className="relative p-6 sm:p-8 flex flex-col items-center text-center gap-3">
              <ClipboardList size={28} style={{ color: "var(--fg-subtle)" }} />
              <h3 className="font-bold text-[19px]" style={{ fontFamily: "var(--font-display)" }}>No results yet</h3>
              <p className="text-[13.5px] max-w-[380px]" style={{ color: "var(--fg-muted)" }}>
                Take a practice test or mock exam and your accuracy, speed, and readiness score will show up here.
              </p>
              <Link href="/tests">
                <OAButton variant="primary" size="md" className="mt-1">
                  Start a test <ArrowRight size={16} />
                </OAButton>
              </Link>
            </div>
          </OACard>

          <MasteryCard metrics={metrics} />
        </div>
      </AppShell>
    );
  }

  const accuracy  = Math.round(Number(attempt.accuracy));
  const avgTime   = attempt.avg_time_per_question_seconds;
  const totalTime = formatTime(attempt.total_time_seconds);
  const correct   = attempt.questions_correct;
  const total     = attempt.questions_attempted;
  const readiness = Math.round(Number(attempt.readiness_score_after));
  const topic     = attempt.topic_name ?? "General";
  const subtitle  = `${topic} · adaptive test`;

  const STATS = [
    { k: "Accuracy",   v: `${accuracy}`, unit: "%",   icon: Target, tone: "var(--brand)",    note: `${correct} of ${total} correct` },
    { k: "Avg. speed", v: `${avgTime}`,  unit: "s/q", icon: Clock,  tone: "var(--ink-700)",  note: "Time per question" },
    { k: "Time used",  v: totalTime,      unit: "",    icon: Zap,    tone: "var(--gold-500)", note: "Total session time" },
  ];

  return (
    <AppShell title="Your results" subtitle={subtitle}>
      <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-6 pb-11 flex flex-col gap-5">
        {/* Headline */}
        <div className="flex items-center gap-2">
          <OABadge tone="green" className="gap-1.5"><CircleCheck size={12} />Test complete</OABadge>
          <span className="text-[13px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
            {topic} · Adaptive · {total} Q
          </span>
        </div>

        {/* Readiness */}
        <OACard noPadding className="overflow-hidden">
          <div className="p-5 sm:p-6 flex items-center gap-5">
            <OARing value={readiness} size={100} stroke={10}>
              <span className="font-bold leading-none" style={{ fontFamily: "var(--font-mono)", fontSize: 26, color: "var(--ink-900)" }}>{readiness}</span>
              <span className="mt-0.5" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-subtle)", letterSpacing: "0.06em" }}>/ 100</span>
            </OARing>
            <div>
              <p className="t-overline mb-1.5">Olympiad readiness</p>
              <h3 className="font-bold text-[19px] sm:text-[20px] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{readinessLabel(readiness)}</h3>
            </div>
          </div>
        </OACard>

        {/* Stat tiles — 1 col mobile, 3 col sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {STATS.map(({ k, v, unit, icon: Icon, tone, note }) => (
            <OACard key={k} style={{ padding: "16px 18px" }}>
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} style={{ color: tone }} />
                <span className="t-overline">{k}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[28px] sm:text-[30px] tracking-tight" style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.03em", color: "var(--ink-900)" }}>{v}</span>
                <span className="text-[14px] font-medium" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{unit}</span>
              </div>
              <p className="text-[12px] mt-1.5" style={{ color: "var(--fg-muted)" }}>{note}</p>
            </OACard>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
          <MasteryCard metrics={metrics} />

          {/* 3-day plan */}
          <OACard noPadding className="overflow-hidden relative p-5" style={{ background: "var(--cobalt-700)", border: "none" }}>
            <div className="absolute inset-0 graph-bg opacity-40" style={{ backgroundSize: "20px 20px" }} />
            <div className="relative">
              <Route size={22} style={{ color: "var(--gold-400)", marginBottom: 10 }} />
              <h3 className="font-bold text-[17px] text-white mb-1.5" style={{ fontFamily: "var(--font-display)" }}>Your next 3 days</h3>
              <p className="text-[13px] leading-[1.55] mb-4" style={{ color: "oklch(0.9 0.04 258)" }}>
                {metrics[0]
                  ? `${metrics[0].topic_name} needs attention. I've built a focused plan to close the gap.`
                  : "Keep up the momentum with a focused study plan."}
              </p>
              <Link href="/dashboard">
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--r-md)] font-semibold text-[14px] cursor-pointer border-none"
                  style={{ background: "var(--gold-400)", color: "var(--ink-900)" }}
                >
                  Start the plan <ArrowRight size={16} />
                </button>
              </Link>
            </div>
          </OACard>
        </div>
      </div>
    </AppShell>
  );
}
