"use client";

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  X, Minus, Maximize2,
  Volume2, VolumeX, Play, Pause,
  ChevronLeft, ChevronRight, Check,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════ */
/*  Public types (mirrored from VirtualTeacher for compatibility)      */
/* ═══════════════════════════════════════════════════════════════════ */

export interface LessonData {
  text:        string;
  keyInsight?: string;
  visual?:     { type: string; data: Record<string, unknown> };
  steps:       string[];
  tryIt:       { q: string; options: string[]; correct: number; why: string };
  follows:     string[];
}

type Expression =
  | "idle"
  | "speaking"
  | "excited"
  | "thinking"
  | "celebrating"
  | "empathy";

interface Slide {
  kind:       "welcome" | "intro" | "explain" | "visual" | "insight" | "step" | "question" | "summary";
  text:       string;
  expression: Expression;
  options?:   string[];
  correct?:   number;
  why?:       string;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Script builder — converts a lesson into micro-slides               */
/* ═══════════════════════════════════════════════════════════════════ */

function buildScript(l: LessonData): Slide[] {
  const out: Slide[] = [];

  out.push({ kind: "welcome", expression: "excited",
    text: "Hi there! I'm Emma. Ready to learn something new? Let's dive in!" });

  const intro = l.text.match(/^[^.!?]+[.!?]/)?.[0] ?? l.text.slice(0, 120);
  out.push({ kind: "intro", expression: "excited", text: intro });

  const rest = l.text.slice(intro.length).trim();
  rest.split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 10)
    .forEach((s, i) => out.push({
      kind: "explain", expression: i % 3 === 1 ? "thinking" : "speaking", text: s.trim(),
    }));

  if (l.visual && l.visual.type !== "none") {
    const lbl: Record<string, string> = {
      fraction: "the fraction diagram", number_line: "the number line",
      percentage: "the percentage bar", geometry: "the shape diagram", bar_chart: "the chart",
    };
    out.push({ kind: "visual", expression: "excited",
      text: `Take a look at ${lbl[l.visual.type] ?? "the diagram"} in the lesson above — it shows exactly what I mean!` });
  }

  if (l.keyInsight) out.push({ kind: "insight", expression: "excited", text: l.keyInsight });

  l.steps.forEach((s, i) => out.push({
    kind: "step", expression: "speaking",
    text: s.startsWith("Step") ? s : `Step ${i + 1}: ${s}`,
  }));

  if (l.tryIt.q && l.tryIt.options.length > 0) out.push({
    kind: "question", expression: "thinking",
    text: l.tryIt.q,
    options:  l.tryIt.options,
    correct:  l.tryIt.correct,
    why:      l.tryIt.why,
  });

  out.push({ kind: "summary", expression: "celebrating",
    text: "Excellent work! You've got this. Keep practising and you'll master it!" });

  return out;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  TTS hook                                                           */
/* ═══════════════════════════════════════════════════════════════════ */

function useSpeech() {
  const [speaking,  setSpeaking]  = useState(false);
  const [supported, setSupported] = useState(false);
  const [muted,     setMuted]     = useState(false);
  const lastRef = useRef("");

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); };
  }, []);

  const speak = useCallback((text: string) => {
    if (!supported || muted) return;
    lastRef.current = text;
    window.speechSynthesis.cancel();
    const u    = new SpeechSynthesisUtterance(text);
    u.rate     = 0.88;
    u.pitch    = 1.05;
    u.onstart  = () => setSpeaking(true);
    u.onend    = () => setSpeaking(false);
    u.onerror  = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [supported, muted]);

  const pause  = useCallback(() => { window.speechSynthesis?.pause();  setSpeaking(false); }, []);
  const replay = useCallback(() => { speak(lastRef.current); },                              [speak]);
  const cancel = useCallback(() => { window.speechSynthesis?.cancel(); setSpeaking(false); }, []);

  return { speaking, supported, muted, setMuted, speak, pause, replay, cancel };
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Drag hook                                                          */
/* ═══════════════════════════════════════════════════════════════════ */

function useDrag() {
  const ref    = useRef<HTMLDivElement>(null);
  const [pos,  setPos] = useState<{ left: number; top: number } | null>(null);
  const origin = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);

  const begin = useCallback((mx: number, my: number) => {
    if (!ref.current) return;
    const r    = ref.current.getBoundingClientRect();
    origin.current = { mx, my, cx: r.left, cy: r.top };
  }, []);

  const move = useCallback((mx: number, my: number) => {
    if (!origin.current || !ref.current) return;
    const W   = ref.current.offsetWidth;
    const H   = ref.current.offsetHeight;
    setPos({
      left: Math.max(8, Math.min(window.innerWidth  - W - 8, origin.current.cx + mx - origin.current.mx)),
      top:  Math.max(8, Math.min(window.innerHeight - H - 8, origin.current.cy + my - origin.current.my)),
    });
  }, []);

  const end = useCallback(() => { origin.current = null; }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    begin(e.clientX, e.clientY);
    const mv = (e: MouseEvent) => move(e.clientX, e.clientY);
    const up = () => { end(); window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    e.preventDefault();
  }, [begin, move, end]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    begin(e.touches[0].clientX, e.touches[0].clientY);
    const mv = (e: TouchEvent) => { if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY); };
    const up = () => { end(); window.removeEventListener("touchmove", mv); window.removeEventListener("touchend", up); };
    window.addEventListener("touchmove", mv, { passive: false });
    window.addEventListener("touchend", up);
  }, [begin, move, end]);

  const style: React.CSSProperties = pos
    ? { position: "fixed", left: pos.left, top: pos.top, bottom: "auto", right: "auto" }
    : { position: "fixed", bottom: 24, right: 24 };

  return { ref, style, onMouseDown, onTouchStart };
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Animated Emma SVG avatar                                           */
/* ═══════════════════════════════════════════════════════════════════ */

