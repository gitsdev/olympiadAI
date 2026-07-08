"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ArrowLeft, ArrowRight, BookOpen, FlaskConical, Globe, Calculator } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OACard, OABadge, OASubjectDot, type Subject } from "@/components/ui";
import { useStudent } from "@/contexts/StudentContext";
import { cn } from "@/lib/utils";

/* ── Olympiad catalog ────────────────────────────────────────────────── */
interface Olympiad {
  id: string;
  shortName: string;
  fullName: string;
  organiser: string;
  subject: Subject;
  minClass: number;
  maxClass: number;
  desc: string;
  Icon: React.ElementType;
  accent: string;
  accentBg: string;
}

const OLYMPIADS: Olympiad[] = [
  {
    id: "sof-imo",
    shortName: "SOF IMO",
    fullName: "International Mathematics Olympiad",
    organiser: "Science Olympiad Foundation",
    subject: "Mathematics",
    minClass: 1, maxClass: 12,
    desc: "Tests mathematical reasoning, logical thinking, and problem-solving across all chapters.",
    Icon: Calculator,
    accent: "var(--cobalt-600)",
    accentBg: "var(--cobalt-50)",
  },
  {
    id: "sof-nso",
    shortName: "SOF NSO",
    fullName: "National Science Olympiad",
    organiser: "Science Olympiad Foundation",
    subject: "Science",
    minClass: 1, maxClass: 12,
    desc: "Covers physics, chemistry, biology and environmental science at the olympiad level.",
    Icon: FlaskConical,
    accent: "var(--success-tx)",
    accentBg: "var(--success-bg)",
  },
  {
    id: "sof-ieo",
    shortName: "SOF IEO",
    fullName: "International English Olympiad",
    organiser: "Science Olympiad Foundation",
    subject: "English",
    minClass: 1, maxClass: 12,
    desc: "Evaluates vocabulary, grammar, reading comprehension, and writing skills.",
    Icon: BookOpen,
    accent: "var(--gold-700)",
    accentBg: "var(--gold-50)",
  },
  {
    id: "sof-igko",
    shortName: "SOF IGKO",
    fullName: "International General Knowledge Olympiad",
    organiser: "Science Olympiad Foundation",
    subject: "General Knowledge",
    minClass: 1, maxClass: 10,
    desc: "Tests current affairs, history, geography, civics, and world knowledge.",
    Icon: Globe,
    accent: "var(--danger)",
    accentBg: "var(--danger-bg)",
  },
  {
    id: "ioqm",
    shortName: "IOQM",
    fullName: "Indian Olympiad Qualifier in Mathematics",
    organiser: "HBCSE / MTA",
    subject: "Mathematics",
    minClass: 8, maxClass: 12,
    desc: "Gateway to IMO — advanced number theory, algebra, geometry, and combinatorics.",
    Icon: Calculator,
    accent: "oklch(0.32 0.12 259)",
    accentBg: "oklch(0.96 0.02 259)",
  },
  {
    id: "inmo",
    shortName: "INMO",
    fullName: "Indian National Mathematical Olympiad",
    organiser: "HBCSE",
    subject: "Mathematics",
    minClass: 11, maxClass: 12,
    desc: "National-level selection exam with proof-based olympiad problems of the highest difficulty.",
    Icon: Trophy,
    accent: "var(--ink-900)",
    accentBg: "var(--fill-100)",
  },
];

const DIFFICULTIES = ["Easy", "Medium", "Hard", "HOTS"] as const;
const COUNTS = [10, 20, 30, 40] as const;
type Difficulty = typeof DIFFICULTIES[number];
type Step = "select" | "configure";

