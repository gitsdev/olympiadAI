"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Clock, Star, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OABadge, OACard, OASubjectDot, type Subject } from "@/components/ui";
import { useStudent } from "@/contexts/StudentContext";

const TYPES = ["All", "Topic", "Chapter", "Subject", "Olympiad", "Adaptive"];

const TESTS = [
  { subj: "Mathematics" as Subject, title: "Number System — full chapter", kind: "Chapter",  q: 25, min: 30, diff: "Medium", topic: "Number System" },
  { subj: "Mathematics" as Subject, title: "IMO Mock · Set 4",             kind: "Olympiad", q: 35, min: 60, diff: "Hard",   topic: "Mixed Topics", star: true },
  { subj: "Science"     as Subject, title: "Light & Reflection",           kind: "Topic",    q: 12, min: 15, diff: "Easy",   topic: "Light and Reflection" },
  { subj: "Mathematics" as Subject, title: "Adaptive diagnostic",          kind: "Adaptive", q: 20, min: 25, diff: "Adaptive", topic: "Mixed Topics" },
  { subj: "English"     as Subject, title: "Reading comprehension",        kind: "Topic",    q: 15, min: 20, diff: "Medium", topic: "Reading Comprehension" },
  { subj: "Cyber"       as Subject, title: "Logical reasoning sprint",     kind: "Subject",  q: 30, min: 35, diff: "Hard",   topic: "Logical Reasoning" },
];

const RECENT = [
  { title: "Number System",          score: 87, q: 12 },
  { title: "Fractions & Decimals",   score: 92, q: 10 },
  { title: "IMO Mock · Set 3",       score: 64, q: 35 },
];

const DIFF_TONE: Record<string, "green" | "amber" | "red" | "cobalt" | "neutral"> = {
  Easy: "green", Medium: "amber", Hard: "red", HOTS: "cobalt", Adaptive: "neutral",
};

const BUILDER_SUBJECTS = ["Mathematics", "Science", "English", "General Knowledge", "Cyber"] as Subject[];
const BUILDER_DIFFS    = ["Easy", "Medium", "Hard", "Adaptive"];