function EmmaSVG({ expr, talking }: { expr: Expression; talking: boolean }) {
  const cel  = expr === "celebrating";
  const exc  = expr === "excited" || cel;
  const thk  = expr === "thinking";
  const emp  = expr === "empathy";
  const spk  = talking || expr === "speaking";
  const hap  = exc || cel;

  /* eye shape  */
  const eyeRY = hap ? 7 : 9.5;

  /* eyebrow paths */
  const lbrow = thk ? "M 68 63 Q 78 58 88 61"
    : hap ? "M 68 59 Q 78 54 88 59"
    : emp ? "M 68 65 Q 78 61 88 65"
    : "M 68 64 Q 78 59 88 64";
  const rbrow = thk ? "M 112 60 Q 122 56 132 60"
    : hap ? "M 112 59 Q 122 54 132 59"
    : emp ? "M 112 65 Q 122 61 132 65"
    : "M 112 64 Q 122 59 132 64";

  /* mouth paths */
  const closedM = cel
    ? "M 82 110 Q 100 124 118 110"
    : exc  ? "M 84 110 Q 100 120 116 110"
    : emp  ? "M 88 112 Q 100 116 112 112"
    : thk  ? "M 90 111 Q 100 113 110 111"
    : "M 85 110 Q 100 118 115 110";

  return (
    <svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", overflow: "visible" }}>

      {/* ── Whole-body group: sway or celebrate ── */}
      <g className={cel ? "ft-celebrate" : "ft-sway"} style={{ transformOrigin: "100px 260px" }}>

        {/* ─ Left arm ─ */}
        {cel ? (
          /* Raised for celebrating */
          <g>
            <path d="M 55 155 Q 38 128 28 100 Q 20 78 26 66 Q 36 60 44 68 Q 54 88 60 120 Z"
              fill="#f5c5a0" />
            <path d="M 55 155 L 44 148 L 48 122 L 63 128 Z" fill="oklch(0.42 0.22 256)" />
          </g>
        ) : (
          <g className={exc ? "ft-arm-wave" : ""} style={{ transformOrigin: "45px 155px" }}>
            <path d="M 45 155 Q 25 182 18 220 Q 22 230 30 228 Q 38 216 42 190 L 55 162 Z"
              fill="#f5c5a0" />
            <path d="M 45 155 L 55 162 L 48 188 L 28 180 Z" fill="oklch(0.42 0.22 256)" />
            <ellipse cx="22" cy="226" rx="11" ry="10" fill="#f5c5a0" />
          </g>
        )}

        {/* ─ Jacket / body ─ */}
        <polygon points="22,152 178,152 192,260 8,260" fill="oklch(0.42 0.22 256)" />
        {/* Lapels */}
        <path d="M 22 152 Q 58 158 88 180 L 84 260 L 8 260 Z"   fill="oklch(0.36 0.18 258)" />
        <path d="M 178 152 Q 142 158 112 180 L 116 260 L 192 260 Z" fill="oklch(0.36 0.18 258)" />
        {/* White collar */}
        <path d="M 100 152 L 76 182 L 56 168 L 76 152 Z"   fill="white" opacity="0.9" />
        <path d="M 100 152 L 124 182 L 144 168 L 124 152 Z" fill="white" opacity="0.9" />
        <rect x="91" y="178" width="18" height="82" fill="white" opacity="0.85" />
        {/* Pocket square */}
        <rect x="46" y="172" width="18" height="13" rx="2" fill="oklch(0.78 0.14 50)" opacity="0.9" />

        {/* ─ Right arm ─ */}
        {cel ? (
          <g>
            <path d="M 145 155 Q 162 128 172 100 Q 180 78 174 66 Q 164 60 156 68 Q 146 88 140 120 Z"
              fill="#f5c5a0" />
            <path d="M 145 155 L 156 148 L 152 122 L 137 128 Z" fill="oklch(0.42 0.22 256)" />
          </g>
        ) : (
          <g className="ft-arm-idle" style={{ transformOrigin: "155px 155px" }}>
            <path d="M 155 155 Q 175 182 182 220 Q 178 230 170 228 Q 162 216 158 190 L 145 162 Z"
              fill="#f5c5a0" />
            <path d="M 155 155 L 145 162 L 152 188 L 172 180 Z" fill="oklch(0.42 0.22 256)" />
            <ellipse cx="178" cy="226" rx="11" ry="10" fill="#f5c5a0" />
          </g>
        )}

        {/* ─ Neck ─ */}
        <rect x="86" y="132" width="28" height="22" rx="6" fill="#f5c5a0" />

        {/* ══ Head group ══ */}
        <g className={spk ? "ft-nod" : thk ? "ft-think" : ""}
          style={{ transformOrigin: "100px 136px" }}>

          {/* Hair (drawn behind face) */}
          <ellipse cx="100" cy="72" rx="58" ry="46" fill="#2e1800" />
          <circle  cx="100" cy="24" r="21"          fill="#2e1800" />
          <circle  cx="100" cy="18" r="12"           fill="#4a2c0a" />
          {/* Side wisps */}
          <ellipse cx="50"  cy="76" rx="9" ry="23"  fill="#2e1800" transform="rotate(-12 50 76)" />
          <ellipse cx="150" cy="76" rx="9" ry="23"  fill="#2e1800" transform="rotate(12 150 76)" />

          {/* Ears */}
          <ellipse cx="44"  cy="84" rx="9"   ry="12" fill="#f5c5a0" />
          <ellipse cx="156" cy="84" rx="9"   ry="12" fill="#f5c5a0" />
          <ellipse cx="44"  cy="84" rx="4.5" ry="7"  fill="#e8b090" />
          <ellipse cx="156" cy="84" rx="4.5" ry="7"  fill="#e8b090" />

          {/* Face */}
          <ellipse cx="100" cy="88" rx="50" ry="56" fill="#f9d4b0" />

          {/* Eyebrows */}
          <path d={lbrow} stroke="#2e1800" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d={rbrow} stroke="#2e1800" strokeWidth="2.8" fill="none" strokeLinecap="round" />

          {/* Glasses */}
          <rect x="64"  y="66" width="30" height="17" rx="6"
            fill="none" stroke="oklch(0.27 0.14 256)" strokeWidth="2.2" />
          <rect x="106" y="66" width="30" height="17" rx="6"
            fill="none" stroke="oklch(0.27 0.14 256)" strokeWidth="2.2" />
          <line x1="94"  y1="74.5" x2="106" y2="74.5" stroke="oklch(0.27 0.14 256)" strokeWidth="2" />
          <line x1="64"  y1="74.5" x2="55"  y2="72"   stroke="oklch(0.27 0.14 256)" strokeWidth="2" />
          <line x1="136" y1="74.5" x2="145" y2="72"   stroke="oklch(0.27 0.14 256)" strokeWidth="2" />

          {/* Eye whites */}
          <ellipse cx="79"  cy="76" rx="9.5" ry={eyeRY} fill="white" />
          <ellipse cx="121" cy="76" rx="9.5" ry={eyeRY} fill="white" />
          {/* Irises */}
          <circle cx="79.5"  cy="76.5" r="6"   fill="#3d2000" />
          <circle cx="121.5" cy="76.5" r="6"   fill="#3d2000" />
          <circle cx="79.5"  cy="76.5" r="3.2" fill="#111" />
          <circle cx="121.5" cy="76.5" r="3.2" fill="#111" />
          {/* Shine */}
          <circle cx="83"  cy="74" r="2.3" fill="white" opacity="0.88" />
          <circle cx="125" cy="74" r="2.3" fill="white" opacity="0.88" />

          {/* ── Eyelids (blink) ── */}
          <ellipse cx="79"  cy="68" rx="10" ry="6"
            fill="#f9d4b0" className="ft-eyelid"
            style={{ transformOrigin: "79px 63px" }} />
          <ellipse cx="121" cy="68" rx="10" ry="6"
            fill="#f9d4b0" className="ft-eyelid"
            style={{ transformOrigin: "121px 63px" }} />

          {/* Nose */}
          <path d="M 97 94 Q 93 100 95.5 103 Q 98.5 105 100 105 Q 101.5 105 104.5 103 Q 107 100 103 94"
            fill="none" stroke="#d4956a" strokeWidth="1.4" opacity="0.5" />

          {/* ── Mouth ── */}
          {!spk && (
            <>
              <path d={closedM} stroke="#c47a4a" strokeWidth="3" fill="none" strokeLinecap="round" />
              {cel && (
                /* Teeth */
                <path d="M 82 110 Q 100 124 118 110 L 116 116 Q 100 128 84 116 Z"
                  fill="white" stroke="#c47a4a" strokeWidth="1.5" />
              )}
            </>
          )}
          {spk && (
            <>
              <path d="M 85 110 Q 100 117 115 110" stroke="#c47a4a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <ellipse cx="100" cy="113" rx="13" ry="3"
                fill="#8B4513" className="ft-mouth-open"
                style={{ transformOrigin: "100px 110px" }} />
            </>
          )}

          {/* Blush */}
          <ellipse cx="62"  cy="100" rx="13" ry="8" fill="#f4918a" opacity={hap ? 0.36 : 0.15} />
          <ellipse cx="138" cy="100" rx="13" ry="8" fill="#f4918a" opacity={hap ? 0.36 : 0.15} />

          {/* Thinking: finger-to-chin gesture */}
          {thk && (
            <path d="M 55 138 Q 62 126 72 120 Q 80 116 82 121"
              stroke="#f5c5a0" strokeWidth="7" fill="none" strokeLinecap="round" />
          )}
        </g>

        {/* Breathing highlight on chest (subtle scale) */}
        <ellipse cx="100" cy="205" rx="55" ry="22"
          fill="oklch(0.42 0.22 256)"
          className="ft-breathe"
          style={{ transformOrigin: "100px 185px" }} />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Waveform bars                                                      */
/* ═══════════════════════════════════════════════════════════════════ */

const WH = [5, 11, 7, 15, 9, 17, 11, 7, 13, 5, 9, 15, 7, 11, 5];

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-[2px]" aria-hidden>
      {WH.map((h, i) => (
        <div key={i} className="rounded-full"
          style={{
            width:  2,
            height: active ? h : 3,
            background: active ? "var(--cobalt-400)" : "var(--line-300)",
            transition: `height ${65 + i * 16}ms ease`,
            animation: active
              ? `ft-wv-${i % 3} ${0.5 + i * 0.06}s ease-in-out ${i * 0.05}s infinite alternate`
              : "none",
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Floating Teacher — main component (default export, lazy loaded)    */
/* ═══════════════════════════════════════════════════════════════════ */

const KIND_EMOJI: Record<Slide["kind"], string> = {
  welcome: "👋", intro: "📚", explain: "💬",
  visual: "🖼️", insight: "💡", step: "📝",
  question: "✏️", summary: "🏆",
};

export default function FloatingTeacher({ lesson, onClose }: {
  lesson:  LessonData;
  onClose: () => void;
}) {
  const slides = useMemo(() => buildScript(lesson), [lesson]);

  const [idx,       setIdx]       = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [qPicked,   setQPicked]   = useState<number | null>(null);
  const [answerRes, setAnswerRes] = useState<"correct" | "wrong" | null>(null);

  const { speaking, supported, muted, setMuted, speak, pause, replay, cancel } = useSpeech();
  const { ref, style: dragStyle, onMouseDown, onTouchStart } = useDrag();

  const firstRef = useRef(true);
  const cur     = slides[idx];
  const isLast  = idx === slides.length - 1;
  const isQ     = cur.kind === "question";
  const canNext = !isQ || answerRes !== null;

  const expression: Expression =
    answerRes === "correct" ? "celebrating"
    : answerRes === "wrong"  ? "empathy"
    : speaking               ? "speaking"
    : cur.expression;

  /* Auto-speak on slide advance (not on mount) */
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    setQPicked(null);
    setAnswerRes(null);
    if (!muted) speak(cur.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function goNext() { cancel(); setIdx(i => Math.min(i + 1, slides.length - 1)); }
  function goPrev() { cancel(); setIdx(i => Math.max(i - 1, 0)); }
  function handleClose() { cancel(); onClose(); }

  function pickAnswer(i: number) {
    if (qPicked !== null) return;
    setQPicked(i);
    const res = i === cur.correct ? "correct" : "wrong";
    setAnswerRes(res);
    if (!muted) {
      const msg = res === "correct"
        ? `Excellent! ${cur.why ?? ""}`
        : `Not quite. ${cur.why ?? ""}`;
      speak(msg);
    }
  }

  /* ─── Progress bar ─── */
  const progress = ((idx) / (slides.length - 1)) * 100;

  return (
    <>
      {/* ══ Keyframes + class-based animations ══ */}
      <style>{`
        @keyframes ft-sway {
          0%,100% { transform: rotate(-1.1deg) translateY(0); }
          50%      { transform: rotate(1.1deg)  translateY(-3px); }
        }
        @keyframes ft-celebrate {
          0%,100% { transform: translateY(0)     rotate(0deg); }
          22%,62% { transform: translateY(-12px)  rotate(-2deg); }
          42%,82% { transform: translateY(-7px)   rotate(2deg); }
        }
        @keyframes ft-breathe {
          0%,100% { transform: scaleY(1)    scaleX(1); }
          50%      { transform: scaleY(1.06) scaleX(0.97); }
        }
        @keyframes ft-blink {
          0%,80%,100% { transform: scaleY(1); }
          85%          { transform: scaleY(6); }
          90%          { transform: scaleY(1); }
        }
        @keyframes ft-nod {
          0%,100% { transform: rotate(0deg); }
          28%      { transform: rotate(-5deg); }
          66%      { transform: rotate(2.5deg); }
        }
        @keyframes ft-think {
          0%,100% { transform: rotate(0deg);  }
          50%      { transform: rotate(-8deg); }
        }
        @keyframes ft-mouth-talk {
          0%,100% { transform: scaleY(0.25); }
          50%      { transform: scaleY(1); }
        }
        @keyframes ft-arm-swing {
          0%,100% { transform: rotate(0deg); }
          45%      { transform: rotate(-22deg); }
        }
        @keyframes ft-wv-0 { to { height: 16px; } }
        @keyframes ft-wv-1 { to { height: 22px; } }
        @keyframes ft-wv-2 { to { height: 12px; } }

        .ft-sway       { animation: ft-sway      5s   ease-in-out infinite; }
        .ft-celebrate  { animation: ft-celebrate 0.7s ease-in-out 3; }
        .ft-breathe    { animation: ft-breathe   4s   ease-in-out infinite; }
        .ft-eyelid     { animation: ft-blink     4.6s ease-in-out infinite; }
        .ft-nod        { animation: ft-nod       1.5s ease-in-out infinite; }
        .ft-think      { animation: ft-think     3s   ease-in-out infinite; }
        .ft-mouth-open { animation: ft-mouth-talk 0.4s ease-in-out infinite; }
        .ft-arm-wave   { animation: ft-arm-swing 2s   ease-in-out infinite; }
        .ft-arm-idle   { animation: ft-arm-swing 3.2s ease-in-out infinite; }
      `}</style>

      {/* ══ Container ══ */}
      <div
        ref={ref}
        style={{
          ...dragStyle,
          zIndex:    9999,
          width:     minimized ? 208 : 272,
          userSelect: "none",
        }}
        className="select-none"
        aria-label="Virtual Teacher – Emma"
      >
        <div
          className="rounded-[20px] overflow-hidden flex flex-col"
          style={{
            background: "var(--surface)",
            border:     "1.5px solid var(--cobalt-200)",
            boxShadow:  "0 10px 40px oklch(0.2 0.06 255 / 0.24), 0 2px 10px oklch(0.2 0.06 255 / 0.12)",
          }}
        >

          {/* ── Header / drag handle ── */}
          <div
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none border-b border-[var(--cobalt-100)]"
            style={{ background: "var(--cobalt-50)" }}
          >
            <span className="text-[12.5px] font-bold flex-1" style={{ color: "var(--cobalt-700)" }}>
              👩‍🏫 Emma · Virtual Teacher
            </span>
            <HeaderBtn onClick={() => setMinimized(m => !m)} title={minimized ? "Expand" : "Minimise"}>
              {minimized ? <Maximize2 size={11} /> : <Minus size={11} />}
            </HeaderBtn>
            <HeaderBtn onClick={handleClose} title="Close">
              <X size={11} />
            </HeaderBtn>
          </div>

          {minimized ? (

            /* ── Minimised state ── */
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div style={{ width: 48, height: 60, flexShrink: 0 }}>
                <EmmaSVG expr={expression} talking={speaking} />
              </div>
              <div className="flex-1 min-w-0">
                <Waveform active={speaking} />
                <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "var(--fg-muted)" }}>
                  {cur.text.slice(0, 42)}{cur.text.length > 42 ? "…" : ""}
                </p>
              </div>
            </div>

          ) : (

            /* ── Expanded state ── */
            <>
              {/* Avatar stage */}
              <div
                className="relative flex justify-center items-end overflow-hidden"
                style={{ height: 200, background: "linear-gradient(175deg, var(--cobalt-50) 0%, var(--paper-2) 100%)" }}
              >
                {/* Background arc */}
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-full"
                  style={{ height: 80, background: "var(--paper-2)", opacity: 0.7 }}
                />

                {/* Character */}
                <div style={{ width: 172, height: 196, position: "relative", zIndex: 1 }}>
                  <EmmaSVG expr={expression} talking={speaking} />
                </div>

                {/* Expression label — top left */}
                <div className="absolute top-2.5 left-3 text-[20px] leading-none" aria-hidden>
                  {expression === "celebrating" ? "🎉"
                   : expression === "empathy"    ? "😔"
                   : expression === "excited"    ? "😊"
                   : expression === "thinking"   ? "🤔"
                   : expression === "speaking"   ? "🎤"
                   : "😊"}
                </div>

                {/* Slide counter — top right */}
                <div
                  className="absolute top-2.5 right-3 text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--cobalt-100)", color: "var(--cobalt-700)", fontFamily: "var(--font-mono)" }}
                >
                  {idx + 1}/{slides.length}
                </div>

                {/* Waveform at bottom */}
                <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                  <Waveform active={speaking} />
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-[3px] w-full" style={{ background: "var(--fill-200)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width:      `${progress}%`,
                    background: "var(--cobalt-400)",
                    transition: "width 300ms ease",
                  }}
                />
              </div>

              {/* ── Speech bubble ── */}
              <div
                className="px-3.5 py-3 border-b border-[var(--line-200)]"
                style={{ background: "var(--surface)" }}
              >
                <p
                  className="text-[10.5px] font-bold uppercase tracking-[0.06em] mb-1.5"
                  style={{ color: isQ ? "var(--gold-700)" : "var(--cobalt-600)", fontFamily: "var(--font-mono)" }}
                >
                  {KIND_EMOJI[cur.kind]} {cur.kind}
                </p>
                <p className="text-[13px] leading-[1.55]" style={{ color: "var(--ink-800)" }}>
                  {cur.text.length > 210 ? cur.text.slice(0, 207) + "…" : cur.text}
                </p>
              </div>

              {/* ── Question options ── */}
              {isQ && cur.options && (
                <div className="px-3.5 pt-2.5 pb-3 border-b border-[var(--line-200)]"
                  style={{ background: "var(--surface)" }}>
                  <div className="flex flex-col gap-1.5">
                    {cur.options.map((opt, i) => {
                      const isC = i === cur.correct, isP = i === qPicked;
                      const done = qPicked !== null;
                      return (
                        <button key={i}
                          onClick={() => pickAnswer(i)}
                          disabled={done}
                          className="w-full text-left px-3 py-2 rounded-[var(--r-md)] border-[1.5px] text-[12.5px] font-semibold cursor-pointer disabled:cursor-default transition-all duration-[140ms]"
                          style={{
                            fontFamily:  "var(--font-mono)",
                            borderColor: done && isC ? "var(--success)" : done && isP && !isC ? "var(--danger)" : "var(--line-300)",
                            background:  done && isC ? "var(--success-bg)" : done && isP && !isC ? "var(--danger-bg)" : "var(--surface)",
                            color:       done && isC ? "var(--success-tx)" : done && isP && !isC ? "var(--danger-tx)" : "var(--ink-900)",
                          }}
                        >
                          <span style={{ opacity: 0.45, marginRight: 4 }}>{String.fromCharCode(65 + i)}.</span>
                          {opt}
                          {done && isC && <Check size={11} style={{ display: "inline", marginLeft: 5, color: "var(--success)" }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Interaction chips ── */}
              {!isQ && (
                <div
                  className="px-3 pt-2 pb-2.5 flex flex-wrap gap-1.5 border-b border-[var(--line-200)]"
                  style={{ background: "var(--surface)" }}
                >
                  {!isLast && (
                    <>
                      <Chip onClick={goNext}>Got it ▶</Chip>
                      <Chip onClick={() => { cancel(); if (!muted) speak(cur.text); }}>↺ Again</Chip>
                      {idx > 1 && <Chip onClick={goPrev}>◀ Back</Chip>}
                    </>
                  )}
                  {isLast && lesson.follows.slice(0, 2).map(f => (
                    <Chip key={f} onClick={() => {}}>{f.slice(0, 24)}</Chip>
                  ))}
                </div>
              )}

              {/* ── Footer: TTS controls + navigation ── */}
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: "var(--paper-2)" }}
              >
                {/* TTS */}
                {supported && (
                  <div className="flex items-center gap-1">
                    <FootBtn onClick={() => speak(cur.text)} title="Play">
                      <Play size={10} style={{ color: "var(--cobalt-600)" }} />
                    </FootBtn>
                    <FootBtn onClick={pause} title="Pause">
                      <Pause size={10} style={{ color: "var(--ink-700)" }} />
                    </FootBtn>
                    <FootBtn onClick={replay} title="Replay">
                      {/* Reload icon */}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                        style={{ color: "var(--ink-700)" }}>
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </FootBtn>
                    <FootBtn onClick={() => { setMuted(m => !m); if (!muted) cancel(); }} title={muted ? "Unmute" : "Mute"} active={muted}>
                      {muted
                        ? <VolumeX size={10} style={{ color: "var(--fg-muted)" }} />
                        : <Volume2 size={10} style={{ color: "var(--ink-700)" }} />}
                    </FootBtn>
                  </div>
                )}

                <span className="flex-1" />

                {/* Prev / Next */}
                <button
                  onClick={goPrev} disabled={idx === 0}
                  className="w-7 h-7 rounded-full border border-[var(--line-300)] flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default hover:bg-[var(--fill-100)] transition-colors"
                  style={{ background: "var(--surface)" }} title="Previous"
                >
                  <ChevronLeft size={13} style={{ color: "var(--ink-700)" }} />
                </button>
                <button
                  onClick={isLast ? handleClose : goNext}
                  disabled={!canNext && !isLast}
                  className="w-7 h-7 rounded-full border-none flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default hover:opacity-90 transition-opacity"
                  style={{ background: isLast ? "var(--success)" : "var(--cobalt-500)" }}
                  title={isLast ? "Finish" : "Next"}
                >
                  {isLast
                    ? <Check size={12} color="white" />
                    : <ChevronRight size={13} color="white" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Micro helpers ─────────────────────────────────────────────────── */

function HeaderBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className="w-6 h-6 rounded-full border-none cursor-pointer flex items-center justify-center hover:bg-[var(--cobalt-100)] transition-colors"
      style={{ background: "transparent", color: "var(--fg-muted)" }}>
      {children}
    </button>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[var(--line-300)] cursor-pointer hover:bg-[var(--fill-100)] transition-colors"
      style={{ background: "var(--surface)", color: "var(--ink-700)" }}>
      {children}
    </button>
  );
}

function FootBtn({ onClick, title, active, children }: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className="w-6 h-6 rounded-full border border-[var(--line-300)] flex items-center justify-center cursor-pointer hover:bg-[var(--cobalt-50)] transition-colors"
      style={{ background: active ? "var(--fill-200)" : "var(--surface)" }}>
      {children}
    </button>
  );
}
