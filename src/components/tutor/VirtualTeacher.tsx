"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X, ChevronLeft, ChevronRight,
  Volume2, VolumeX, Play, Pause,
  Check, Lightbulb,
} from "lucide-react";
import { VisualAid, type VisualSpec } from "@/components/tutor/VisualAid";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface LessonData {
  text: string;
  keyInsight?: string;
  visual?: VisualSpec;
  steps: string[];
  tryIt: { q: string; options: string[]; correct: number; why: string };
  follows: string[];
}

interface LessonStep {
  kind: "intro" | "explain" | "question" | "summary";
  title: string;
  text: string;
  visual?: VisualSpec;
  options?: string[];
  correct?: number;
  why?: string;
}

/* ── Lesson builder ─────────────────────────────────────────────────── */

function buildSteps(lesson: LessonData): LessonStep[] {
  const result: LessonStep[] = [];

  // 1. Intro — first sentence only
  const introText = lesson.text.match(/^[^.!?]+[.!?]/)?.[0] ?? lesson.text.slice(0, 100) + "…";
  result.push({ kind: "intro", title: "Introduction", text: introText });

  // 2. Full explanation + visual
  result.push({
    kind: "explain", title: "Explanation",
    text: lesson.text,
    visual: lesson.visual,
  });

  // 3. Individual steps (if any)
  lesson.steps.forEach((s, i) => {
    result.push({ kind: "explain", title: `Step ${i + 1}`, text: s });
  });

  // 4. Key insight (if present)
  if (lesson.keyInsight) {
    result.push({ kind: "explain", title: "Key Takeaway", text: lesson.keyInsight });
  }

  // 5. Comprehension check (if present)
  if (lesson.tryIt.q && lesson.tryIt.options.length > 0) {
    result.push({
      kind: "question", title: "Quick Check",
      text: lesson.tryIt.q,
      options: lesson.tryIt.options,
      correct: lesson.tryIt.correct,
      why: lesson.tryIt.why,
    });
  }

  // 6. Summary
  result.push({
    kind: "summary", title: "Well done!",
    text: "You've covered all the key concepts in this lesson. Keep practising to make it stick — you're doing great!",
  });

  return result;
}

/* ── TTS hook ───────────────────────────────────────────────────────── */

function useSpeech() {
  const [speaking,   setSpeaking]   = useState(false);
  const [supported,  setSupported]  = useState(false);
  const [muted,      setMuted]      = useState(false);
  const lastTextRef  = useRef("");

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); };
  }, []);

  const speak = useCallback((text: string) => {
    if (!supported || muted) return;
    lastTextRef.current = text;
    window.speechSynthesis.cancel();
    const utt       = new SpeechSynthesisUtterance(text);
    utt.rate        = 0.88;
    utt.pitch       = 1.05;
    utt.volume      = 1;
    utt.onstart     = () => setSpeaking(true);
    utt.onend       = () => setSpeaking(false);
    utt.onerror     = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, [supported, muted]);

  const pause  = useCallback(() => { window.speechSynthesis?.pause();  setSpeaking(false); }, []);
  const replay = useCallback(() => { speak(lastTextRef.current); },                          [speak]);
  const cancel = useCallback(() => { window.speechSynthesis?.cancel(); setSpeaking(false); }, []);

  return { speaking, supported, muted, setMuted, speak, pause, replay, cancel };
}

/* ── Teacher avatar (SVG) ───────────────────────────────────────────── */