export default function TestsPage() {
  const router  = useRouter();
  const student = useStudent();

  const [type, setType]           = useState("All");
  const [bSubject, setBSubject]   = useState<Subject>(
    (student.subjects[0] as Subject) ?? "Mathematics"
  );
  const [bTopic, setBTopic]       = useState("");
  const [bDiff, setBDiff]         = useState("Medium");
  const [bCount, setBCount]       = useState(15);

  const shown = type === "All" ? TESTS : TESTS.filter((t) => t.kind === type);

  function practiceUrl(subj: Subject, topic: string, diff: string, count: number) {
    const p = new URLSearchParams({
      subject: subj, topic, difficulty: diff, count: String(count), autostart: "1",
    });
    return `/practice?${p.toString()}`;
  }

  function launchBuilder() {
    router.push(practiceUrl(bSubject, bTopic || bSubject, bDiff, bCount));
  }

  return (
    <AppShell title="Mock tests" subtitle="Take one, or build your own">
      <div className="px-7 py-6 pb-10">
        <div className="grid grid-cols-[1fr_300px] gap-5 items-start">
          <div>
            {/* Filter chips */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {TYPES.map((ty) => (
                <button
                  key={ty}
                  onClick={() => setType(ty)}
                  className="text-[13px] font-semibold px-3.5 py-1.5 rounded-full border cursor-pointer transition-all duration-[140ms]"
                  style={{
                    borderColor: type === ty ? "var(--brand)" : "var(--line-300)",
                    background:  type === ty ? "var(--cobalt-500)" : "var(--surface)",
                    color:       type === ty ? "#fff" : "var(--ink-700)",
                  }}
                >
                  {ty}
                </button>
              ))}
            </div>

            {/* Test grid */}
            <div className="grid grid-cols-2 gap-3.5">
              {shown.map((t, i) => (
                <button
                  key={i}
                  onClick={() => router.push(practiceUrl(t.subj, t.topic, t.diff, t.q))}
                  className="text-left"
                >
                  <OACard hover noPadding className="p-4 flex flex-col gap-3 cursor-pointer">
                    <div className="flex items-start">
                      <div className="flex items-center gap-1.5">
                        <OASubjectDot subject={t.subj} />
                        <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em]" style={{ color: "var(--fg-muted)" }}>{t.kind}</span>
                      </div>
                      <span className="flex-1" />
                      {"star" in t && t.star && <Star size={15} fill="var(--gold-400)" style={{ color: "var(--gold-400)" }} />}
                    </div>
                    <h3
                      className="font-bold text-[16.5px] leading-snug tracking-tight min-h-[40px]"
                      style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
                    >
                      {t.title}
                    </h3>
                    <div className="flex items-center gap-3" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>
                      <span className="flex items-center gap-1"><FileText size={13} />{t.q} Q</span>
                      <span className="flex items-center gap-1"><Clock size={13} />{t.min}m</span>
                      <span className="flex-1" />
                      <OABadge tone={DIFF_TONE[t.diff] ?? "neutral"}>{t.diff}</OABadge>
                    </div>
                  </OACard>
                </button>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-5">
            {/* Custom builder */}
            <OACard style={{ padding: "18px 20px", border: "1.5px solid var(--cobalt-200)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Plus size={18} style={{ color: "var(--brand)" }} />
                <h3 className="font-bold text-[17px]" style={{ fontFamily: "var(--font-display)" }}>Build a custom test</h3>
              </div>
              <p className="text-[12.5px] mb-4" style={{ color: "var(--fg-muted)" }}>Generated fresh from your knowledge graph.</p>

              {/* Subject dropdown */}
              <div className="mb-3">
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--ink-700)" }}>Subject</p>
                <select
                  value={bSubject}
                  onChange={(e) => setBSubject(e.target.value as Subject)}
                  className="w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--cobalt-400)] cursor-pointer"
                  style={{ background: "var(--surface)", color: "var(--ink-900)" }}
                >
                  {BUILDER_SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Topic */}
              <div className="mb-3">
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--ink-700)" }}>Topic <span style={{ fontWeight: 400, color: "var(--fg-muted)" }}>(optional)</span></p>
                <input
                  value={bTopic}
                  onChange={(e) => setBTopic(e.target.value)}
                  placeholder={`e.g. Fractions, Photosynthesis…`}
                  className="w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--cobalt-400)] transition-colors"
                  style={{ background: "var(--surface)", color: "var(--ink-900)" }}
                />
              </div>

              {/* Difficulty */}
              <div className="mb-3">
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--ink-700)" }}>Difficulty</p>
                <div className="flex gap-1.5">
                  {BUILDER_DIFFS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setBDiff(d)}
                      className="flex-1 py-1.5 rounded-[var(--r-md)] border-[1.5px] text-[12px] font-semibold cursor-pointer transition-all"
                      style={{
                        borderColor: bDiff === d ? "var(--cobalt-400)" : "var(--line-300)",
                        background:  bDiff === d ? "var(--cobalt-50)"  : "var(--surface)",
                        color:       bDiff === d ? "var(--cobalt-700)" : "var(--ink-700)",
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question count slider */}
              <div className="mb-4">
                <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--ink-700)" }}>
                  Questions: <span style={{ fontFamily: "var(--font-mono)", color: "var(--brand)" }}>{bCount}</span>
                </p>
                <input
                  type="range" min={5} max={30} step={5} value={bCount}
                  onChange={(e) => setBCount(+e.target.value)}
                  className="w-full"
                  style={{ accentColor: "var(--cobalt-500)" }}
                />
              </div>

              <button
                onClick={launchBuilder}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold text-white border-none cursor-pointer"
                style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}
              >
                <Zap size={16} /> Generate test
              </button>
            </OACard>

            {/* Recent attempts */}
            <OACard style={{ padding: "16px 18px" }}>
              <p className="t-overline mb-3">Recent attempts</p>
              <div className="flex flex-col gap-3">
                {RECENT.map((r) => (
                  <div key={r.title} className="flex items-center gap-2.5 px-1">
                    <div
                      className="w-[38px] h-[38px] rounded-[var(--r-md)] shrink-0 flex items-center justify-center"
                      style={{
                        background: r.score >= 85 ? "var(--success-bg)" : r.score >= 70 ? "var(--cobalt-50)" : "var(--gold-50)",
                      }}
                    >
                      <span
                        className="font-bold text-[14px]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: r.score >= 85 ? "var(--success-tx)" : r.score >= 70 ? "var(--cobalt-700)" : "var(--gold-700)",
                        }}
                      >
                        {r.score}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{r.title}</p>
                      <p className="text-[11.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{r.q} questions</p>
                    </div>
                    <ChevronRight size={17} style={{ color: "var(--fg-subtle)" }} />
                  </div>
                ))}
              </div>
            </OACard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
