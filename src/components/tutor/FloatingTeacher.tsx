"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X, Minus, Maximize2,
  Volume2, VolumeX, Play, Pause, RotateCcw,
  SkipForward, SkipBack, Check, List, User,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════ TYPES ══ */

export interface LessonData {
  text:        string;
  keyInsight?: string;
  visual?:     { type: string; data: Record<string, unknown> };
  steps:       string[];
  tryIt:       { q: string; options: string[]; correct: number; why: string };
  follows:     string[];
}

type Expression   = "idle" | "speaking" | "excited" | "thinking" | "celebrating" | "empathy" | "surprised";
type SlideKind    = "welcome" | "intro" | "explain" | "visual" | "insight" | "step" | "question" | "summary";
type EngineStatus = "idle" | "playing" | "paused" | "waiting" | "completed";

interface Slide {
  id:         string;
  kind:       SlideKind;
  text:       string;
  expression: Expression;
  options?:   string[];
  correct?:   number;
  why?:       string;
}

interface Persona {
  id: string; name: string; title: string;
  skin: string; hair: string; jacket: string; lip: string; blush: string;
}

/* AvatarProvider abstraction — swap WebSpeechProvider for HeyGen / ElevenLabs /
   Tavus / D-ID by implementing this interface and injecting via prop. */
export interface AvatarProvider {
  speak(text: string, rate: number, onEnd: () => void): void;
  pause(): void; resume(): void; stop(): void;
  isSupported: boolean;
}

/* ══════════════════════════════════════════════════════ PERSONAS ══ */

const PERSONAS: Persona[] = [
  { id:"emma",   name:"Emma",   title:"Mathematics",  skin:"#f9d4b0", hair:"#2e1800", jacket:"oklch(0.42 0.22 256)", lip:"#c47a4a", blush:"#f4918a" },
  { id:"sarah",  name:"Sarah",  title:"Science",      skin:"#f5e6d8", hair:"#7a3e10", jacket:"oklch(0.42 0.18 168)", lip:"#c06060", blush:"#f0a090" },
  { id:"raj",    name:"Raj",    title:"Physics",      skin:"#d4956a", hair:"#111",    jacket:"oklch(0.38 0.16 242)", lip:"#a06040", blush:"#e09060" },
  { id:"marcus", name:"Marcus", title:"History",      skin:"#7a4e2e", hair:"#111",    jacket:"oklch(0.36 0.14 20)",  lip:"#804030", blush:"#c08060" },
  { id:"priya",  name:"Priya",  title:"Chemistry",    skin:"#c4845a", hair:"#111",    jacket:"oklch(0.40 0.18 315)", lip:"#a05040", blush:"#d87060" },
];

/* ══════════════════════════════════════════ WEB SPEECH PROVIDER ══ */

class WebSpeechProvider implements AvatarProvider {
  get isSupported() { return typeof window !== "undefined" && "speechSynthesis" in window; }