function TeacherAvatar({ speaking, size = 80 }: { speaking: boolean; size?: number }) {
  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width:  size,
        height: size,
        boxShadow: speaking
          ? "0 0 0 4px var(--cobalt-200), 0 0 20px 6px var(--cobalt-50)"
          : "0 0 0 3px var(--cobalt-100)",
        animation: speaking ? "emma-pulse 1.5s ease-in-out infinite" : "none",
        transition: "box-shadow 400ms ease",
      }}
    >
      <svg
        width={size} height={size} viewBox="0 0 100 100"
        style={{ borderRadius: "50%", display: "block" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="emma-bg" cx="38%" cy="32%">
            <stop offset="0%"   stopColor="oklch(0.60 0.18 232)" />
            <stop offset="100%" stopColor="oklch(0.42 0.22 256)" />
          </radialGradient>
        </defs>

        {/* Background */}
        <circle cx="50" cy="50" r="50" fill="url(#emma-bg)" />

        {/* Shoulders */}
        <ellipse cx="50" cy="92" rx="30" ry="17" fill="oklch(0.36 0.15 238)" />
        <rect    x="28" y="78"   width="44" height="14" rx="8" fill="oklch(0.36 0.15 238)" />
        {/* Collar hint */}
        <path d="M 40 80 L 50 73 L 60 80" fill="none" stroke="white" strokeWidth="1.5" opacity="0.55" />

        {/* Neck */}
        <rect x="43" y="65" width="14" height="15" rx="4" fill="#f5c5a0" />

        {/* Face */}
        <ellipse cx="50" cy="52" rx="22" ry="24" fill="#f9d4b0" />

        {/* Hair */}
        <ellipse cx="50" cy="34" rx="22" ry="17" fill="#2e1800" />
        {/* Bun */}
        <circle  cx="50" cy="21"  r="9"   fill="#2e1800" />
        <circle  cx="50" cy="17"  r="5.5" fill="#4a2c0a" />
        {/* Hair wisps */}
        <path d="M 29 40 Q 28 48 30 56" stroke="#2e1800" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 71 40 Q 72 48 70 56" stroke="#2e1800" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Ears */}
        <ellipse cx="28" cy="52" rx="4.5" ry="5.5" fill="#f5c5a0" />
        <ellipse cx="72" cy="52" rx="4.5" ry="5.5" fill="#f5c5a0" />
        <ellipse cx="28" cy="52" rx="2.2" ry="3.2" fill="#e8b090" />
        <ellipse cx="72" cy="52" rx="2.2" ry="3.2" fill="#e8b090" />

        {/* Eyes */}
        <ellipse cx="42" cy="51" rx="5"   ry="5.2" fill="white" />
        <ellipse cx="58" cy="51" rx="5"   ry="5.2" fill="white" />
        <circle  cx="42.5" cy="51.5" r="3.2"  fill="#2e1800" />
        <circle  cx="58.5" cy="51.5" r="3.2"  fill="#2e1800" />
        <circle  cx="42"   cy="51"   r="1.6"  fill="#111" />
        <circle  cx="58"   cy="51"   r="1.6"  fill="#111" />
        {/* Shine */}
        <circle  cx="44"   cy="49.5" r="1.3"  fill="white" opacity="0.88" />
        <circle  cx="60"   cy="49.5" r="1.3"  fill="white" opacity="0.88" />

        {/* Eyebrows */}
        <path d="M 37 44.5 Q 42 42.5 47 44.5" stroke="#2e1800" strokeWidth="1.9" fill="none" strokeLinecap="round" />
        <path d="M 53 44.5 Q 58 42.5 63 44.5" stroke="#2e1800" strokeWidth="1.9" fill="none" strokeLinecap="round" />

        {/* Glasses */}
        <rect x="36" y="48" width="12" height="8" rx="3.5" fill="none" stroke="oklch(0.28 0.14 255)" strokeWidth="1.7" />
        <rect x="52" y="48" width="12" height="8" rx="3.5" fill="none" stroke="oklch(0.28 0.14 255)" strokeWidth="1.7" />
        <line x1="48" y1="52"   x2="52"  y2="52"  stroke="oklch(0.28 0.14 255)" strokeWidth="1.5" />
        <line x1="36" y1="52"   x2="30"  y2="50.5" stroke="oklch(0.28 0.14 255)" strokeWidth="1.4" />
        <line x1="64" y1="52"   x2="70"  y2="50.5" stroke="oklch(0.28 0.14 255)" strokeWidth="1.4" />

        {/* Nose */}
        <path d="M 49 58 Q 47 62 49.5 63.5 Q 51.5 64 53.5 63 Q 55 62 51 58"
          fill="none" stroke="#d4956a" strokeWidth="1.1" opacity="0.55" />

        {/* Smile */}
        <path d="M 43 65 Q 50 70.5 57 65" stroke="#c47a4a" strokeWidth="2.2" fill="none" strokeLinecap="round" />

        {/* Blush */}
        <ellipse cx="35" cy="62" rx="5.5" ry="3" fill="#f4918a" opacity="0.22" />
        <ellipse cx="65" cy="62" rx="5.5" ry="3" fill="#f4918a" opacity="0.22" />
      </svg>
    </div>
  );
}

