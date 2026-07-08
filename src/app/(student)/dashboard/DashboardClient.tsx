"use client";

import Link from "next/link";
import { Play, Sparkles, Check, Flame, Target, ChevronRight, Zap } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OAButton, OABadge, OACard, OAProgressBar, OARing, OASubjectDot, type Subject } from "@/components/ui";
import type { Tables, StudyPlanItem } from "@/types/database";

const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

const FALLBACK_PLAN: StudyPlanItem[] = [
  { id: "1", subj: "Mathematics" as Subject, title: "Review: Equivalent fractions",    kind: "Concept",   minutes: 8,  done: true,  subject: "Mathematics" as Subject },
  { id: "2", subj: "Mathematics" as Subject, title: "Practice: Fractions → Decimals",  kind: "Practice",  minutes: 12, done: false, subject: "Mathematics" as Subject },
  { id: "3", subj: "Science"     as Subject, title: "Watch: Refraction of light",      kind: "Resource",  minutes: 6,  done: false, subject: "Science"     as Subject },
  { id: "4", subj: "Mathematics" as Subject, title: "Adaptive test: Number system",    kind: "Mock test", minutes: 20, done: false, subject: "Mathematics" as Subject },
] as unknown as StudyPlanItem[];

interface Props {
  student: Tables<"students"> & { profile: { full_name: string; email: string; avatar_url: string | null } | null };
  plan: Tables<"study_plans"> | null;
  weakTopics: Pick<Tables<"performance_metrics">, "subject" | "topic_name" | "mastery_score">[];
}