  speak(text: string, rate: number, onEnd: () => void) {
    if (!this.isSupported) { onEnd(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate; u.pitch = 1.05;
    const pick = () => {
      const vv = window.speechSynthesis.getVoices();
      const v  = vv.find(v => /Google UK English Female|Samantha|Karen|Moira|Serena/i.test(v.name))
              ?? vv.find(v => v.lang.startsWith("en") && v.localService)
              ?? vv.find(v => v.lang.startsWith("en")) ?? null;
      if (v) u.voice = v;
    };
    if (window.speechSynthesis.getVoices().length) pick();
    else window.speechSynthesis.onvoiceschanged = pick;
    u.onend = () => onEnd(); u.onerror = () => onEnd();
    window.speechSynthesis.speak(u);
  }
  pause()  { if (this.isSupported) window.speechSynthesis.pause();  }
  resume() { if (this.isSupported) window.speechSynthesis.resume(); }
  stop()   { if (this.isSupported) window.speechSynthesis.cancel(); }
}

/* ════════════════════════════════════════════ SCRIPT BUILDER ══ */

const TR = [
  "Now, building on that —", "Here's where it gets interesting:",
  "Think of it this way:", "Let me show you exactly how this works.",
  "This is the key part —", "Here's something worth noting:",
  "Now let's connect the dots.",
];

let _sid = 0;
const sid = () => `s${_sid++}`;

function buildScript(l: LessonData): Slide[] {
  _sid = 0;
  const out: Slide[] = [];

  out.push({ id: sid(), kind: "welcome", expression: "excited",
    text: "Hi there! I'm really glad you're here. Let's learn this together — I'll guide you step by step. Ready? Let's go!" });

  const introRx   = l.text.match(/^([^.!?]+[.!?](?:\s+[^.!?]+[.!?])?)/);
  const introText = introRx?.[0]?.trim() ?? l.text.slice(0, 150);
  out.push({ id: sid(), kind: "intro", expression: "excited", text: introText });

  const rest  = l.text.slice(introText.length).trim();
  const sents = rest.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 8);
  let grp: string[] = [];
  sents.forEach((s, i) => {
    grp.push(s.trim());
    if (grp.length === 2 || i === sents.length - 1) {
      const raw = grp.join(" ");
      const ti  = out.length % TR.length;
      out.push({ id: sid(), kind: "explain",
        expression: out.length % 3 === 1 ? "thinking" : "speaking",
        text: out.length > 2 ? `${TR[ti]} ${raw}` : raw,
      });
      grp = [];
    }
  });

  if (l.visual && l.visual.type !== "none") {
    const lbl: Record<string, string> = {
      fraction:"the fraction diagram", number_line:"the number line above",
      percentage:"the percentage bar", geometry:"the shape diagram", bar_chart:"the chart above",
    };
    out.push({ id: sid(), kind: "visual", expression: "excited",
      text: `Look at ${lbl[l.visual.type] ?? "the diagram"} in the lesson above. Take a moment with it — a good diagram is worth a hundred words!` });
  }

  if (l.keyInsight) out.push({ id: sid(), kind: "insight", expression: "excited",
    text: `Here is the most important takeaway: ${l.keyInsight} Remember this — it's the golden rule for this topic.` });

  l.steps.forEach((s, i) => {
    const prefix = i === 0 ? "Let's walk through this together. First up —"
      : i === l.steps.length - 1 ? "And the final step:" : "Next,";
    out.push({ id: sid(), kind: "step", expression: "speaking",
      text: `${prefix} ${s.startsWith("Step") ? s : `Step ${i + 1}: ${s}`}` });
  });

  if (l.tryIt.q && l.tryIt.options.length > 0) out.push({
    id: sid(), kind: "question", expression: "thinking",
    text: `Time for a quick check! ${l.tryIt.q} Take your time — pick an option when you're ready!`,
    options: l.tryIt.options, correct: l.tryIt.correct, why: l.tryIt.why,
  });

  out.push({ id: sid(), kind: "summary", expression: "celebrating",
    text: "Amazing work — you've completed the full lesson! That took real focus and you nailed it. Keep this up and you'll be unstoppable!" });

  return out;
}

/* ══════════════════════════════════════════ TEACHING ENGINE ══ */

function useTeachingEngine(slides: Slide[], muted: boolean, rate: number) {
  const [status,    setStatus]    = useState<EngineStatus>("idle");
  const [idx,       setIdx]       = useState(0);
  const [speaking,  setSpeaking]  = useState(false);
  const [qPicked,   setQPicked]   = useState<number | null>(null);
  const [answerRes, setAnswerRes] = useState<"correct" | "wrong" | null>(null);
  const [waitSecs,  setWaitSecs]  = useState(0);

  const tts     = useRef(new WebSpeechProvider());
  const engRef  = useRef({ status: "idle" as EngineStatus, idx: 0, muted, rate, paused: false });
  const timerRef = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const ctdRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { engRef.current.muted = muted; }, [muted]);
  useEffect(() => { engRef.current.rate  = rate;  }, [rate]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current);  timerRef.current = null; }
    if (ctdRef.current)   { clearInterval(ctdRef.current);   ctdRef.current = null; }
    setWaitSecs(0);
  }, []);

  /* playRef: self-referencing via ref so setTimeout always calls the latest version */
  const playRef = useRef<(i: number) => void>(null!);
  playRef.current = (i: number) => {
    if (engRef.current.paused) return;
    clearTimers();
    if (i >= slides.length) {
      engRef.current.status = "completed";
      setStatus("completed"); setSpeaking(false); return;
    }
    engRef.current.status = "playing"; engRef.current.idx = i;
    setStatus("playing"); setIdx(i); setQPicked(null); setAnswerRes(null);

    const slide = slides[i];
    const QTIMEOUT = 10;

    const doSpeak = (text: string, onDone: () => void) => {
      if (engRef.current.muted || !tts.current.isSupported) { setSpeaking(false); onDone(); return; }
      setSpeaking(true);
      tts.current.speak(text, engRef.current.rate, () => {
        setSpeaking(false);
        if (!engRef.current.paused) onDone();
      });
    };

    doSpeak(slide.text, () => {
      if (slide.kind === "question") {
        engRef.current.status = "waiting"; setStatus("waiting");
        let left = QTIMEOUT; setWaitSecs(left);
        ctdRef.current = setInterval(() => {
          left -= 1; setWaitSecs(left);
          if (left <= 0) {
            clearTimers();
            const cl = String.fromCharCode(65 + (slide.correct ?? 0));
            doSpeak(`Time's up! The answer was option ${cl}. ${slide.why ?? ""}`, () => playRef.current(i + 1));
          }
        }, 1000);
      } else {
        timerRef.current = setTimeout(() => playRef.current(i + 1), 380);
      }
    });
  };

  const start   = useCallback(() => { engRef.current.paused = false; playRef.current(0); }, []);
  const pause   = useCallback(() => {
    engRef.current.paused = true; tts.current.pause(); clearTimers();
    setStatus("paused"); setSpeaking(false);
  }, [clearTimers]);
  const resume  = useCallback(() => { engRef.current.paused = false; playRef.current(engRef.current.idx); }, []);
  const skip    = useCallback(() => { tts.current.stop(); clearTimers(); playRef.current(engRef.current.idx + 1); }, [clearTimers]);
  const prev    = useCallback(() => { tts.current.stop(); clearTimers(); playRef.current(Math.max(0, engRef.current.idx - 1)); }, [clearTimers]);
  const restart = useCallback(() => { tts.current.stop(); clearTimers(); engRef.current.paused = false; playRef.current(0); }, [clearTimers]);
  const jumpTo  = useCallback((i: number) => { tts.current.stop(); clearTimers(); playRef.current(i); }, [clearTimers]);

  const pickAnswer = useCallback((optIdx: number) => {
    if (engRef.current.status !== "waiting") return;
    clearTimers();
    const slide   = slides[engRef.current.idx];
    const correct = optIdx === slide.correct;
    setQPicked(optIdx); setAnswerRes(correct ? "correct" : "wrong");
    const cl  = String.fromCharCode(65 + (slide.correct ?? 0));
    const msg = correct
      ? `Excellent! That's absolutely right! ${slide.why ?? ""}`
      : `Good try! The correct answer is option ${cl}. ${slide.why ?? ""}`;
    setSpeaking(true);
    tts.current.speak(msg, engRef.current.rate, () => {
      setSpeaking(false);
      if (!engRef.current.paused) playRef.current(engRef.current.idx + 1);
    });
  }, [slides, clearTimers]);

  useEffect(() => () => { tts.current.stop(); clearTimers(); }, [clearTimers]);

  return { status, idx, speaking, qPicked, answerRes, waitSecs, start, pause, resume, skip, prev, restart, jumpTo, pickAnswer };
}

