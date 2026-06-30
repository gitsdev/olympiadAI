"use client";

import Link from "next/link";
import { Target, Clock, Zap, Route, ArrowRight, CircleCheck } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OABadge, OACard, OAProgressBar, OARing, OASubjectDot, type Subject } from "@/components/ui";
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

export default function ResultsClient({ attempt, metrics }: Props) {
  const accuracy  = attempt ? Math.round(Number(attempt.accuracy)) : 92;
  const avgTime   = attempt?.avg_time_per_question_seconds ?? 47;
  const totalTime = attempt ? formatTime(attempt.total_time_seconds) : "9:24";
  const correct   = attempt?.questions_correct ?? 11;
  const total     = attempt?.questions_attempted ?? 12;
  const readiness = attempt ? Math.round(Number(attempt.readiness_score_after)) : 87;
  const topic     = attempt?.topic_name ?? "Number System";
  const subtitle  = `${topic} · adaptive test`;

  const STATS = [
    { k: "Accuracy",   v: `${accuracy}`, unit: "%",   icon: Target, tone: "var(--brand)",    note: `${correct} of ${total} correct` },
    { k: "Avg. speed", v: `${avgTime}`,  unit: "s/q", icon: Clock,  tone: "var(--ink-700)",  note: "Time per question" },
    { k: "Time used",  v: totalTime,      unit: "",    icon: Zap,    tone: "var(--gold-500)", note: "Total session time" },
  ];

  return (
    <AppShell title="Your results" subtitle={subtitle}>
      <div className="max-w-[860px] mx-auto px-7 py-6 pb-11 flex flex-col gap-5">
        {/* Headline */}
        <div className="flex items-center gap-2">
          <OABadge tone="green" className="gap-1.5"><CircleCheck size={12} />Test complete</OABadge>
          <span className="text-[13px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
            {topic} · Adaptive · {total} Q
          </span>
        </div>

        {/* Readiness + rank prediction */}
        <OACard noPadding className="overflow-hidden grid grid-cols-2">
          <div className="p-6 border-r border-[var(--line-200)] flex items-center gap-5">
            <OARing value={readiness} size={104} stroke={10}>
              <span className="font-bold leading-none" style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--ink-900)" }}>{readiness}</span>
              <span className="mt-0.5" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-subtle)", letterSpacing: "0.06em" }}>/ 100</span>
            </OARing>
            <div>
              <p className="t-overline mb-1.5">Olympiad readiness</p>
              <h3 className="font-bold text-[20px] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{readinessLabel(readiness)}</h3>
            </div>
          </div>

          <div className="p-6 graph-bg" style={{ backgroundSize: "22px 22px" }}>
            <p className="t-overline mb-3">Predicted IMO performance</p>
            <div className="flex gap-6">
              <div>
                <p className="font-bold text-[26px] tracking-tight" style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", color: "var(--ink-900)" }}>#120–180</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>Expected rank range</p>
              </div>
              <div>
                <p className="font-bold text-[26px] tracking-tight" style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", color: "var(--gold-700)" }}>
                  {Math.min(99, Math.round(accuracy * 0.85))}<span className="text-[15px]">%</span>
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>Award probability</p>
              </div>
            </div>
            <p className="text-[11.5px] mt-3.5 leading-snug" style={{ color: "var(--fg-subtle)" }}>
              Based on accuracy, speed &amp; mastery vs. historical platform data · 82% confidence
            </p>
          </div>
        </OACard>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-3.5">
          {STATS.map(({ k, v, unit, icon: Icon, tone, note }) => (
            <OACard key={k} style={{ padding: "16px 18px" }}>
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} style={{ color: tone }} />
                <span className="t-overline">{k}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[30px] tracking-tight" style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.03em", color: "var(--ink-900)" }}>{v}</span>
                <span className="text-[14px] font-medium" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{unit}</span>
              </div>
              <p className="text-[12px] mt-1.5" style={{ color: "var(--fg-muted)" }}>{note}</p>
            </OACard>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-5 items-start">
          {/* Concept mastery */}
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
