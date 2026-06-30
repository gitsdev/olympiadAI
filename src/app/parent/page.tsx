"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell, ChevronDown, Clock, FileText, Target,
  TrendingUp, PencilLine, Trophy, Lightbulb, Sparkles, Download,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { OABadge, OACard, OAProgressBar, OARing, OAAvatar, OASubjectDot, type Subject } from "@/components/ui";

const CHILD = { name: "Aarav Sharma", board: "CBSE", cls: 7 };

const WEEKS = [62, 65, 64, 70, 73, 78, 81, 87];

const STATS = [
  { Icon: Clock,    label: "Practice time", value: "4h 20m", note: "this week · +35m", tone: "var(--brand)",    up: true  },
  { Icon: FileText, label: "Tests taken",   value: "6",      note: "2 mock · 4 topic", tone: "var(--ink-700)", up: false },
  { Icon: Target,   label: "Avg. accuracy", value: "88%",    note: "+4% vs last week", tone: "var(--success)",  up: true  },
];

const WEAK: { subj: Subject; topic: string; mastery: number }[] = [
  { subj: "Mathematics", topic: "Profit & Loss",      mastery: 44 },
  { subj: "Science",     topic: "Light & Reflection", mastery: 52 },
  { subj: "Mathematics", topic: "Ratio & Proportion", mastery: 61 },
];

const PLAN = [
  { title: "Profit & Loss — focused practice", day: "Today", Icon: PencilLine },
  { title: "Number System chapter test",        day: "Wed",   Icon: FileText  },
  { title: "IMO Mock · Set 5",                  day: "Sat",   Icon: Trophy    },
];

const TABS = ["Overview", "Reports", "Activity"] as const;
type Tab = (typeof TABS)[number];

const maxW = Math.max(...WEEKS);