/* ══════════════════════════════════════════════════ DRAG ══ */

function useDrag() {
  const ref    = useRef<HTMLDivElement>(null);
  const [pos,  setPos]    = useState<{ left: number; top: number } | null>(null);
  const origin = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);

  const begin = useCallback((mx: number, my: number) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    origin.current = { mx, my, cx: r.left, cy: r.top };
  }, []);
  const move = useCallback((mx: number, my: number) => {
    if (!origin.current || !ref.current) return;
    const W = ref.current.offsetWidth, H = ref.current.offsetHeight;
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
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
    e.preventDefault();
  }, [begin, move, end]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    begin(e.touches[0].clientX, e.touches[0].clientY);
    const mv = (ev: TouchEvent) => { if (ev.touches.length === 1) move(ev.touches[0].clientX, ev.touches[0].clientY); };
    const up = () => { end(); window.removeEventListener("touchmove", mv); window.removeEventListener("touchend", up); };
    window.addEventListener("touchmove", mv, { passive: false }); window.addEventListener("touchend", up);
  }, [begin, move, end]);

  const style: React.CSSProperties = pos
    ? { position: "fixed", left: pos.left, top: pos.top, bottom: "auto", right: "auto" }
    : { position: "fixed", bottom: 24, right: 24 };

  return { ref, style, onMouseDown, onTouchStart };
}

/* ══════════════════════════════════════════ TEACHER AVATAR SVG ══ */