/* ── Page ────────────────────────────────────────────────────────────── */
export default function TestsPage() {
  const router  = useRouter();
  const student = useStudent();

  const [step, setStep]         = useState<Step>("select");
  const [olympiad, setOlympiad] = useState<Olympiad | null>(null);
  const [selClass, setSelClass] = useState(student.cls);
  const [selDiff, setSelDiff]   = useState<Difficulty>("Medium");
  const [selCount, setSelCount] = useState<number>(20);

  function selectOlympiad(o: Olympiad) {
    setOlympiad(o);
    // Clamp student's class to valid range for this olympiad
    const clamped = Math.max(o.minClass, Math.min(o.maxClass, student.cls));
    setSelClass(clamped);
    setStep("configure");
  }

  function startTest() {
    if (!olympiad) return;
    const topic = `${olympiad.shortName} Class ${selClass} — ${olympiad.subject} Olympiad`;
    const p = new URLSearchParams({
      subject:    olympiad.subject,
      topic,
      difficulty: selDiff,
      count:      String(selCount),
      classLevel: String(selClass),
      autostart:  "1",
    });
    router.push(`/practice?${p.toString()}`);
  }

  /* ── Step 1: Olympiad selector ─────────────────────────────────────── */
  if (step === "select") {
    return (
      <AppShell title="Mock tests" subtitle="Choose your Olympiad">
        <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-6 pb-10">
          <div className="flex items-center gap-3 mb-6">
            <Trophy size={22} style={{ color: "var(--gold-500)" }} />
            <div>
              <h2 className="font-bold text-[20px] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Select an Olympiad
              </h2>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                AI-generated questions matched to each exam's actual syllabus and question style.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {OLYMPIADS.map((o) => {
              const { Icon } = o;
              const eligible = student.cls >= o.minClass && student.cls <= o.maxClass;
              return (
                <button
                  key={o.id}
                  onClick={() => selectOlympiad(o)}
                  className="text-left group"
                >
                  <OACard
                    hover
                    noPadding
                    className={cn(
                      "flex flex-col overflow-hidden transition-all duration-[140ms]",
                      "group-hover:shadow-[var(--shadow-md)]"
                    )}
                  >
                    {/* Accent bar */}
                    <div className="h-[5px] w-full" style={{ background: o.accent }} />

                    <div className="p-5 flex flex-col gap-3 flex-1">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
                          style={{ background: o.accentBg }}
                        >
                          <Icon size={20} style={{ color: o.accent }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-[18px] leading-none tracking-tight"
                            style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
                            {o.shortName}
                          </h3>
                          <p className="text-[11.5px] mt-1 leading-snug" style={{ color: "var(--fg-muted)" }}>
                            {o.fullName}
                          </p>
                        </div>
                      </div>

                      <p className="text-[12.5px] leading-[1.55]" style={{ color: "var(--ink-700)" }}>
                        {o.desc}
                      </p>

                      <div className="flex items-center gap-2 mt-auto pt-1">
                        <OABadge tone="neutral" className="gap-1">
                          <OASubjectDot subject={o.subject} size={7} />
                          {o.subject}
                        </OABadge>
                        <OABadge tone={eligible ? "cobalt" : "neutral"}>
                          Cl {o.minClass}–{o.maxClass}
                        </OABadge>
                        {!eligible && (
                          <span className="text-[11px] ml-auto" style={{ color: "var(--fg-subtle)" }}>
                            Cl {o.minClass}–{o.maxClass} only
                          </span>
                        )}
                        {eligible && (
                          <ArrowRight size={15} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: o.accent }} />
                        )}
                      </div>
                    </div>
                  </OACard>
                </button>
              );
            })}
          </div>
        </div>
      </AppShell>
    );
  }

  /* ── Step 2: Configuration ──────────────────────────────────────────── */
  if (!olympiad) return null;
  const validClasses = Array.from(
    { length: olympiad.maxClass - olympiad.minClass + 1 },
    (_, i) => olympiad.minClass + i
  );

  return (
    <AppShell title="Mock tests" subtitle={`${olympiad.shortName} — Configure your test`}>
      <div className="max-w-[580px] mx-auto px-4 sm:px-7 py-6 pb-10 flex flex-col gap-5">

        {/* Back + selected olympiad header */}
        <button
          onClick={() => setStep("select")}
          className="flex items-center gap-1.5 text-[13px] font-semibold w-fit"
          style={{ color: "var(--brand)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <ArrowLeft size={15} /> Back to Olympiads
        </button>

        <OACard noPadding className="overflow-hidden">
          <div className="h-[4px]" style={{ background: olympiad.accent }} />
          <div className="p-5 flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
              style={{ background: olympiad.accentBg }}
            >
              <olympiad.Icon size={22} style={{ color: olympiad.accent }} />
            </div>
            <div>
              <h2 className="font-bold text-[19px] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                {olympiad.shortName}
              </h2>
              <p className="text-[12.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                {olympiad.fullName} · {olympiad.organiser}
              </p>
            </div>
          </div>
        </OACard>

        {/* Class selection */}
        <OACard style={{ padding: "20px 24px" }}>
          <p className="text-[12px] font-semibold mb-3 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>
            Class
          </p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))" }}>
            {validClasses.map((c) => (
              <button
                key={c}
                onClick={() => setSelClass(c)}
                className="py-2 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-bold cursor-pointer transition-all duration-[140ms]"
                style={{
                  fontFamily:  "var(--font-mono)",
                  borderColor: selClass === c ? olympiad.accent : "var(--line-300)",
                  background:  selClass === c ? olympiad.accentBg : "var(--surface)",
                  color:       selClass === c ? olympiad.accent   : "var(--ink-700)",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </OACard>

        {/* Difficulty */}
        <OACard style={{ padding: "20px 24px" }}>
          <p className="text-[12px] font-semibold mb-3 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>
            Difficulty
          </p>
          <div className="grid grid-cols-4 gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setSelDiff(d)}
                className="py-2.5 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-semibold cursor-pointer transition-all duration-[140ms]"
                style={{
                  borderColor: selDiff === d ? olympiad.accent : "var(--line-300)",
                  background:  selDiff === d ? olympiad.accentBg : "var(--surface)",
                  color:       selDiff === d ? olympiad.accent   : "var(--ink-700)",
                }}
              >
                {d}
              </button>
            ))}
          </div>
          {(olympiad.id === "ioqm" || olympiad.id === "inmo") && (
            <p className="text-[12px] mt-2.5" style={{ color: "var(--fg-muted)" }}>
              IOQM/INMO questions are inherently challenging — "Hard" or "HOTS" recommended.
            </p>
          )}
        </OACard>

        {/* Question count */}
        <OACard style={{ padding: "20px 24px" }}>
          <p className="text-[12px] font-semibold mb-3 uppercase tracking-[0.05em]" style={{ color: "var(--fg-muted)" }}>
            Number of questions
          </p>
          <div className="grid grid-cols-4 gap-2">
            {COUNTS.map((c) => (
              <button
                key={c}
                onClick={() => setSelCount(c)}
                className="py-2.5 rounded-[var(--r-md)] border-[1.5px] text-[14px] font-bold cursor-pointer transition-all duration-[140ms]"
                style={{
                  fontFamily:  "var(--font-mono)",
                  borderColor: selCount === c ? olympiad.accent : "var(--line-300)",
                  background:  selCount === c ? olympiad.accentBg : "var(--surface)",
                  color:       selCount === c ? olympiad.accent   : "var(--ink-700)",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </OACard>

        {/* Summary + start */}
        <div className="rounded-[var(--r-lg)] border border-[var(--line-200)] p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
          style={{ background: "var(--paper-2)" }}>
          <div className="flex-1">
            <p className="text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>
              {olympiad.shortName} · Class {selClass} · {selDiff}
            </p>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
              {selCount} AI-generated questions · Approx {Math.round(selCount * 1.5)} min
            </p>
          </div>
          <button
            onClick={startTest}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold text-white border-none cursor-pointer"
            style={{ background: olympiad.accent, boxShadow: "var(--shadow-brand)" }}
          >
            Start test <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </AppShell>
  );
}