export default function DashboardClient({ student, plan, weakTopics }: Props) {
  const firstName  = student.profile?.full_name?.split(" ")[0] ?? "Student";
  const planItems: StudyPlanItem[] = (plan?.items as StudyPlanItem[] | null) ?? FALLBACK_PLAN;
  const doneCount  = planItems.filter((p) => p.done).length;
  const totalMins  = planItems.reduce((s, p) => s + p.minutes, 0);
  const streakFilled = Math.min(student.streak_days, 7);
  const score = Math.round(student.readiness_score);

  return (
    <AppShell
      title="Home"
      subtitle={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} · let's get a session in`}
    >
      <div className="p-4 sm:p-6 lg:p-7 flex flex-col gap-4 sm:gap-5">

        {/* ── Hero greeting ── */}
        <OACard noPadding className="overflow-hidden relative border-none" style={{ background: "var(--cobalt-700)" }}>
          <div className="absolute inset-0 graph-bg opacity-50" style={{ backgroundSize: "26px 26px" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(120% 120% at 88% -20%, oklch(0.52 0.195 259 / 0.9), transparent 55%)" }} />

          <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <p className="t-overline" style={{ color: "var(--gold-400)" }}>
                  {getGreeting()}, {firstName}
                </p>
                {/* Inline score chip — mobile only */}
                <span
                  className="sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-bold"
                  style={{ background: "oklch(1 0 0 / 0.12)", color: "var(--gold-300)", fontFamily: "var(--font-mono)" }}
                >
                  {score}/100
                </span>
              </div>
              <h2
                className="font-bold leading-tight text-white mb-2"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em", fontSize: "clamp(20px, 3vw, 28px)" }}
              >
                {getMotivationalMessage(doneCount, planItems.length)}
              </h2>
              <p className="hidden sm:block text-[14.5px] leading-[1.5] max-w-[440px]" style={{ color: "oklch(0.9 0.04 258)" }}>
                Pick up where you left off, or ask your tutor what to revise next.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-4">
                <Link href="/practice">
                  <OAButton variant="gold" size="md"><Play size={16} /> Continue practice</OAButton>
                </Link>
                <Link href="/tutor">
                  <OAButton variant="ghost" size="md" style={{ color: "#fff", background: "oklch(1 0 0 / 0.1)" }}>
                    <Sparkles size={16} /> Ask the tutor
                  </OAButton>
                </Link>
              </div>
            </div>

            {/* Readiness ring — desktop only */}
            <div className="hidden sm:flex flex-col items-center gap-1.5 shrink-0">
              <OARing value={student.readiness_score} size={118} stroke={11} color="var(--gold-400)">
                <span className="font-bold leading-none text-white" style={{ fontFamily: "var(--font-mono)", fontSize: 32 }}>
                  {score}
                </span>
                <span className="mt-0.5" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "oklch(0.85 0.05 258)", letterSpacing: "0.08em" }}>
                  / 100
                </span>
              </OARing>
              <span className="text-[12px] font-semibold" style={{ color: "oklch(0.9 0.04 258)" }}>Readiness</span>
            </div>
          </div>
        </OACard>

        {/* ── Main grid ── */}
        {/* Mobile/tablet: single column stack. lg: plan left, sidebar right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 sm:gap-5 items-start">

          {/* Today's plan */}
          <OACard style={{ padding: "18px 20px" }}>
            <div className="flex items-center mb-3.5">
              <div>
                <h3 className="font-bold text-[18px] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                  Today&apos;s plan
                </h3>
                <p className="text-[12.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                  Built by your tutor · {totalMins} min total
                </p>
              </div>
              <span className="flex-1" />
              <OABadge tone="gold" className="gap-1.5">
                <Zap size={11} /> {doneCount} of {planItems.length} done
              </OABadge>
            </div>
            <div className="flex flex-col gap-2">
              {planItems.map((p) => <PlanRow key={p.id} p={p} />)}
            </div>
          </OACard>

          {/* Sidebar — 2-col grid on sm, single col on mobile + lg */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-5">

            {/* Streak */}
            <OACard style={{ padding: "16px 18px" }}>
              <p className="t-overline mb-3">This week</p>
              <div className="flex gap-1.5 mb-3.5">
                {WEEK_DAYS.map((d, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div
                      className="h-[30px] rounded-[6px] flex items-center justify-center"
                      style={{ background: i < streakFilled ? "var(--gold-400)" : "var(--fill-200)" }}
                    >
                      {i < streakFilled && <Check size={14} style={{ color: "var(--ink-900)" }} />}
                    </div>
                    <p className="text-[10.5px] mt-1" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{d}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Flame size={18} style={{ color: "var(--gold-500)" }} />
                <span className="text-[13px]" style={{ color: "var(--ink-700)" }}>
                  <b style={{ fontFamily: "var(--font-mono)" }}>{student.streak_days}</b>{" "}
                  day streak{student.streak_days > 0 ? " · keep it going" : " · start today"}
                </span>
              </div>
            </OACard>

            {/* Focus areas */}
            <OACard style={{ padding: "16px 18px" }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Target size={17} style={{ color: "var(--danger)" }} />
                <h3 className="font-bold text-[16px]" style={{ fontFamily: "var(--font-display)" }}>Focus areas</h3>
              </div>
              {weakTopics.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
                  Complete a practice session to see your weak areas.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {weakTopics.map((w) => (
                    <div key={w.topic_name}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <OASubjectDot subject={w.subject as Subject} />
                        <span className="text-[13px] font-semibold flex-1 truncate" style={{ color: "var(--ink-900)" }}>
                          {w.topic_name}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>
                          {Math.round(w.mastery_score)}%
                        </span>
                      </div>
                      <OAProgressBar value={w.mastery_score} tone={w.mastery_score < 50 ? "gold" : "brand"} height={6} />
                    </div>
                  ))}
                </div>
              )}
              <Link href="/practice">
                <OAButton variant="soft" size="sm" className="w-full mt-4 justify-between">
                  Practice weak topics <ChevronRight size={15} />
                </OAButton>
              </Link>
            </OACard>

          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PlanRow({ p }: { p: StudyPlanItem }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-[11px] rounded-[var(--r-md)] border border-[var(--line-200)] transition-colors hover:bg-[var(--fill-100)]"
      style={{ background: p.done ? "var(--paper-2)" : "var(--surface)" }}
    >
      <div
        className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center"
        style={{ border: p.done ? "none" : "2px solid var(--line-300)", background: p.done ? "var(--success)" : "transparent" }}
      >
        {p.done && <Check size={15} color="#fff" strokeWidth={2.5} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <OASubjectDot subject={p.subject as Subject} size={8} />
          <span
            className="text-[14px] font-semibold truncate"
            style={{ color: "var(--ink-900)", textDecoration: p.done ? "line-through" : "none", opacity: p.done ? 0.6 : 1 }}
          >
            {p.title}
          </span>
        </div>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>{p.kind} · {p.minutes} min</p>
      </div>
      {!p.done && <ChevronRight size={18} style={{ color: "var(--fg-subtle)" }} />}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getMotivationalMessage(done: number, total: number) {
  if (total === 0) return "Ready to start your session?";
  if (done === 0) return "Your plan is ready — let's go.";
  if (done >= total) return "Plan complete — excellent work today!";
  return `${total - done} task${total - done > 1 ? "s" : ""} left in today's plan.`;
}