function TeacherAvatar({ persona, expression, speaking }: { persona: Persona; expression: Expression; speaking: boolean }) {
  const cel = expression === "celebrating";
  const exc = expression === "excited" || cel;
  const thk = expression === "thinking";
  const emp = expression === "empathy";
  const sur = expression === "surprised";
  const spk = speaking || expression === "speaking";
  const hap = exc || cel;
  const { skin, hair, jacket, lip, blush } = persona;

  const lb = thk ? "M 68 63 Q 78 57 88 61" : sur ? "M 66 57 Q 78 52 88 57" : hap ? "M 68 59 Q 78 54 88 59" : emp ? "M 68 65 Q 78 61 88 65" : "M 68 64 Q 78 59 88 64";
  const rb = thk ? "M 112 60 Q 122 56 132 61" : sur ? "M 112 57 Q 122 52 132 57" : hap ? "M 112 59 Q 122 54 132 59" : emp ? "M 112 65 Q 122 61 132 65" : "M 112 64 Q 122 59 132 64";
  const mth = cel ? "M 80 110 Q 100 125 120 110" : sur ? "M 88 110 Q 100 120 112 110" : exc ? "M 84 110 Q 100 120 116 110" : emp ? "M 88 113 Q 100 116 112 113" : thk ? "M 90 111 Q 100 113 110 111" : "M 85 110 Q 100 118 115 110";
  const eyeRY = sur ? 11 : hap ? 7 : 9.5;

  return (
    <svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg" style={{ width:"100%", height:"100%", overflow:"visible" }}>
      <g className={cel ? "ft-celebrate" : "ft-sway"} style={{ transformOrigin:"100px 260px" }}>

        {/* Left arm */}
        {cel ? (
          <g>
            <path d="M 55 153 Q 36 126 26 98 Q 19 76 26 64 Q 36 58 44 67 Q 54 86 60 118 Z" fill={skin} />
            <path d="M 55 153 L 44 146 L 48 120 L 63 126 Z" fill={jacket} />
          </g>
        ) : (
          <g className={exc ? "ft-arm-wave" : ""} style={{ transformOrigin:"44px 153px" }}>
            <path d="M 44 153 Q 24 180 17 218 Q 21 229 29 227 Q 37 215 41 189 L 54 160 Z" fill={skin} />
            <path d="M 44 153 L 54 160 L 47 187 L 27 179 Z" fill={jacket} />
            <ellipse cx="21" cy="225" rx="11" ry="10" fill={skin} />
          </g>
        )}

        {/* Body */}
        <polygon points="22,150 178,150 193,260 7,260" fill={jacket} />
        <path d="M 22 150 Q 58 157 88 179 L 83 260 L 7 260 Z"    fill={jacket} opacity="0.72" />
        <path d="M 178 150 Q 142 157 112 179 L 117 260 L 193 260 Z" fill={jacket} opacity="0.72" />
        <path d="M 100 150 L 75 180 L 55 166 L 76 150 Z"   fill="white" opacity="0.9" />
        <path d="M 100 150 L 125 180 L 145 166 L 124 150 Z" fill="white" opacity="0.9" />
        <rect x="91" y="177" width="18" height="83" fill="white" opacity="0.85" />
        <rect x="47" y="172" width="18" height="13" rx="2" fill="oklch(0.78 0.14 50)" opacity="0.85" />

        {/* Right arm */}
        {cel ? (
          <g>
            <path d="M 145 153 Q 164 126 174 98 Q 181 76 174 64 Q 164 58 156 67 Q 146 86 140 118 Z" fill={skin} />
            <path d="M 145 153 L 156 146 L 152 120 L 137 126 Z" fill={jacket} />
          </g>
        ) : (
          <g className="ft-arm-idle" style={{ transformOrigin:"156px 153px" }}>
            <path d="M 156 153 Q 176 180 183 218 Q 179 229 171 227 Q 163 215 159 189 L 146 160 Z" fill={skin} />
            <path d="M 156 153 L 146 160 L 153 187 L 173 179 Z" fill={jacket} />
            <ellipse cx="179" cy="225" rx="11" ry="10" fill={skin} />
          </g>
        )}

        {/* Neck */}
        <rect x="86" y="132" width="28" height="20" rx="6" fill={skin} />

        {/* Head */}
        <g className={spk ? "ft-nod" : thk ? "ft-think" : ""} style={{ transformOrigin:"100px 136px" }}>
          <ellipse cx="100" cy="72" rx="58" ry="46" fill={hair} />
          <circle  cx="100" cy="24" r="22" fill={hair} />
          <circle  cx="100" cy="18" r="12" fill={hair} opacity="0.7" />
          <ellipse cx="50"  cy="76" rx="9" ry="24" fill={hair} transform="rotate(-13 50 76)" />
          <ellipse cx="150" cy="76" rx="9" ry="24" fill={hair} transform="rotate(13 150 76)" />
          <ellipse cx="44"  cy="84" rx="9" ry="12" fill={skin} />
          <ellipse cx="156" cy="84" rx="9" ry="12" fill={skin} />
          <ellipse cx="44"  cy="84" rx="4.5" ry="7" fill={skin} opacity="0.7" />
          <ellipse cx="156" cy="84" rx="4.5" ry="7" fill={skin} opacity="0.7" />
          <ellipse cx="100" cy="88" rx="50" ry="56" fill={skin} />
          <ellipse cx="100" cy="106" rx="42" ry="36" fill="oklch(0 0 0 / 0.04)" />
          <path d={lb} stroke={hair} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d={rb} stroke={hair} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <rect x="64"  y="66" width="30" height="18" rx="6" fill="none" stroke="oklch(0.27 0.14 256)" strokeWidth="2.2" />
          <rect x="106" y="66" width="30" height="18" rx="6" fill="none" stroke="oklch(0.27 0.14 256)" strokeWidth="2.2" />
          <line x1="94"  y1="75" x2="106" y2="75" stroke="oklch(0.27 0.14 256)" strokeWidth="2" />
          <line x1="64"  y1="75" x2="55"  y2="72" stroke="oklch(0.27 0.14 256)" strokeWidth="2" />
          <line x1="136" y1="75" x2="145" y2="72" stroke="oklch(0.27 0.14 256)" strokeWidth="2" />
          <ellipse cx="79"  cy="76" rx="9.5" ry={eyeRY} fill="white" />
          <ellipse cx="121" cy="76" rx="9.5" ry={eyeRY} fill="white" />
          <circle cx="79.5"  cy="76.5" r="5.8" fill="#2a1600" />
          <circle cx="121.5" cy="76.5" r="5.8" fill="#2a1600" />
          <circle cx="79.5"  cy="76.5" r="3.2" fill="#111" />
          <circle cx="121.5" cy="76.5" r="3.2" fill="#111" />
          <circle cx="83"  cy="74" r="2.2" fill="white" opacity="0.9" />
          <circle cx="125" cy="74" r="2.2" fill="white" opacity="0.9" />
          <ellipse cx="79"  cy="68" rx="10" ry="6" fill={skin} className="ft-eyelid" style={{ transformOrigin:"79px 63px" }} />
          <ellipse cx="121" cy="68" rx="10" ry="6" fill={skin} className="ft-eyelid" style={{ transformOrigin:"121px 63px" }} />
          <path d="M 97 93 Q 93 100 95 103 Q 98.5 105 100 105 Q 101.5 105 105 103 Q 107 100 103 93" fill="none" stroke={skin} strokeWidth="2.5" opacity="0.6" />
          {!spk && (
            <>
              <path d={mth} stroke={lip} strokeWidth="3" fill="none" strokeLinecap="round" />
              {cel && <path d="M 80 110 Q 100 125 120 110 L 118 118 Q 100 130 82 118 Z" fill="white" stroke={lip} strokeWidth="1.5" />}
            </>
          )}
          {spk && (
            <>
              <path d="M 85 110 Q 100 116 115 110" stroke={lip} strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <ellipse cx="100" cy="113" rx="13" ry="3.5" fill="#8B4513" className="ft-mouth-open" style={{ transformOrigin:"100px 110px" }} />
            </>
          )}
          <ellipse cx="60"  cy="100" rx="14" ry="8" fill={blush} opacity={hap ? 0.34 : sur ? 0.25 : 0.12} />
          <ellipse cx="140" cy="100" rx="14" ry="8" fill={blush} opacity={hap ? 0.34 : sur ? 0.25 : 0.12} />
          {thk && <path d="M 55 138 Q 62 126 72 120 Q 80 116 82 121" stroke={skin} strokeWidth="7" fill="none" strokeLinecap="round" />}
        </g>

        {/* Chest breathe */}
        <ellipse cx="100" cy="205" rx="55" ry="22" fill={jacket} className="ft-breathe" style={{ transformOrigin:"100px 183px" }} />
      </g>
    </svg>
  );
}

