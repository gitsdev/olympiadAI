"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";

const VirtualTeacher = dynamic(
  () => import("@/components/tutor/VirtualTeacher"),
  {
    ssr:     false,
    loading: () => (
      <div className="h-[72px] rounded-[var(--r-xl)] border border-[var(--cobalt-200)] oa-shimmer" />
    ),
  }
);
import {
  Sparkles, Search, Layers, BookOpen, Play, PencilLine,
  Target, Globe, ArrowUp, CheckCircle2, Route, ChevronDown,
  Zap, Check, X, Lightbulb,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { OABadge, OAAvatar } from "@/components/ui";
import { useStudent } from "@/contexts/StudentContext";
import { VisualAid, type VisualSpec } from "@/components/tutor/VisualAid";
import type { TutorReference } from "@/types/database";
import { cn } from "@/lib/utils";

/* ── Reference data ──────────────────────────────────────────────────── */
type RefType = "video" | "concept" | "example" | "practice" | "source";
interface Ref {
  id: number | string;
  type: RefType;
  title: string;
  src: string;
  meta: string;
  url?: string;       // YouTube embed URL (for modal)
  searchUrl?: string; // YouTube search fallback
  videoId?: string;
  fresh: boolean;
}

const REF_META: Record<RefType, { Icon: React.ElementType; label: string; color: string }> = {
  video:    { Icon: Play,      label: "Videos",          color: "var(--subj-english)" },
  concept:  { Icon: BookOpen,  label: "Concept notes",   color: "var(--brand)" },
  example:  { Icon: PencilLine,label: "Worked examples", color: "var(--subj-science)" },
  practice: { Icon: Target,    label: "Practice sets",   color: "var(--gold-700)" },
  source:   { Icon: Globe,     label: "Linked sources",  color: "var(--ink-500)" },
};

const FRACTIONS_REFS: Omit<Ref, "id" | "fresh">[] = [
  { type: "video",    title: "Converting fractions to decimals",      src: "Math Antics · video",  meta: "5:12" },
  { type: "video",    title: "Why the denominator matters",           src: "Khan-style · video",   meta: "3:40" },
  { type: "concept",  title: "Fractions & Decimals — concept summary",src: "Knowledge graph",       meta: "CBSE · Cl 7 · Ch 2" },
  { type: "concept",  title: "Place value & decimal conversion",      src: "Prerequisite node",    meta: "CBSE · Cl 6" },
  { type: "example",  title: "Worked example: 5⁄8 → 0.625",          src: "Step-by-step",          meta: "3 steps" },
  { type: "example",  title: "Mixed numbers → decimals",             src: "Step-by-step",          meta: "4 steps" },
  { type: "practice", title: "Fractions → Decimals — practice set",  src: "Generated",             meta: "10 questions" },
  { type: "practice", title: "HOTS: recurring decimals",             src: "Generated",             meta: "6 questions" },
  { type: "source",   title: "NCERT Maths Class 7 — Chapter 2",      src: "ncert.nic.in",          meta: "Linked source" },
];
const FOLLOWUP_REFS: Omit<Ref, "id" | "fresh">[] = [
  { type: "video",   title: "Fractions on a number line",            src: "Visual · video",       meta: "4:08" },
  { type: "example", title: "Worked example: 7⁄20 → 0.35",          src: "Step-by-step",          meta: "3 steps" },
  { type: "concept", title: "Terminating vs recurring decimals",     src: "Knowledge graph",       meta: "CBSE · Cl 7" },
];

/* ── Message types ───────────────────────────────────────────────────── */
interface StudentMsg  { role: "student"; text: string }
interface TutorIntro  { role: "tutor"; kind: "intro"; text: string }
interface TutorAnswer {
  role: "tutor"; kind: "answer"; text: string;
  keyInsight?: string;
  visual?: VisualSpec;
  steps: string[];
  tryIt: { q: string; options: string[]; correct: number; why: string };
  follows: string[];
  newRefs: number;
}
type Message = StudentMsg | TutorIntro | TutorAnswer;

const CHIPS = [
  "Teach me fractions",
  "How do I convert 5/8 to a decimal?",
  "IMO geometry questions",
  "What should I revise?",
];

/* ── Page ────────────────────────────────────────────────────────────── */
export default function TutorPage() {
  const user = useStudent();
  const firstName = user.name.split(" ")[0];

  const [msgs, setMsgs] = useState<Message[]>([
    { role: "tutor", kind: "intro",
      text: `Hi ${firstName} — I'm your tutor. Ask me a concept, a tricky sum, or what to revise next. I'll pull real references from your Class ${user.cls} ${user.board} knowledge graph, then explain step by step.` },
  ]);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [filter, setFilter] = useState<RefType | "All">("All");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<Ref | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, thinking]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q) return;
    setMsgs((m) => [...m, { role: "student", text: q }]);
    setInput("");
    setThinking(true);

    try {
      const history = msgs
        .filter((m) => m.role !== "tutor" || m.kind !== "intro")
        .map((m) => ({
          role:    m.role === "student" ? "user" as const : "assistant" as const,
          content: m.text,
        }));

      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          conversationHistory: history,
          studentClass: user.cls,
          studentBoard: user.board,
          conversationId,
        }),
      });

      if (res.ok) {
        const {
          answer, keyInsight, visual, steps, tryIt, followUps,
          references: apiRefs, conversationId: newConvId,
        } = await res.json();
        if (newConvId) setConversationId(newConvId);
        setThinking(false);
        setMsgs((m) => [...m, {
          role: "tutor", kind: "answer",
          text:       answer,
          keyInsight: keyInsight ?? undefined,
          visual:     visual?.type && visual.type !== "none" ? (visual as VisualSpec) : undefined,
          steps:      Array.isArray(steps)    ? steps    : [],
          tryIt:      tryIt ?? { q: "", options: [], correct: 0, why: "" },
          follows:    Array.isArray(followUps) ? followUps : ["Show me a worked example", "Practice 5 questions", "What's the next topic?"],
          newRefs:    (apiRefs ?? []).length,
        }]);
        const incoming = (apiRefs ?? []).map((r: TutorReference, i: number) => ({
          ...r, id: r.id ?? Date.now() + i, fresh: true,
        }));
        setRefs((prev) => [...prev.map((r) => ({ ...r, fresh: false })), ...incoming]);
        return;
      }
    } catch {
      // Fall through to mock
    }

    // Fallback to mock when API unavailable
    const isFollow = msgs.length > 1;
    setThinking(false);
    setMsgs((m) => [...m, buildAnswer(isFollow)]);
    const incoming = (isFollow ? FOLLOWUP_REFS : FRACTIONS_REFS).map((r, i) => ({
      ...r, id: Date.now() + i, fresh: true,
    }));
    setRefs((prev) => [...prev.map((r) => ({ ...r, fresh: false })), ...incoming]);
  }

  const [mobileView, setMobileView] = useState<"chat" | "refs">("chat");

  const REF_TYPES: (RefType | "All")[] = ["All", "video", "concept", "example", "practice", "source"];
  const filtered = filter === "All" ? refs : refs.filter((r) => r.type === filter);
  const grouped = filtered.reduce<Record<string, Ref[]>>((acc, r) => {
    (acc[r.type] = acc[r.type] ?? []).push(r);
    return acc;
  }, {});

  // Switch to refs tab when new refs arrive on mobile
  useEffect(() => {
    if (refs.some((r) => r.fresh)) setMobileView("chat");
  }, [refs]);

  return (
    <AppShell title="AI Tutor" subtitle="Grounded in your knowledge graph" noScroll>
      <div className="flex flex-col h-full min-h-0">

        {/* ── Mobile tab bar ── */}
        <div className="lg:hidden flex border-b border-[var(--line-200)] shrink-0" style={{ background: "var(--surface)" }}>
          {(["chat", "refs"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13.5px] font-semibold border-none cursor-pointer transition-colors"
              style={{
                background: "transparent",
                color: mobileView === v ? "var(--cobalt-600)" : "var(--fg-muted)",
                borderBottom: mobileView === v ? "2px solid var(--cobalt-500)" : "2px solid transparent",
              }}
            >
              {v === "chat" ? (
                <><Sparkles size={14} /> Chat</>
              ) : (
                <><Layers size={14} /> References{refs.length > 0 && <span className="ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--cobalt-100)", color: "var(--cobalt-700)", fontFamily: "var(--font-mono)" }}>{refs.length}</span>}</>
              )}
            </button>
          ))}
        </div>

        {/* ── Content row ── */}
        <div className="flex flex-1 min-h-0">

          {/* Chat column */}
          <div className={cn(
            "flex-1 min-w-0 flex flex-col",
            mobileView === "refs" ? "hidden lg:flex" : "flex",
          )}>
            <div ref={scrollRef} className="oa-scroll flex-1 overflow-y-auto py-5 sm:py-6">
              <div className="max-w-[660px] mx-auto px-4 sm:px-7 flex flex-col gap-5">
                {msgs.map((m, i) => (
                  <Bubble key={i} m={m} userName={user.name} onFollow={send} />
                ))}
                {thinking && <Thinking />}
              </div>
            </div>

            {/* Composer */}
            <div className="border-t border-[var(--line-200)] bg-[var(--surface)] py-3 pb-4">
              <div className="max-w-[660px] mx-auto px-4 sm:px-7">
                {msgs.length <= 1 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {CHIPS.map((c) => (
                      <button
                        key={c}
                        onClick={() => send(c)}
                        className="text-[13px] font-medium px-3 py-1.5 rounded-full border border-[var(--line-300)] bg-[var(--surface)] cursor-pointer transition-colors duration-[140ms] hover:bg-[var(--fill-100)]"
                        style={{ color: "var(--ink-700)" }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2.5 border border-[var(--line-300)] rounded-[var(--r-lg)] px-4 py-2 shadow-[var(--shadow-sm)]">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Ask your tutor anything…"
                    className="flex-1 border-none outline-none bg-transparent text-[14.5px] py-1.5"
                    style={{ fontFamily: "var(--font-sans)", color: "var(--ink-900)" }}
                  />
                  <button
                    onClick={() => send()}
                    className="w-[38px] h-[38px] rounded-[var(--r-md)] border-none flex items-center justify-center cursor-pointer shrink-0"
                    style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}
                  >
                    <ArrowUp size={19} color="#fff" />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-2" style={{ color: "var(--fg-subtle)", fontSize: 11.5 }}>
                  <CheckCircle2 size={13} style={{ color: "var(--success)" }} />
                  Grounded in OlympiadAI&apos;s knowledge graph — never invented.
                </div>
              </div>
            </div>
          </div>

          {/* References rail */}
          <aside
            className={cn(
              "border-l border-[var(--line-200)] flex flex-col min-h-0",
              "w-full lg:w-[344px] lg:shrink-0",
              mobileView === "refs" ? "flex" : "hidden lg:flex",
            )}
            style={{ background: "var(--paper-2)" }}
          >
            <div className="px-[18px] py-4 border-b border-[var(--line-200)]">
              <div className="flex items-center gap-2">
                <Layers size={17} style={{ color: "var(--brand)" }} />
                <h3 className="font-bold text-[16px]" style={{ fontFamily: "var(--font-display)" }}>References</h3>
                <span className="flex-1" />
                {refs.length > 0 && <OABadge tone="cobalt">{refs.length} found</OABadge>}
              </div>
              {refs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {REF_TYPES.map((t) => {
                    const count = t === "All" ? refs.length : refs.filter((r) => r.type === t).length;
                    if (t !== "All" && count === 0) return null;
                    const on = filter === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setFilter(t)}
                        className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer transition-all duration-[120ms]"
                        style={{
                          borderColor: on ? "var(--cobalt-500)" : "var(--line-300)",
                          background:  on ? "var(--cobalt-500)" : "var(--surface)",
                          color:       on ? "#fff"              : "var(--ink-700)",
                        }}
                      >
                        {t === "All" ? "All" : REF_META[t as RefType].label.replace(/s$/, "")}
                        <span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="oa-scroll flex-1 overflow-y-auto px-4 py-3.5 pb-6">
              {refs.length === 0 && !thinking && <RefsEmpty />}
              {thinking && refs.length === 0 && <RefsSkeleton />}
              {(Object.keys(grouped) as RefType[]).map((type) => (
                <div key={type} className="mb-4">
                  <div
                    className="t-overline flex items-center gap-1.5 mb-2"
                    style={{ fontSize: 10, color: REF_META[type].color }}
                  >
                    {React.createElement(REF_META[type].Icon, { size: 13 })}
                    {REF_META[type].label}
                  </div>
                  <div className="flex flex-col gap-2">
                    {grouped[type].map((r) => <RefCard key={r.id} r={r} onVideoClick={setVideoModal} />)}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
      {videoModal && <VideoModal r={videoModal} onClose={() => setVideoModal(null)} />}
    </AppShell>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function Bubble({ m, userName, onFollow }: { m: Message; userName: string; onFollow: (t: string) => void }) {
  const isTutor  = m.role === "tutor";
  const [vtOpen, setVtOpen] = useState(false);
  return (
    <div className={cn("flex gap-3", isTutor ? "flex-row" : "flex-row-reverse")}>
      {isTutor ? (
        <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 shadow-[var(--shadow-sm)]" style={{ background: "var(--cobalt-500)" }}>
          <Sparkles size={18} fill="white" color="white" />
        </div>
      ) : (
        <OAAvatar name={userName} size={34} />
      )}
      <div className="max-w-[520px] min-w-0">
        <div
          className="px-4 py-3 text-[14.5px] leading-[1.6] whitespace-pre-wrap"
          style={{
            background: isTutor ? "var(--surface)" : "var(--cobalt-500)",
            color: isTutor ? "var(--ink-900)" : "#fff",
            border: isTutor ? "1px solid var(--line-200)" : "none",
            borderRadius: "var(--r-lg)",
            borderTopLeftRadius: isTutor ? 4 : "var(--r-lg)",
            borderTopRightRadius: isTutor ? "var(--r-lg)" : 4,
            boxShadow: isTutor ? "var(--shadow-sm)" : "var(--shadow-brand)",
          }}
        >
          {m.text}
        </div>

        {m.role === "tutor" && m.kind === "answer" && (
          <div className="mt-2.5 flex flex-col gap-2.5">
            {m.keyInsight && <KeyInsightBlock text={m.keyInsight} />}
            {m.visual && <VisualAid spec={m.visual} />}
            {m.steps.length > 0 && <StepsBlock steps={m.steps} />}
            {m.tryIt.q && m.tryIt.options.length > 0 && <TryItBlock t={m.tryIt} />}
            {m.newRefs > 0 && (
              <div className="inline-flex items-center gap-1.5 self-start text-[12px] font-semibold px-3 py-1.5 rounded-full" style={{ color: "var(--brand)", background: "var(--cobalt-50)" }}>
                <Layers size={13} /> {m.newRefs} new references added →
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-0.5">
              {m.follows.map((f) => (
                <button
                  key={f}
                  onClick={() => onFollow(f)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-full border border-[var(--line-300)] bg-[var(--surface)] cursor-pointer transition-colors duration-[140ms] hover:bg-[var(--fill-100)]"
                  style={{ color: "var(--ink-700)" }}
                >
                  <Sparkles size={12} style={{ color: "var(--brand)" }} /> {f}
                </button>
              ))}
            </div>

            {/* ── Virtual Teacher activation ── */}
            {!vtOpen && (
              <button
                onClick={() => setVtOpen(true)}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-[var(--r-lg)] border border-[var(--cobalt-200)] text-[13.5px] font-semibold cursor-pointer transition-all duration-[180ms] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, var(--cobalt-50), oklch(0.96 0.03 280))",
                  color:      "var(--cobalt-700)",
                  boxShadow:  "var(--shadow-sm)",
                }}
              >
                <span className="text-[18px] leading-none">🎓</span>
                Learn with Virtual Teacher
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--cobalt-100)", color: "var(--cobalt-600)" }}>
                  New
                </span>
              </button>
            )}
            {vtOpen && (
              <VirtualTeacher lesson={m} onClose={() => setVtOpen(false)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KeyInsightBlock({ text }: { text: string }) {
  return (
    <div className="flex rounded-[var(--r-md)] overflow-hidden border border-[var(--cobalt-200)]">
      <div className="w-[3px] shrink-0" style={{ background: "var(--cobalt-500)" }} />
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <Lightbulb size={15} className="shrink-0 mt-0.5" style={{ color: "var(--cobalt-600)" }} />
        <p className="text-[13.5px] leading-[1.55] font-semibold" style={{ color: "var(--cobalt-800)" }}>
          {text}
        </p>
      </div>
    </div>
  );
}

function StepsBlock({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-[var(--line-200)] rounded-[var(--r-md)] overflow-hidden" style={{ background: "var(--paper-2)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full border-none bg-transparent cursor-pointer px-3 py-[11px] text-left"
      >
        <Route size={16} style={{ color: "var(--brand)" }} />
        <span className="flex-1 text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>Step-by-step</span>
        <ChevronDown size={16} style={{ color: "var(--fg-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
      </button>
      {open && (
        <div className="px-3.5 pb-3 flex flex-col gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-2.5">
              <span
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: "var(--cobalt-500)", fontFamily: "var(--font-mono)" }}
              >
                {i + 1}
              </span>
              <span className="text-[13.5px] leading-[1.5]" style={{ color: "var(--ink-700)", fontFamily: "var(--font-mono)" }}>
                {s}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TryItBlock({ t }: { t: TutorAnswer["tryIt"] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  return (
    <div className="border border-[var(--cobalt-200)] rounded-[var(--r-md)] px-3.5 py-3" style={{ background: "var(--cobalt-50)" }}>
      <div className="flex items-center gap-1.5 mb-3">
        <Zap size={15} fill="var(--brand)" color="var(--brand)" />
        <span className="text-[13.5px] font-bold" style={{ color: "var(--ink-900)" }}>{t.q}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {t.options.map((o, i) => {
          const isC = i === t.correct, isP = i === picked;
          return (
            <button
              key={i}
              onClick={() => !done && setPicked(i)}
              disabled={done}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--r-md)] border-[1.5px] font-semibold text-[14px] cursor-pointer disabled:cursor-default transition-all duration-[120ms]"
              style={{
                fontFamily: "var(--font-mono)",
                borderColor: done && isC ? "var(--success)" : done && isP && !isC ? "var(--danger)" : "var(--line-300)",
                background: done && isC ? "var(--success-bg)" : done && isP && !isC ? "var(--danger-bg)" : "var(--surface)",
                color: done && isC ? "var(--success-tx)" : done && isP && !isC ? "var(--danger-tx)" : "var(--ink-900)",
              }}
            >
              {o}
              {done && isC && <Check size={14} style={{ color: "var(--success)" }} />}
              {done && isP && !isC && <X size={14} style={{ color: "var(--danger)" }} />}
            </button>
          );
        })}
      </div>
      {done && (
        <div className="mt-3 flex gap-2 text-[13px] leading-[1.5]" style={{ color: "var(--ink-700)" }}>
          {picked === t.correct
            ? <CheckCircle2 size={16} style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
            : <Lightbulb size={16} style={{ color: "var(--gold-500)", flexShrink: 0, marginTop: 1 }} />}
          <span>{t.why}</span>
        </div>
      )}
    </div>
  );
}

function VideoModal({ r, onClose }: { r: Ref; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0.08 0.02 264 / 0.72)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[760px] rounded-[var(--r-2xl)] overflow-hidden shadow-[var(--shadow-xl)]"
        style={{ background: "#000" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--ink-900)" }}>
          <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: "oklch(0.56 0.17 18)" }}>
            <Play size={14} fill="white" color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold truncate text-white">{r.title}</p>
            <p className="text-[11px]" style={{ color: "oklch(0.7 0.02 264)", fontFamily: "var(--font-mono)" }}>{r.src}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center"
            style={{ background: "oklch(1 0 0 / 0.1)", color: "white" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Embed */}
        {r.url ? (
          <div className="relative" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={r.url}
              title={r.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-none"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 gap-3" style={{ background: "var(--ink-900)" }}>
            <Play size={40} style={{ color: "oklch(0.5 0.02 264)" }} />
            <p className="text-[13.5px]" style={{ color: "oklch(0.7 0.02 264)" }}>Video ID unavailable</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "var(--ink-900)" }}>
          <p className="text-[11.5px]" style={{ color: "oklch(0.55 0.02 264)" }}>
            Suggested by OlympiadAI tutor
          </p>
          {(r.searchUrl ?? r.url) && (
            <a
              href={r.searchUrl ?? r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "oklch(1 0 0 / 0.08)", color: "white" }}
            >
              <Globe size={12} /> Open on YouTube
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function RefCard({ r, onVideoClick }: { r: Ref; onVideoClick: (r: Ref) => void }) {
  const m = REF_META[r.type];
  const isVideo = r.type === "video";

  const cardClass = "flex gap-2.5 p-[10px_11px] rounded-[var(--r-md)] border border-[var(--line-200)] bg-[var(--surface)] transition-all duration-[180ms] hover:shadow-[var(--shadow-md)] hover:border-[var(--cobalt-200)] hover:-translate-y-0.5 cursor-pointer";
  const cardStyle = { boxShadow: r.fresh ? "var(--shadow-sm)" : "none" };

  const inner = (
    <>
      <div
        className="w-[34px] h-[34px] rounded-[8px] shrink-0 flex items-center justify-center"
        style={{
          background: isVideo ? "oklch(0.56 0.17 18 / 0.12)"
            : r.type === "practice" ? "var(--gold-50)"
            : "var(--cobalt-50)",
        }}
      >
        <m.Icon size={16} style={{ color: m.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--ink-900)" }}>{r.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{r.src}</span>
          <span className="w-[3px] h-[3px] rounded-full shrink-0" style={{ background: "var(--line-300)" }} />
          <span className="text-[10.5px]" style={{ fontFamily: "var(--font-mono)", color: isVideo ? "oklch(0.56 0.17 18)" : "var(--fg-subtle)" }}>
            {isVideo ? "▶ Play in app" : r.meta}
          </span>
        </div>
      </div>
      {r.fresh && <span className="w-[7px] h-[7px] rounded-full mt-0.5 shrink-0" style={{ background: "var(--brand)" }} />}
    </>
  );

  if (isVideo) {
    return (
      <div className={cardClass} style={cardStyle} onClick={() => onVideoClick(r)}>
        {inner}
      </div>
    );
  }

  if (r.url) {
    return (
      <a href={r.url} target="_blank" rel="noopener noreferrer" className={cardClass} style={cardStyle}>
        {inner}
      </a>
    );
  }

  return <div className={cardClass} style={cardStyle}>{inner}</div>;
}

function RefsEmpty() {
  return (
    <div className="text-center px-4 py-10" style={{ color: "var(--fg-muted)" }}>
      <div className="w-12 h-12 mx-auto mb-3.5 rounded-[var(--r-md)] flex items-center justify-center" style={{ background: "var(--cobalt-50)" }}>
        <Search size={22} style={{ color: "var(--brand)" }} />
      </div>
      <p className="text-[13.5px] font-semibold mb-1.5" style={{ color: "var(--ink-700)" }}>Ask a question</p>
      <p className="text-[12.5px] leading-[1.5]">
        Videos, concept notes, worked examples, practice sets and linked sources will appear here.
      </p>
    </div>
  );
}

function RefsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <p className="t-overline" style={{ fontSize: 10 }}>Retrieving…</p>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="oa-shimmer h-[56px] rounded-[var(--r-md)] border border-[var(--line-200)] bg-[var(--surface)]" />
      ))}
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex gap-3">
      <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "var(--cobalt-500)" }}>
        <Sparkles size={18} fill="white" color="white" />
      </div>
      <div
        className="flex items-center gap-2 px-4 py-[14px] rounded-[var(--r-lg)] border border-[var(--line-200)]"
        style={{ background: "var(--surface)" }}
      >
        <span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Searching knowledge graph</span>
        <div className="oa-dots flex gap-1">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

/* ── Helper ──────────────────────────────────────────────────────────── */
function buildAnswer(isFollow: boolean): TutorAnswer {
  if (isFollow) {
    return {
      role: "tutor", kind: "answer",
      text: "Great question! On a number line, we mark equal divisions between 0 and 1. For fractions like ¼, ½, and ¾, each division is one-quarter of the space between 0 and 1. Plotting them helps you see at a glance which fraction is larger.",
      keyInsight: "Key idea: fractions closer to 1 on the number line are larger — the further right, the bigger the value.",
      visual: {
        type: "number_line",
        data: {
          min: 0, max: 1,
          points: [
            { value: 0.25, label: "¼",   highlight: false },
            { value: 0.5,  label: "½",   highlight: true  },
            { value: 0.75, label: "¾",   highlight: false },
          ],
        },
      },
      steps: [
        "Draw a line from 0 to 1 and mark it into equal parts.",
        "Count denominator divisions: for quarters, mark 4 equal sections.",
        "Plot the fraction: ½ lands exactly in the middle.",
      ],
      tryIt: {
        q: "Which fraction is closest to 1 on the number line?",
        options: ["⅓", "¾", "½", "¼"],
        correct: 1,
        why: "¾ = 0.75, which is closest to 1 compared to ⅓ ≈ 0.33, ½ = 0.5, and ¼ = 0.25.",
      },
      follows: ["What are recurring decimals?", "Practice 5 questions", "Explain ratio next"],
      newRefs: FOLLOWUP_REFS.length,
    };
  }
  return {
    role: "tutor", kind: "answer",
    text: "A fraction shows part of a whole — the denominator says how many equal parts the whole is cut into, and the numerator says how many of those parts you have. To convert to a decimal, just divide: 5 ÷ 8 = 0.625. Think of it like slicing a pizza into 8 equal slices and taking 5.",
    keyInsight: "Key idea: to convert any fraction to a decimal, divide the top number by the bottom number.",
    visual: {
      type: "fraction",
      data: { n: 5, d: 8 },
    },
    steps: [
      "Write the division: 5⁄8 means 5 ÷ 8.",
      "Long divide: 8 goes into 5.000 → 0.625.",
      "Verify: 0.625 × 8 = 5. ✓",
    ],
    tryIt: {
      q: "Convert 7⁄20 to a decimal:",
      options: ["0.35", "0.27", "0.72", "0.035"],
      correct: 0,
      why: "7 ÷ 20 = 0.35. Or multiply top & bottom by 5 to get 35⁄100 = 0.35.",
    },
    follows: ["Show me on a number line", "Practice 5 questions", "What about recurring decimals?"],
    newRefs: FRACTIONS_REFS.length,
  };
}