/* ── Waveform indicator ─────────────────────────────────────────────── */

const WAVE_H = [8, 14, 10, 18, 12, 20, 15, 11, 17, 9];

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-[2.5px]" aria-hidden>
      {WAVE_H.map((h, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width:      2.5,
            height:     active ? h : 3,
            background: active ? "var(--cobalt-500)" : "var(--line-300)",
            transition: `height ${80 + i * 25}ms ease`,
            animation:  active
              ? `wv-${i % 3} ${0.65 + i * 0.06}s ease-in-out ${i * 0.07}s infinite alternate`
              : "none",
          }}
        />
      ))}
    </div>
  );
}

/* ── Step progress dots ─────────────────────────────────────────────── */

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width:      i === current ? 18 : 7,
            height:     7,
            background: i < current ? "var(--cobalt-400)" : i === current ? "var(--cobalt-500)" : "var(--line-300)",
            transition: "width 200ms ease, background 200ms ease",
          }}
        />
      ))}
    </div>
  );
}

/* ── Question block ─────────────────────────────────────────────────── */

function QuestionBlock({ options, correct, why, onAnswered }: {
  options:    string[];
  correct:    number;
  why:        string;
  onAnswered: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => {
          const isC = i === correct, isP = i === picked;
          return (
            <button
              key={i}
              onClick={() => { if (!done) { setPicked(i); setTimeout(onAnswered, 1000); } }}
              disabled={done}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[var(--r-md)] border-[1.5px] font-semibold text-[14px] cursor-pointer disabled:cursor-default transition-all duration-[160ms]"
              style={{
                fontFamily:  "var(--font-mono)",
                borderColor: done && isC ? "var(--success)" : done && isP && !isC ? "var(--danger)" : "var(--line-300)",
                background:  done && isC ? "var(--success-bg)" : done && isP && !isC ? "var(--danger-bg)" : "var(--surface)",
                color:       done && isC ? "var(--success-tx)" : done && isP && !isC ? "var(--danger-tx)" : "var(--ink-900)",
              }}
            >
              {opt}
              {done && isC && <Check size={14} style={{ color: "var(--success)" }} />}
            </button>
          );
        })}
      </div>
      {done && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-[var(--r-md)] border border-[var(--cobalt-200)]"
          style={{ background: "var(--cobalt-50)" }}>
          <Lightbulb size={15} style={{ color: "var(--cobalt-600)", flexShrink: 0, marginTop: 1 }} />
          <p className="text-[13.5px] leading-[1.55]" style={{ color: "var(--ink-800)" }}>
            {picked === correct
              ? `✓ Correct! ${why}`
              : `The right answer is "${options[correct]}". ${why}`}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Kind metadata ──────────────────────────────────────────────────── */

const KIND_META: Record<LessonStep["kind"], { icon: string; color: string }> = {
  intro:    { icon: "👋", color: "var(--cobalt-600)"  },
  explain:  { icon: "📖", color: "var(--ink-700)"     },
  question: { icon: "✏️",  color: "var(--gold-700)"   },
  summary:  { icon: "🏆", color: "var(--success-tx)"  },
};

/* ── Main component (default export for lazy loading) ───────────────── */

export default function VirtualTeacher({ lesson, onClose }: {
  lesson:  LessonData;
  onClose: () => void;
}) {
  const steps  = React.useMemo(() => buildSteps(lesson), [lesson]);
  const [step, setStep]                   = useState(0);
  const [qAnswered, setQAnswered]         = useState(false);
  const { speaking, supported, muted, setMuted, speak, pause, replay, cancel } = useSpeech();
  const firstStepRef = useRef(true);

  const current = steps[step];
  const isFirst = step === 0;
  const isLast  = step === steps.length - 1;
  const isQStep = current.kind === "question";
  const canNext = !isQStep || qAnswered;

  // Auto-speak on step change (skip the very first render)
  useEffect(() => {
    if (firstStepRef.current) { firstStepRef.current = false; return; }
    setQAnswered(false);
    if (!muted) {
      const textToSpeak = isQStep ? `Quick check. ${current.text}` : current.text;
      speak(textToSpeak);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function goNext() { cancel(); setStep((s) => Math.min(s + 1, steps.length - 1)); }
  function goPrev() { cancel(); setStep((s) => Math.max(s - 1, 0)); }
  function handleClose() { cancel(); onClose(); }

  const { icon, color } = KIND_META[current.kind];

  return (
    <>
      {/* ── Keyframe animations (injected once per instance) ── */}
      <style>{`
        @keyframes emma-pulse {
          0%,100% { box-shadow: 0 0 0 4px var(--cobalt-200); }
          50%      { box-shadow: 0 0 0 8px var(--cobalt-100), 0 0 24px 8px var(--cobalt-50); }
        }
        @keyframes wv-0 { to { height: 20px; } }
        @keyframes wv-1 { to { height: 24px; } }
        @keyframes wv-2 { to { height: 16px; } }
      `}</style>

      <div
        className="rounded-[var(--r-xl)] border border-[var(--cobalt-200)] overflow-hidden"
        style={{ boxShadow: "var(--shadow-lg, var(--shadow-md))", background: "var(--surface)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[var(--cobalt-200)]"
          style={{ background: "var(--cobalt-50)" }}>
          <span className="text-[14px] font-bold" style={{ color: "var(--cobalt-700)" }}>
            👩‍🏫 Emma · Virtual Teacher
          </span>
          <span className="flex-1" />
          <span className="text-[11.5px] font-semibold" style={{ color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
            {step + 1} / {steps.length}
          </span>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full border-none cursor-pointer flex items-center justify-center hover:bg-[var(--fill-100)] transition-colors"
            style={{ background: "transparent", color: "var(--fg-muted)" }}
            aria-label="Close Virtual Teacher"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body: avatar + content ── */}
        <div className="flex flex-col lg:flex-row">

          {/* Left panel: avatar + TTS controls */}
          <div
            className="flex lg:flex-col items-center gap-4 px-5 py-4 lg:py-6 border-b lg:border-b-0 lg:border-r border-[var(--line-200)] lg:w-[156px] lg:shrink-0"
            style={{ background: "var(--paper-2)" }}
          >
            <TeacherAvatar speaking={speaking} size={72} />

            <div className="flex flex-col items-center gap-2">
              <p className="text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>Emma</p>

              <Waveform active={speaking} />

              <p className="text-[11px] h-[14px]" style={{ color: speaking ? "var(--cobalt-600)" : "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>
                {speaking ? "Speaking…" : supported && !muted ? "Tap ▶ to listen" : ""}
              </p>

              {/* TTS controls (shown only if supported) */}
              {supported && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <TTSButton label="Play"   onClick={() => speak(current.text)}>
                    <Play   size={11} style={{ color: "var(--cobalt-600)" }} />
                  </TTSButton>
                  <TTSButton label="Pause"  onClick={pause}>
                    <Pause  size={11} style={{ color: "var(--ink-700)" }} />
                  </TTSButton>
                  <TTSButton label="Replay" onClick={replay}>
                    {/* Replay icon inline */}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-700)" }}>
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </TTSButton>
                  <TTSButton
                    label={muted ? "Unmute" : "Mute"}
                    onClick={() => { setMuted(!muted); if (!muted) cancel(); }}
                    active={muted}
                  >
                    {muted
                      ? <VolumeX size={11} style={{ color: "var(--fg-muted)" }} />
                      : <Volume2 size={11} style={{ color: "var(--ink-700)" }} />}
                  </TTSButton>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: lesson step content */}
          <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col gap-4">

            {/* Step label */}
            <p className="text-[11px] font-bold uppercase tracking-[0.07em]"
              style={{ color, fontFamily: "var(--font-mono)" }}>
              {icon} {current.title}
            </p>

            {/* Step text */}
            {current.kind === "intro" && (
              <blockquote
                className="text-[16px] sm:text-[17px] font-semibold leading-[1.55] pl-4 border-l-[3px] border-[var(--cobalt-400)]"
                style={{ color: "var(--ink-900)" }}
              >
                &ldquo;{current.text}&rdquo;
              </blockquote>
            )}

            {current.kind === "explain" && (
              <p className="text-[14.5px] leading-[1.65]" style={{ color: "var(--ink-800)" }}>
                {current.text}
              </p>
            )}

            {current.kind === "question" && (
              <p className="text-[15px] font-semibold leading-[1.5]" style={{ color: "var(--ink-900)" }}>
                {current.text}
              </p>
            )}

            {current.kind === "summary" && (
              <div className="flex items-start gap-3 px-4 py-3.5 rounded-[var(--r-md)] border border-[var(--success-bg)]"
                style={{ background: "var(--success-bg)" }}>
                <span className="text-[22px] leading-none">🏆</span>
                <p className="text-[14.5px] leading-[1.6]" style={{ color: "var(--ink-800)" }}>
                  {current.text}
                </p>
              </div>
            )}

            {/* Visual aid (on explain steps only) */}
            {current.visual && current.kind === "explain" && (
              <VisualAid spec={current.visual} />
            )}

            {/* Answer options (question steps) */}
            {current.kind === "question" && current.options && current.correct !== undefined && (
              <QuestionBlock
                key={step}
                options={current.options}
                correct={current.correct}
                why={current.why ?? ""}
                onAnswered={() => setQAnswered(true)}
              />
            )}

            {/* Follow-up topics on last step */}
            {isLast && lesson.follows.length > 0 && (
              <div className="pt-1">
                <p className="text-[11.5px] font-semibold mb-2" style={{ color: "var(--fg-muted)" }}>
                  What would you like to explore next?
                </p>
                <div className="flex flex-wrap gap-2">
                  {lesson.follows.map((f) => (
                    <span
                      key={f}
                      className="text-[12.5px] px-3 py-1.5 rounded-full border border-[var(--line-300)]"
                      style={{ background: "var(--fill-100)", color: "var(--ink-700)" }}
                    >
                      💡 {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: navigation ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--line-200)]"
          style={{ background: "var(--paper-2)" }}>
          <button
            onClick={goPrev}
            disabled={isFirst}
            className="flex items-center gap-1 px-3.5 py-2 rounded-[var(--r-md)] border border-[var(--line-300)] text-[13px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default transition-colors hover:bg-[var(--fill-100)] disabled:hover:bg-transparent"
            style={{ background: "var(--surface)", color: "var(--ink-700)" }}
          >
            <ChevronLeft size={16} /> Prev
          </button>

          <div className="flex-1 flex justify-center">
            <StepDots total={steps.length} current={step} />
          </div>

          <button
            onClick={isLast ? handleClose : goNext}
            disabled={!canNext && !isLast}
            className="flex items-center gap-1 px-3.5 py-2 rounded-[var(--r-md)] border-none text-[13px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default transition-all duration-[140ms] hover:opacity-90"
            style={{
              background: isLast ? "var(--success)" : "var(--cobalt-500)",
              color:       "white",
              boxShadow:   "var(--shadow-brand)",
            }}
          >
            {isLast ? "Finish ✓" : <>Next <ChevronRight size={16} /></>}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Tiny helper ────────────────────────────────────────────────────── */

function TTSButton({ label, onClick, active, children }: {
  label:    string;
  onClick:  () => void;
  active?:  boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-7 h-7 rounded-full border border-[var(--line-300)] flex items-center justify-center cursor-pointer transition-colors hover:bg-[var(--cobalt-50)]"
      style={{ background: active ? "var(--fill-200)" : "var(--surface)" }}
    >
      {children}
    </button>
  );
}