export default function ParentPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const firstName = CHILD.name.split(" ")[0];

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      {/* Nav */}
      <header
        className="sticky top-0 z-20 border-b border-[var(--line-200)]"
        style={{ background: "oklch(0.992 0.004 95 / 0.85)", backdropFilter: "blur(10px)" }}
      >
        <div className="max-w-[1080px] mx-auto px-7 py-[13px] flex items-center gap-5">
          <Logo size={26} />
          <div className="w-px h-[26px]" style={{ background: "var(--line-300)" }} />

          {/* Child switcher */}
          <button
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-[var(--line-300)] bg-[var(--surface)] cursor-pointer transition-colors duration-[140ms] hover:bg-[var(--fill-100)]"
          >
            <OAAvatar name={CHILD.name} size={26} />
            <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>{firstName}</span>
            <ChevronDown size={15} style={{ color: "var(--fg-muted)" }} />
          </button>

          <span className="flex-1" />

          {/* Tabs */}
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="text-[14px] font-semibold px-3.5 py-2 rounded-[var(--r-md)] border-none cursor-pointer transition-colors duration-[140ms]"
                style={{
                  background: tab === t ? "var(--cobalt-50)" : "transparent",
                  color: tab === t ? "var(--cobalt-700)" : "var(--ink-700)",
                }}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="w-px h-[26px]" style={{ background: "var(--line-300)" }} />
          <button className="w-[38px] h-[38px] rounded-[var(--r-md)] border-none bg-transparent flex items-center justify-center cursor-pointer transition-colors duration-[140ms] hover:bg-[var(--fill-100)]">
            <Bell size={19} style={{ color: "var(--ink-700)" }} />
          </button>
          <OAAvatar name="Priya Nair" size={32} tone="gold" />
        </div>
      </header>

      {/* Content */}
      {tab === "Overview" ? (
        <div className="max-w-[1080px] mx-auto px-7 py-6 pb-12 flex flex-col gap-4">
          {/* Hero card */}
          <OACard
            noPadding
            className="overflow-hidden relative border-none"
            style={{ background: "var(--cobalt-700)" }}
          >
            <div className="absolute inset-0 graph-bg opacity-40" style={{ backgroundSize: "26px 26px" }} />
            <div className="relative px-7 py-6 flex items-center gap-7">
              <div className="flex-1">
                <p className="t-overline mb-1.5" style={{ color: "var(--gold-400)" }}>
                  Weekly summary · 21–27 May
                </p>
                <h1
                  className="font-bold text-[27px] text-white tracking-tight mb-2"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
                >
                  {firstName} had a strong week.
                </h1>
                <p className="text-[14.5px] leading-[1.55] max-w-[440px]" style={{ color: "oklch(0.9 0.04 258)" }}>
                  Readiness climbed 6 points and accuracy is up. One area still needs attention — Profit &amp; Loss.
                </p>
                <button
                  className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold border-none cursor-pointer"
                  style={{ background: "var(--gold-400)", color: "var(--ink-900)" }}
                >
                  <Download size={16} /> Download full report
                </button>
              </div>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <OARing value={87} size={112} stroke={10} color="var(--gold-400)">
                  <span
                    className="font-bold leading-none text-white"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 30 }}
                  >
                    87
                  </span>
                  <span
                    style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "oklch(0.85 0.05 258)" }}
                  >
                    / 100
                  </span>
                </OARing>
                <span className="text-[12px] font-semibold" style={{ color: "oklch(0.9 0.04 258)" }}>
                  Olympiad readiness
                </span>
              </div>
            </div>
          </OACard>

          {/* Stat row */}
          <div className="grid grid-cols-3 gap-3.5">
            {STATS.map(({ Icon, label, value, note, tone, up }) => (
              <OACard key={label} style={{ padding: "16px 18px" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={16} style={{ color: tone }} />
                  <span className="t-overline">{label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-bold text-[28px] tracking-tight"
                    style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.03em", color: "var(--ink-900)" }}
                  >
                    {value}
                  </span>
                  {up && <TrendingUp size={16} style={{ color: "var(--success)" }} />}
                </div>
                <p className="text-[12.5px] mt-1.5" style={{ color: "var(--fg-muted)" }}>{note}</p>
              </OACard>
            ))}
          </div>

          {/* Trend + Weak */}
          <div className="grid gap-4" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
            {/* Trend chart */}
            <OACard style={{ padding: "18px 22px" }}>
              <div className="flex items-center mb-4">
                <div>
                  <h3 className="font-bold text-[17px]" style={{ fontFamily: "var(--font-display)" }}>Readiness trend</h3>
                  <p className="text-[12.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>Last 8 weeks</p>
                </div>
                <span className="flex-1" />
                <OABadge tone="green" className="gap-1.5">
                  <TrendingUp size={11} /> +25 since March
                </OABadge>
              </div>
              <div className="flex items-end gap-2.5 h-[150px] pt-2.5">
                {WEEKS.map((w, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span
                      className="font-semibold text-[10.5px]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: i === WEEKS.length - 1 ? "var(--gold-700)" : "var(--fg-muted)",
                      }}
                    >
                      {w}
                    </span>
                    <div
                      className="w-full max-w-[34px] rounded-t-[6px]"
                      style={{
                        height: `${(w / maxW) * 100}%`,
                        background: i === WEEKS.length - 1 ? "var(--gold-400)" : "var(--cobalt-400)",
                        opacity: i === WEEKS.length - 1 ? 1 : 0.55,
                      }}
                    />
                    <span
                      className="text-[10px]"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--fg-subtle)" }}
                    >
                      W{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </OACard>

            {/* Where to help */}
            <OACard style={{ padding: "18px 20px" }}>
              <div className="flex items-center gap-1.5 mb-4">
                <Target size={17} style={{ color: "var(--danger)" }} />
                <h3 className="font-bold text-[16px]" style={{ fontFamily: "var(--font-display)" }}>Where to help</h3>
              </div>
              <div className="flex flex-col gap-3.5">
                {WEAK.map(({ subj, topic, mastery }) => (
                  <div key={topic}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <OASubjectDot subject={subj} />
                      <span className="text-[13px] font-semibold flex-1 truncate" style={{ color: "var(--ink-900)" }}>{topic}</span>
                      <span className="text-[12px] shrink-0" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{mastery}%</span>
                    </div>
                    <OAProgressBar value={mastery} tone={mastery < 50 ? "gold" : "brand"} height={6} />
                  </div>
                ))}
              </div>
            </OACard>
          </div>

          {/* Plan + Suggestion */}
          <div className="grid grid-cols-2 gap-4">
            {/* This week's plan */}
            <OACard style={{ padding: "18px 20px" }}>
              <h3 className="font-bold text-[16px] mb-3.5" style={{ fontFamily: "var(--font-display)" }}>
                This week&apos;s plan
              </h3>
              <div className="flex flex-col gap-2.5">
                {PLAN.map(({ title, day, Icon }) => (
                  <div
                    key={title}
                    className="flex items-center gap-3 px-3 py-[11px] rounded-[var(--r-md)] border border-[var(--line-200)]"
                  >
                    <div
                      className="w-[34px] h-[34px] rounded-[var(--r-md)] shrink-0 flex items-center justify-center"
                      style={{ background: "var(--cobalt-50)" }}
                    >
                      <Icon size={17} style={{ color: "var(--brand)" }} />
                    </div>
                    <span className="flex-1 text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>{title}</span>
                    <span
                      className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)", background: "var(--fill-100)" }}
                    >
                      {day}
                    </span>
                  </div>
                ))}
              </div>
            </OACard>

            {/* How you can help */}
            <OACard style={{ padding: "20px 22px", background: "var(--gold-50)", border: "1px solid var(--gold-100)" }}>
              <div className="flex items-center gap-2 mb-2.5">
                <Lightbulb size={19} style={{ color: "var(--gold-700)" }} />
                <h3 className="font-bold text-[16px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
                  How you can help
                </h3>
              </div>
              <p className="text-[14px] leading-[1.6] mb-3.5" style={{ color: "var(--ink-700)" }}>
                {firstName} rushes word problems — accuracy drops when timed. Try a relaxed 15-minute Profit &amp; Loss
                session together this weekend, no timer. Expected readiness gain:{" "}
                <b style={{ fontFamily: "var(--font-mono)" }}>+4</b>.
              </p>
              <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--gold-700)" }}>
                <Sparkles size={14} fill="var(--gold-700)" style={{ color: "var(--gold-700)" }} />
                Generated from this week&apos;s activity
              </div>
            </OACard>
          </div>
        </div>
      ) : (
        /* Placeholder for Reports / Activity tabs */
        <div className="max-w-[1080px] mx-auto px-7 py-16 text-center" style={{ color: "var(--fg-muted)" }}>
          <p className="text-[15px]">{tab} coming in Phase 7 with real data.</p>
        </div>
      )}
    </div>
  );
}