/* ══════════════════════════════════════════════ CHAPTER NAV ══ */

const KIND_ICON: Record<SlideKind, string> = {
  welcome:"👋", intro:"📚", explain:"💬", visual:"🖼️",
  insight:"💡", step:"📝", question:"✏️", summary:"🏆",
};

function ChapterNav({ slides, current, onJump, onClose }: {
  slides: Slide[]; current: number; onJump: (i: number) => void; onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col z-10 rounded-[22px] overflow-hidden" style={{ background:"var(--surface)" }}>
      <div className="flex items-center px-3.5 py-2.5 border-b border-[var(--line-200)]" style={{ background:"var(--cobalt-50)" }}>
        <span className="text-[12.5px] font-bold flex-1" style={{ color:"var(--cobalt-700)" }}>Chapters</span>
        <button onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full border-none cursor-pointer hover:bg-[var(--cobalt-100)] transition-colors"
          style={{ background:"transparent", color:"var(--fg-muted)" }}>
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {slides.map((s, i) => (
          <button key={s.id} onClick={() => { onJump(i); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 border-none cursor-pointer text-left transition-colors hover:bg-[var(--fill-100)] border-b border-[var(--line-100)]"
            style={{ background: i === current ? "var(--cobalt-50)" : "transparent", color: i === current ? "var(--cobalt-700)" : "var(--ink-800)" }}>
            <span className="text-[13px] flex-shrink-0">{KIND_ICON[s.kind]}</span>
            <span className="text-[11.5px] font-semibold leading-snug line-clamp-2 flex-1">
              {s.text.slice(0, 55)}{s.text.length > 55 ? "…" : ""}
            </span>
            {i === current && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:"var(--cobalt-500)" }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ WAVEFORM BARS ══ */

const WH = [5, 11, 7, 15, 9, 17, 11, 7, 13, 5, 9, 15, 7, 11, 5];

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-[2px]" aria-hidden>
      {WH.map((h, i) => (
        <div key={i} className="rounded-full" style={{
          width: 2, height: active ? h : 3,
          background: active ? "var(--cobalt-400)" : "var(--line-300)",
          transition: `height ${65 + i * 16}ms ease`,
          animation: active ? `ft-wv-${i % 3} ${0.5 + i * 0.06}s ease-in-out ${i * 0.05}s infinite alternate` : "none",
        }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════ CTRL BUTTON HELPER ══ */

function CtrlBtn({ onClick, title, children, disabled, primary, active }: {
  onClick: () => void; title: string; children: React.ReactNode;
  disabled?: boolean; primary?: boolean; active?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className="w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default transition-all hover:opacity-90"
      style={{
        background:  primary ? "var(--cobalt-500)" : active ? "var(--fill-200)" : "var(--surface)",
        borderColor: primary ? "transparent" : "var(--line-300)",
      }}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════ MAIN COMPONENT (default) ══ */

const SPEEDS = [0.75, 1.0, 1.25, 1.5];

export default function FloatingTeacher({ lesson, onClose }: {
  lesson: LessonData; onClose: () => void;
}) {
  const slides = useMemo(() => buildScript(lesson), [lesson]);
  const [muted,      setMuted]      = useState(false);
  const [rate,       setRate]       = useState(1.0);
  const [minimized,  setMinimized]  = useState(false);
  const [chapOpen,   setChapOpen]   = useState(false);
  const [personaIdx, setPersonaIdx] = useState(0);

  const persona = PERSONAS[personaIdx];
  const engine  = useTeachingEngine(slides, muted, rate);
  const { ref, style: dragStyle, onMouseDown, onTouchStart } = useDrag();

  /* Auto-start on mount */
  const startRef = useRef(engine.start);
  startRef.current = engine.start;
  useEffect(() => { startRef.current(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = slides[engine.idx] ?? slides[0];

  const expression: Expression =
    engine.answerRes === "correct" ? "celebrating"
    : engine.answerRes === "wrong"  ? "empathy"
    : engine.speaking               ? "speaking"
    : engine.status === "waiting"   ? "thinking"
    : cur.expression;

  const progress = slides.length > 1 ? (engine.idx / (slides.length - 1)) * 100 : 0;

  return (
    <>
      {/* ═══ Global keyframe CSS ═══ */}
      <style>{`
        @keyframes ft-sway       { 0%,100%{transform:rotate(-1.1deg) translateY(0)} 50%{transform:rotate(1.1deg) translateY(-3px)} }
        @keyframes ft-celebrate  { 0%,100%{transform:translateY(0) rotate(0deg)} 22%,62%{transform:translateY(-14px) rotate(-2.5deg)} 42%,82%{transform:translateY(-8px) rotate(2.5deg)} }
        @keyframes ft-breathe    { 0%,100%{transform:scaleY(1) scaleX(1)} 50%{transform:scaleY(1.07) scaleX(0.97)} }
        @keyframes ft-blink      { 0%,80%,100%{transform:scaleY(1)} 85%{transform:scaleY(6)} 90%{transform:scaleY(1)} }
        @keyframes ft-nod        { 0%,100%{transform:rotate(0deg)} 28%{transform:rotate(-5.5deg)} 66%{transform:rotate(2.5deg)} }
        @keyframes ft-think      { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(-8deg)} }
        @keyframes ft-mouth-talk { 0%,100%{transform:scaleY(0.2)} 50%{transform:scaleY(1)} }
        @keyframes ft-arm-swing  { 0%,100%{transform:rotate(0deg)} 45%{transform:rotate(-22deg)} }
        @keyframes ft-ring       { 0%,100%{box-shadow:0 0 0 0 oklch(0.6 0.2 256/0.0)} 50%{box-shadow:0 0 0 7px oklch(0.6 0.2 256/0.35)} }
        @keyframes ft-wv-0 { to{height:16px} }
        @keyframes ft-wv-1 { to{height:22px} }
        @keyframes ft-wv-2 { to{height:12px} }
        @keyframes ft-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .ft-sway       { animation: ft-sway      5s   ease-in-out infinite }
        .ft-celebrate  { animation: ft-celebrate 0.7s ease-in-out 3 }
        .ft-breathe    { animation: ft-breathe   4s   ease-in-out infinite }
        .ft-eyelid     { animation: ft-blink     4.8s ease-in-out infinite }
        .ft-nod        { animation: ft-nod       1.5s ease-in-out infinite }
        .ft-think      { animation: ft-think     3.2s ease-in-out infinite }
        .ft-mouth-open { animation: ft-mouth-talk 0.4s ease-in-out infinite }
        .ft-arm-wave   { animation: ft-arm-swing 2s   ease-in-out infinite }
        .ft-arm-idle   { animation: ft-arm-swing 3.5s ease-in-out infinite }
        .ft-ring       { animation: ft-ring      1.2s ease-in-out infinite }
        .ft-pulse      { animation: ft-pulse     1.4s ease-in-out infinite }
      `}</style>

      {/* ═══ Floating container ═══ */}
      <div ref={ref} style={{ ...dragStyle, zIndex: 9999, width: minimized ? 212 : 280, userSelect: "none" }}
        className="select-none">
        <div className="relative flex flex-col rounded-[22px] overflow-hidden"
          style={{
            background: "var(--surface)",
            border:     "1.5px solid var(--cobalt-200)",
            boxShadow:  "0 12px 48px oklch(0.2 0.06 255 / 0.26), 0 2px 12px oklch(0.2 0.06 255 / 0.12)",
          }}>

          {/* Chapter overlay */}
          {chapOpen && (
            <ChapterNav slides={slides} current={engine.idx}
              onJump={engine.jumpTo} onClose={() => setChapOpen(false)} />
          )}

          {/* ── Header / drag handle ── */}
          <div onMouseDown={onMouseDown} onTouchStart={onTouchStart}
            className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none border-b border-[var(--cobalt-100)]"
            style={{ background:"var(--cobalt-50)" }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
              style={{ background: persona.jacket, color:"white" }}>
              {persona.name[0]}
            </div>
            <span className="text-[12.5px] font-bold flex-1 truncate" style={{ color:"var(--cobalt-700)" }}>
              {persona.name} · {persona.title}
            </span>
            <button onClick={() => setMinimized(m => !m)} title={minimized ? "Expand" : "Minimise"}
              className="w-6 h-6 rounded-full border-none cursor-pointer flex items-center justify-center hover:bg-[var(--cobalt-100)] transition-colors"
              style={{ background:"transparent", color:"var(--fg-muted)" }}>
              {minimized ? <Maximize2 size={11} /> : <Minus size={11} />}
            </button>
            <button onClick={() => { engine.pause(); onClose(); }} title="Close"
              className="w-6 h-6 rounded-full border-none cursor-pointer flex items-center justify-center hover:bg-[var(--cobalt-100)] transition-colors"
              style={{ background:"transparent", color:"var(--fg-muted)" }}>
              <X size={11} />
            </button>
          </div>

          {minimized ? (
            /* ── Compact / minimised view ── */
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div style={{ width:50, height:62, flexShrink:0 }}>
                <TeacherAvatar persona={persona} expression={expression} speaking={engine.speaking} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  {(engine.status === "playing" || engine.status === "waiting") &&
                    <div className="w-1.5 h-1.5 rounded-full ft-pulse" style={{ background:"var(--cobalt-500)" }} />}
                  <span className="text-[10.5px] font-semibold" style={{
                    color: engine.status === "playing" || engine.status === "waiting" ? "var(--cobalt-600)"
                      : engine.status === "completed" ? "var(--success)" : "var(--fg-muted)",
                  }}>
                    {engine.status === "playing" ? "Teaching…"
                     : engine.status === "waiting" ? "Waiting for you…"
                     : engine.status === "paused"  ? "Paused"
                     : engine.status === "completed" ? "Complete! 🎉"
                     : "Ready"}
                  </span>
                </div>
                <p className="text-[11px] leading-snug line-clamp-2" style={{ color:"var(--ink-600)" }}>
                  {cur.text.slice(0, 52)}…
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Avatar stage ── */}
              <div className="relative flex justify-center overflow-hidden"
                style={{ height:200, background:"radial-gradient(ellipse at 50% 35%, oklch(0.96 0.04 256) 0%, oklch(0.90 0.04 260) 100%)" }}>
                <div className={engine.speaking ? "ft-ring" : ""}
                  style={{ width:174, height:200, borderRadius:"50% 50% 0 0", overflow:"hidden" }}>
                  <TeacherAvatar persona={persona} expression={expression} speaking={engine.speaking} />
                </div>

                {/* Expression badge */}
                <div className="absolute top-2 left-3 text-[19px] leading-none select-none" aria-hidden>
                  {expression === "celebrating" ? "🎉" : expression === "empathy" ? "😔"
                   : expression === "surprised" ? "😮" : expression === "excited" ? "😊"
                   : expression === "thinking"  ? "🤔" : expression === "speaking" ? "🎤" : "😊"}
                </div>

                {/* Slide counter */}
                <div className="absolute top-2 right-3 text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background:"var(--cobalt-100)", color:"var(--cobalt-700)", fontFamily:"var(--font-mono)" }}>
                  {engine.idx + 1}/{slides.length}
                </div>

                {/* Question timeout */}
                {engine.status === "waiting" && engine.waitSecs > 0 && (
                  <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none">
                    <div className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background:"var(--gold-100)", color:"var(--gold-700)" }}>
                      ⏱ {engine.waitSecs}s
                    </div>
                  </div>
                )}

                {/* Waveform */}
                <div className="absolute bottom-2.5 left-0 right-0 flex justify-center">
                  <Waveform active={engine.speaking} />
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-[3px]" style={{ background:"var(--fill-200)" }}>
                <div className="h-full rounded-r-full"
                  style={{ width:`${progress}%`, background:"var(--cobalt-400)", transition:"width 400ms ease" }} />
              </div>

              {/* ── Speech bubble ── */}
              <div className="px-3.5 py-3 border-b border-[var(--line-200)]" style={{ background:"var(--surface)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1.5"
                  style={{ color: cur.kind === "question" ? "var(--gold-700)" : "var(--cobalt-500)", fontFamily:"var(--font-mono)" }}>
                  {KIND_ICON[cur.kind]} {cur.kind}
                </p>
                <p className="text-[13px] leading-[1.55]" style={{ color:"var(--ink-800)" }}>
                  {cur.text.length > 200 ? cur.text.slice(0, 197) + "…" : cur.text}
                </p>
              </div>

              {/* ── Question options ── */}
              {cur.kind === "question" && cur.options && (
                <div className="px-3.5 pt-2.5 pb-3 border-b border-[var(--line-200)]" style={{ background:"var(--surface)" }}>
                  <div className="flex flex-col gap-1.5">
                    {cur.options.map((opt, i) => {
                      const isC = i === cur.correct, isP = i === engine.qPicked;
                      const done = engine.qPicked !== null;
                      return (
                        <button key={i} onClick={() => engine.pickAnswer(i)} disabled={done}
                          className="w-full text-left px-3 py-2 rounded-[var(--r-md)] border-[1.5px] text-[12px] font-semibold cursor-pointer disabled:cursor-default transition-all duration-150"
                          style={{
                            fontFamily:  "var(--font-mono)",
                            borderColor: done && isC ? "var(--success)" : done && isP && !isC ? "var(--danger)" : "var(--line-300)",
                            background:  done && isC ? "var(--success-bg)" : done && isP && !isC ? "var(--danger-bg)" : "var(--surface)",
                            color:       done && isC ? "var(--success-tx)" : done && isP && !isC ? "var(--danger-tx)" : "var(--ink-900)",
                          }}>
                          <span style={{ opacity:0.45, marginRight:4 }}>{String.fromCharCode(65 + i)}.</span>
                          {opt}
                          {done && isC && <Check size={11} style={{ display:"inline", marginLeft:5, color:"var(--success)" }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Playback controls ── */}
              <div className="flex items-center gap-1.5 px-3 py-2" style={{ background:"var(--paper-2)" }}>
                <CtrlBtn onClick={engine.prev} title="Previous slide" disabled={engine.idx === 0}>
                  <SkipBack size={11} style={{ color:"var(--ink-700)" }} />
                </CtrlBtn>

                {engine.status === "completed" ? (
                  <CtrlBtn onClick={engine.restart} title="Restart lesson" primary>
                    <RotateCcw size={11} color="white" />
                  </CtrlBtn>
                ) : engine.status === "playing" || engine.status === "waiting" ? (
                  <CtrlBtn onClick={engine.pause} title="Pause" primary>
                    <Pause size={11} color="white" />
                  </CtrlBtn>
                ) : (
                  <CtrlBtn onClick={engine.status === "paused" ? engine.resume : engine.start} title="Play" primary>
                    <Play size={11} color="white" />
                  </CtrlBtn>
                )}

                <CtrlBtn onClick={engine.skip} title="Skip to next" disabled={engine.status === "completed"}>
                  <SkipForward size={11} style={{ color:"var(--ink-700)" }} />
                </CtrlBtn>

                <CtrlBtn onClick={() => setMuted(m => !m)} title={muted ? "Unmute" : "Mute"} active={muted}>
                  {muted ? <VolumeX size={11} style={{ color:"var(--fg-muted)" }} />
                         : <Volume2 size={11} style={{ color:"var(--ink-700)" }} />}
                </CtrlBtn>

                <span className="flex-1" />

                {/* Speed cycle */}
                <button
                  onClick={() => setRate(r => SPEEDS[(SPEEDS.indexOf(r) + 1) % SPEEDS.length])}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-[var(--line-300)] cursor-pointer hover:bg-[var(--fill-100)] transition-colors"
                  style={{ fontFamily:"var(--font-mono)", background:"var(--surface)", color:"var(--ink-700)" }}
                  title="Playback speed">
                  ×{rate}
                </button>

                <CtrlBtn onClick={() => setChapOpen(o => !o)} title="Chapters" active={chapOpen}>
                  <List size={11} style={{ color: chapOpen ? "var(--cobalt-600)" : "var(--ink-700)" }} />
                </CtrlBtn>

                <CtrlBtn onClick={() => setPersonaIdx(i => (i + 1) % PERSONAS.length)} title="Change teacher">
                  <User size={11} style={{ color:"var(--ink-700)" }} />
                </CtrlBtn>
              </div>

              {/* Persona dots */}
              <div className="flex items-center justify-center gap-1 py-1.5 border-t border-[var(--line-100)]"
                style={{ background:"var(--paper-2)" }}>
                {PERSONAS.map((p, i) => (
                  <button key={p.id} onClick={() => setPersonaIdx(i)}
                    title={`${p.name} (${p.title})`}
                    className="rounded-full cursor-pointer transition-all border-[2px]"
                    style={{
                      width: i === personaIdx ? 20 : 16,
                      height: i === personaIdx ? 20 : 16,
                      background:  p.jacket,
                      borderColor: i === personaIdx ? "var(--cobalt-500)" : "transparent",
                    }} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
