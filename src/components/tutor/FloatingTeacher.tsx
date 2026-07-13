"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X, Minus, Maximize2,
  Volume2, VolumeX, Play, Pause, RotateCcw, SkipForward, SkipBack,
  Check, List, ExternalLink, Wifi, WifiOff,
} from "lucide-react";
import type { AvatarCapabilities, AvatarProvider } from "./avatar/types";

/* ══════════════════════════════════════════════ LESSON TYPES ══ */

export interface LessonData {
  text:        string;
  keyInsight?: string;
  visual?:     { type: string; data: Record<string, unknown> };
  steps:       string[];
  tryIt:       { q: string; options: string[]; correct: number; why: string };
  follows:     string[];
}

type SlideKind = "welcome"|"intro"|"explain"|"visual"|"insight"|"step"|"question"|"summary";
type EngineStatus = "idle"|"playing"|"paused"|"waiting"|"completed";

interface Slide {
  id:         string;
  kind:       SlideKind;
  text:       string;
  options?:   string[];
  correct?:   number;
  why?:       string;
}

/* ════════════════════════════════════════════ SCRIPT BUILDER ══ */

const TR = [
  "Now, building on that —", "Here's where it gets interesting:",
  "Think of it this way:", "This is the key part —",
  "Let me show you exactly how this works.", "Here's something worth noting:",
  "Now let's connect the dots.",
];

let _n = 0;
const ns = () => `s${_n++}`;

function buildScript(l: LessonData): Slide[] {
  _n = 0;
  const out: Slide[] = [];

  out.push({ id: ns(), kind: "welcome",
    text: "Hi there! I'm really glad you're here. Let's learn this together — I'll guide you step by step. Ready? Let's go!" });

  const m = l.text.match(/^([^.!?]+[.!?](?:\s+[^.!?]+[.!?])?)/);
  const intro = m?.[0]?.trim() ?? l.text.slice(0, 150);
  out.push({ id: ns(), kind: "intro", text: intro });

  const rest = l.text.slice(intro.length).trim();
  const ss   = rest.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 8);
  let grp: string[] = [];
  ss.forEach((s, i) => {
    grp.push(s.trim());
    if (grp.length === 2 || i === ss.length - 1) {
      const raw  = grp.join(" ");
      const ti   = out.length % TR.length;
      out.push({ id: ns(), kind: "explain", text: out.length > 2 ? `${TR[ti]} ${raw}` : raw });
      grp = [];
    }
  });

  if (l.visual && l.visual.type !== "none") {
    const lbl: Record<string, string> = {
      fraction:"the fraction diagram", number_line:"the number line above",
      percentage:"the percentage bar", geometry:"the shape diagram", bar_chart:"the chart above",
    };
    out.push({ id: ns(), kind: "visual",
      text: `Look at ${lbl[l.visual.type] ?? "the diagram"} in the lesson above. Take a moment with it — a good diagram is worth a hundred words!` });
  }

  if (l.keyInsight) out.push({ id: ns(), kind: "insight",
    text: `Here's the most important takeaway: ${l.keyInsight} Remember this — it's the golden rule for this topic.` });

  l.steps.forEach((s, i) => {
    const pre = i === 0 ? "Let's walk through this together. First —"
      : i === l.steps.length-1 ? "And the final step:" : "Next,";
    out.push({ id: ns(), kind: "step", text: `${pre} ${s.startsWith("Step") ? s : `Step ${i+1}: ${s}`}` });
  });

  if (l.tryIt.q && l.tryIt.options.length > 0) out.push({
    id: ns(), kind: "question",
    text: `Time for a quick check! ${l.tryIt.q} Take your time — pick an option when you're ready!`,
    options: l.tryIt.options, correct: l.tryIt.correct, why: l.tryIt.why,
  });

  out.push({ id: ns(), kind: "summary",
    text: "Amazing work — you've completed the full lesson! That took real focus and you nailed it. Keep this up and you'll be unstoppable!" });

  return out;
}

/* ══════════════════════════════════════════ TEACHING ENGINE ══ */

function useTeachingEngine(slides: Slide[], provider: AvatarProvider | null, muted: boolean, rate: number) {
  const [status,    setStatus]    = useState<EngineStatus>("idle");
  const [idx,       setIdx]       = useState(0);
  const [speaking,  setSpeaking]  = useState(false);
  const [qPicked,   setQPicked]   = useState<number | null>(null);
  const [answerRes, setAnswerRes] = useState<"correct"|"wrong"|null>(null);
  const [waitSecs,  setWaitSecs]  = useState(0);

  const engRef   = useRef({ status:"idle" as EngineStatus, idx:0, muted, rate, paused:false });
  const timerRef = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const ctdRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const provRef  = useRef<AvatarProvider | null>(null);

  useEffect(() => { engRef.current.muted = muted; }, [muted]);
  useEffect(() => { engRef.current.rate  = rate;  }, [rate]);
  useEffect(() => { provRef.current      = provider; }, [provider]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current);  timerRef.current = null; }
    if (ctdRef.current)   { clearInterval(ctdRef.current);   ctdRef.current = null; }
    setWaitSecs(0);
  }, []);

  const playRef = useRef<(i: number) => void>(null!);
  playRef.current = (i: number) => {
    if (engRef.current.paused) return;
    clearTimers();
    if (i >= slides.length) {
      engRef.current.status = "completed"; setStatus("completed"); setSpeaking(false); return;
    }
    engRef.current.status = "playing"; engRef.current.idx = i;
    setStatus("playing"); setIdx(i); setQPicked(null); setAnswerRes(null);

    const slide = slides[i];
    const QTOUT = 10;

    const doSpeak = (text: string, onDone: () => void) => {
      const prov = provRef.current;
      if (engRef.current.muted || !prov) { setSpeaking(false); onDone(); return; }
      setSpeaking(true);
      prov.speak(text, engRef.current.rate, () => {
        setSpeaking(false);
        if (!engRef.current.paused) onDone();
      });
    };

    doSpeak(slide.text, () => {
      if (slide.kind === "question") {
        engRef.current.status = "waiting"; setStatus("waiting");
        let left = QTOUT; setWaitSecs(left);
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
    engRef.current.paused = true; provRef.current?.pause(); clearTimers();
    setStatus("paused"); setSpeaking(false);
  }, [clearTimers]);
  const resume  = useCallback(() => { engRef.current.paused = false; playRef.current(engRef.current.idx); }, []);
  const skip    = useCallback(() => { provRef.current?.stop(); clearTimers(); playRef.current(engRef.current.idx + 1); }, [clearTimers]);
  const prev    = useCallback(() => { provRef.current?.stop(); clearTimers(); playRef.current(Math.max(0, engRef.current.idx - 1)); }, [clearTimers]);
  const restart = useCallback(() => { provRef.current?.stop(); clearTimers(); engRef.current.paused = false; playRef.current(0); }, [clearTimers]);
  const jumpTo  = useCallback((i: number) => { provRef.current?.stop(); clearTimers(); playRef.current(i); }, [clearTimers]);

  const pickAnswer = useCallback((optIdx: number) => {
    if (engRef.current.status !== "waiting") return;
    clearTimers();
    const slide = slides[engRef.current.idx];
    const ok    = optIdx === slide.correct;
    setQPicked(optIdx); setAnswerRes(ok ? "correct" : "wrong");
    const cl    = String.fromCharCode(65 + (slide.correct ?? 0));
    const msg   = ok
      ? `Excellent! That's absolutely right! ${slide.why ?? ""}`
      : `Good try! The correct answer is option ${cl}. ${slide.why ?? ""}`;
    setSpeaking(true);
    provRef.current?.speak(msg, engRef.current.rate, () => {
      setSpeaking(false);
      if (!engRef.current.paused) playRef.current(engRef.current.idx + 1);
    });
  }, [slides, clearTimers]);

  useEffect(() => () => { provRef.current?.stop(); clearTimers(); }, [clearTimers]);

  return { status, idx, speaking, qPicked, answerRes, waitSecs, start, pause, resume, skip, prev, restart, jumpTo, pickAnswer };
}

/* ═══════════════════════════════════════════════════ DRAG ══ */

function useDrag() {
  const ref    = useRef<HTMLDivElement>(null);
  const [pos,  setPos] = useState<{ left:number; top:number }|null>(null);
  const origin = useRef<{ mx:number; my:number; cx:number; cy:number }|null>(null);

  const begin = useCallback((mx:number, my:number) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    origin.current = { mx, my, cx:r.left, cy:r.top };
  }, []);
  const move = useCallback((mx:number, my:number) => {
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
    const mv = (ev: TouchEvent) => { if (ev.touches.length===1) move(ev.touches[0].clientX, ev.touches[0].clientY); };
    const up = () => { end(); window.removeEventListener("touchmove", mv); window.removeEventListener("touchend", up); };
    window.addEventListener("touchmove", mv, { passive:false }); window.addEventListener("touchend", up);
  }, [begin, move, end]);

  const style: React.CSSProperties = pos
    ? { position:"fixed", left:pos.left, top:pos.top, bottom:"auto", right:"auto" }
    : { position:"fixed", bottom:24, right:24 };

  return { ref, style, onMouseDown, onTouchStart };
}

/* ════════════════════════════════════════════ WAVEFORM ══ */

const WH = [4, 10, 6, 14, 8, 18, 10, 6, 12, 4, 8, 14, 6, 10, 4];
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-[2.5px]" aria-hidden>
      {WH.map((h, i) => (
        <div key={i} style={{
          width: 2.5, height: active ? h : 3, borderRadius: 2,
          background: active ? "var(--cobalt-400)" : "var(--line-300)",
          transition: `height ${60 + i * 14}ms ease`,
          animation: active ? `ft-wv-${i%3} ${0.48 + i*0.055}s ease-in-out ${i*0.048}s infinite alternate` : "none",
        }} />
      ))}
    </div>
  );
}

/* ═════════════════════════════════════ PROVIDER SETUP GUIDE ══ */

const PROVIDERS = [
  { name: "HeyGen",    url: "https://www.heygen.com",    desc: "Best quality, lip-sync & gestures", badge: "⭐ Recommended" },
  { name: "Tavus",     url: "https://www.tavus.io",       desc: "Clone your own voice & face" },
  { name: "D-ID",      url: "https://www.d-id.com",       desc: "Photo-based talking avatar" },
  { name: "Synthesia", url: "https://www.synthesia.io",   desc: "Professional AI presenters" },
  { name: "Azure AI",  url: "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/overview", desc: "Enterprise-grade avatars" },
];

function ProviderSetupGuide() {
  return (
    <div className="px-4 py-4 border-b border-[var(--line-200)]" style={{ background:"var(--surface)" }}>
      <p className="text-[13px] font-bold mb-1" style={{ color:"var(--ink-900)" }}>Connect a photorealistic avatar</p>
      <p className="text-[11.5px] leading-[1.5] mb-3" style={{ color:"var(--fg-muted)" }}>
        Add <code className="px-1 rounded text-[10.5px]" style={{ background:"var(--fill-200)", color:"var(--cobalt-700)" }}>HEYGEN_API_KEY</code> to your <code className="px-1 rounded text-[10.5px]" style={{ background:"var(--fill-200)", color:"var(--cobalt-700)" }}>.env</code> to enable a photorealistic AI teacher.
      </p>
      <div className="flex flex-col gap-1.5">
        {PROVIDERS.map(p => (
          <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--r-md)] border border-[var(--line-200)] no-underline hover:bg-[var(--fill-100)] transition-colors"
            style={{ background:"var(--surface)" }}>
            <span className="text-[12.5px] font-bold flex-1" style={{ color:"var(--ink-800)" }}>{p.name}</span>
            {p.badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background:"var(--cobalt-100)", color:"var(--cobalt-700)" }}>{p.badge}</span>}
            <ExternalLink size={11} style={{ color:"var(--fg-muted)", flexShrink:0 }} />
          </a>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════ CHAPTER NAV OVERLAY ══ */

const KIND_ICON: Record<SlideKind, string> = {
  welcome:"👋", intro:"📚", explain:"💬", visual:"🖼️",
  insight:"💡", step:"📝", question:"✏️", summary:"🏆",
};

function ChapterNav({ slides, current, onJump, onClose }: {
  slides: Slide[]; current: number; onJump:(i:number)=>void; onClose:()=>void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-[22px] overflow-hidden" style={{ background:"var(--surface)" }}>
      <div className="flex items-center px-3.5 py-2.5 border-b border-[var(--line-200)]" style={{ background:"var(--cobalt-50)" }}>
        <span className="text-[12.5px] font-bold flex-1" style={{ color:"var(--cobalt-700)" }}>Chapters</span>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full border-none cursor-pointer hover:bg-[var(--cobalt-100)] transition-colors" style={{ background:"transparent", color:"var(--fg-muted)" }}>
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {slides.map((s, i) => (
          <button key={s.id} onClick={() => { onJump(i); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 border-none cursor-pointer text-left transition-colors hover:bg-[var(--fill-100)] border-b border-[var(--line-100)]"
            style={{ background: i===current ? "var(--cobalt-50)" : "transparent", color: i===current ? "var(--cobalt-700)" : "var(--ink-800)" }}>
            <span className="text-[13px] flex-shrink-0">{KIND_ICON[s.kind]}</span>
            <span className="text-[11.5px] font-semibold leading-snug line-clamp-2 flex-1">{s.text.slice(0, 55)}{s.text.length>55?"…":""}</span>
            {i===current && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:"var(--cobalt-500)" }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════ CTRL BUTTON ══ */

function Btn({ onClick, title, children, disabled, primary, active }: {
  onClick:()=>void; title:string; children:React.ReactNode;
  disabled?:boolean; primary?:boolean; active?:boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className="w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default transition-all hover:opacity-90"
      style={{ background: primary?"var(--cobalt-500)":active?"var(--fill-200)":"var(--surface)", borderColor: primary?"transparent":"var(--line-300)" }}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════ MAIN COMPONENT ══ */

const SPEEDS = [0.75, 1.0, 1.25, 1.5];

export default function FloatingTeacher({ lesson, onClose }: {
  lesson: LessonData; onClose: () => void;
}) {
  const slides = useMemo(() => buildScript(lesson), [lesson]);

  const [caps,       setCaps]       = useState<AvatarCapabilities | null>(null);
  const [provider,   setProvider]   = useState<AvatarProvider | null>(null);
  const [provStatus, setProvStatus] = useState<"loading"|"ready"|"error">("loading");
  const [provError,  setProvError]  = useState("");
  const [muted,      setMuted]      = useState(false);
  const [rate,       setRate]       = useState(1.0);
  const [minimized,  setMinimized]  = useState(false);
  const [chapOpen,   setChapOpen]   = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const engine   = useTeachingEngine(slides, provider, muted, rate);
  const { ref, style: dragStyle, onMouseDown, onTouchStart } = useDrag();

  /* ── Step 1: fetch provider capabilities ── */
  useEffect(() => {
    fetch("/api/avatar/capabilities")
      .then(r => r.json())
      .then((c: AvatarCapabilities) => setCaps(c))
      .catch(() => setCaps({ video:"none", voice:"browser", avatarId:"", voiceId:"" }));
  }, []);

  /* ── Step 2: initialise provider once caps arrive ── */
  useEffect(() => {
    if (!caps) return;
    let active = true;

    const init = async () => {
      let p: AvatarProvider;

      if (caps.video === "heygen") {
        const { HeyGenProvider }       = await import("./avatar/HeyGenProvider");
        p = new HeyGenProvider();
      } else if (caps.voice === "openai") {
        const { OpenAIVoiceProvider }  = await import("./avatar/OpenAIVoiceProvider");
        p = new OpenAIVoiceProvider();
      } else {
        const { WebSpeechProvider }    = await import("./avatar/WebSpeechProvider");
        p = new WebSpeechProvider();
      }

      await p.initialize(videoRef.current);
      if (!active) { p.destroy(); return; }
      setProvider(p);
      setProvStatus("ready");
    };

    init().catch(err => {
      if (!active) return;
      console.error("[FloatingTeacher] provider init failed:", err);
      setProvError((err as Error).message ?? "Failed to connect avatar");
      setProvStatus("error");
      /* Fallback: try WebSpeech */
      import("./avatar/WebSpeechProvider").then(({ WebSpeechProvider }) => {
        const fallback = new WebSpeechProvider();
        fallback.initialize().then(() => {
          if (!active) { fallback.destroy(); return; }
          setProvider(fallback);
          setProvStatus("ready");
        });
      });
    });

    return () => { active = false; };
  }, [caps]);

  /* ── Step 3: auto-start once provider is ready ── */
  const startedRef = useRef(false);
  const startRef   = useRef(engine.start);
  startRef.current = engine.start;
  useEffect(() => {
    if (provStatus === "ready" && !startedRef.current) {
      startedRef.current = true;
      startRef.current();
    }
  }, [provStatus]);

  const cur      = slides[engine.idx] ?? slides[0];
  const progress = slides.length > 1 ? (engine.idx / (slides.length - 1)) * 100 : 0;
  const hasVideo = caps?.video === "heygen";

  return (
    <>
      <style>{`
        @keyframes ft-wv-0 { to{height:16px} }
        @keyframes ft-wv-1 { to{height:22px} }
        @keyframes ft-wv-2 { to{height:12px} }
        @keyframes ft-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        .ft-pulse { animation: ft-pulse 1.4s ease-in-out infinite }
      `}</style>

      <div ref={ref} style={{ ...dragStyle, zIndex:9999, width: minimized ? 212 : 284, userSelect:"none" }}
        className="select-none">
        <div className="relative flex flex-col rounded-[22px] overflow-hidden"
          style={{
            background: "var(--surface)",
            border:     "1.5px solid var(--cobalt-200)",
            boxShadow:  "0 12px 48px oklch(0.2 0.06 255/0.26), 0 2px 12px oklch(0.2 0.06 255/0.12)",
          }}>

          {chapOpen && (
            <ChapterNav slides={slides} current={engine.idx}
              onJump={engine.jumpTo} onClose={() => setChapOpen(false)} />
          )}

          {/* ── Header ── */}
          <div onMouseDown={onMouseDown} onTouchStart={onTouchStart}
            className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none border-b border-[var(--cobalt-100)]"
            style={{ background:"var(--cobalt-50)" }}>
            {/* Provider status dot */}
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${provStatus==="loading"?"ft-pulse":""}`}
              style={{ background: provStatus==="ready" ? (hasVideo?"#22c55e":"var(--cobalt-500)") : provStatus==="error" ? "var(--danger)" : "var(--line-300)" }}
              title={provStatus==="ready" ? (provider?.displayName ?? "") : provStatus==="error" ? provError : "Connecting…"} />
            <span className="text-[12.5px] font-bold flex-1 truncate" style={{ color:"var(--cobalt-700)" }}>
              {provStatus === "loading" ? "Connecting teacher…"
               : provStatus === "error"  ? "AI Teacher (voice only)"
               : hasVideo               ? "AI Human Teacher"
               : "AI Teacher"}
            </span>
            <button onClick={() => setMinimized(m => !m)} title={minimized?"Expand":"Minimise"}
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
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background:"var(--cobalt-100)" }}>
                {hasVideo ? <Wifi size={14} style={{ color:"var(--cobalt-600)" }} />
                          : <Volume2 size={14} style={{ color:"var(--cobalt-600)" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  {(engine.status==="playing"||engine.status==="waiting") &&
                    <div className="w-1.5 h-1.5 rounded-full ft-pulse" style={{ background:"var(--cobalt-500)" }} />}
                  <span className="text-[10.5px] font-semibold" style={{
                    color: engine.status==="playing"||engine.status==="waiting" ? "var(--cobalt-600)"
                      : engine.status==="completed" ? "var(--success)" : "var(--fg-muted)",
                  }}>
                    {engine.status==="playing"?"Teaching…":engine.status==="waiting"?"Waiting…":engine.status==="paused"?"Paused":engine.status==="completed"?"Complete 🎉":"Ready"}
                  </span>
                </div>
                <p className="text-[11px] leading-snug line-clamp-2" style={{ color:"var(--ink-600)" }}>
                  {cur.text.slice(0, 50)}…
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Avatar stage ── */}
              <div className="relative overflow-hidden"
                style={{ background: hasVideo ? "#000" : "radial-gradient(ellipse at 50% 35%, oklch(0.96 0.04 256) 0%, oklch(0.90 0.04 260) 100%)" }}>

                {/* HeyGen video element — always in DOM, visible only when hasVideo */}
                <video
                  ref={videoRef}
                  autoPlay playsInline
                  style={{
                    width:      "100%",
                    height:     hasVideo ? "auto" : 0,
                    minHeight:  hasVideo ? 180 : 0,
                    maxHeight:  240,
                    objectFit:  "cover",
                    display:    "block",
                  }}
                />

                {/* Voice-only stage (shown when no video) */}
                {!hasVideo && (
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background:"var(--cobalt-100)" }}>
                      <Volume2 size={28} style={{ color:"var(--cobalt-500)" }} />
                    </div>
                    <Waveform active={engine.speaking} />
                    {provStatus === "loading" && (
                      <p className="text-[11px] font-semibold ft-pulse" style={{ color:"var(--fg-muted)" }}>
                        Connecting…
                      </p>
                    )}
                    {provStatus === "error" && caps?.video === "none" && (
                      <p className="text-[10.5px] text-center px-4 leading-snug" style={{ color:"var(--fg-muted)" }}>
                        Voice only mode
                      </p>
                    )}
                  </div>
                )}

                {/* Overlay badges */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  {hasVideo && engine.speaking && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background:"oklch(0.2 0 0 / 0.6)", color:"white" }}>
                      🔴 LIVE
                    </span>
                  )}
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: hasVideo ? "oklch(0.2 0 0 / 0.55)" : "var(--cobalt-100)", color: hasVideo ? "white" : "var(--cobalt-700)", fontFamily:"var(--font-mono)" }}>
                    {engine.idx+1}/{slides.length}
                  </span>
                </div>

                {/* Question timeout badge */}
                {engine.status==="waiting" && engine.waitSecs>0 && (
                  <div className="absolute top-2 left-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background:"var(--gold-100)", color:"var(--gold-700)" }}>
                      ⏱ {engine.waitSecs}s
                    </span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-[3px]" style={{ background:"var(--fill-200)" }}>
                <div className="h-full rounded-r-full"
                  style={{ width:`${progress}%`, background:"var(--cobalt-400)", transition:"width 400ms ease" }} />
              </div>

              {/* ── Setup guide (shown when no video provider configured) ── */}
              {caps?.video === "none" && !provError && <ProviderSetupGuide />}

              {/* ── Slide text ── */}
              <div className="px-3.5 py-3 border-b border-[var(--line-200)]" style={{ background:"var(--surface)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1.5"
                  style={{ color: cur.kind==="question"?"var(--gold-700)":"var(--cobalt-500)", fontFamily:"var(--font-mono)" }}>
                  {KIND_ICON[cur.kind]} {cur.kind}
                </p>
                <p className="text-[13px] leading-[1.55]" style={{ color:"var(--ink-800)" }}>
                  {cur.text.length > 200 ? cur.text.slice(0, 197)+"…" : cur.text}
                </p>
              </div>

              {/* ── Question options ── */}
              {cur.kind==="question" && cur.options && (
                <div className="px-3.5 pt-2.5 pb-3 border-b border-[var(--line-200)]" style={{ background:"var(--surface)" }}>
                  <div className="flex flex-col gap-1.5">
                    {cur.options.map((opt, i) => {
                      const isC = i===cur.correct, isP = i===engine.qPicked, done = engine.qPicked!==null;
                      return (
                        <button key={i} onClick={() => engine.pickAnswer(i)} disabled={done}
                          className="w-full text-left px-3 py-2 rounded-[var(--r-md)] border-[1.5px] text-[12px] font-semibold cursor-pointer disabled:cursor-default transition-all duration-150"
                          style={{
                            fontFamily:  "var(--font-mono)",
                            borderColor: done&&isC?"var(--success)":done&&isP&&!isC?"var(--danger)":"var(--line-300)",
                            background:  done&&isC?"var(--success-bg)":done&&isP&&!isC?"var(--danger-bg)":"var(--surface)",
                            color:       done&&isC?"var(--success-tx)":done&&isP&&!isC?"var(--danger-tx)":"var(--ink-900)",
                          }}>
                          <span style={{ opacity:0.45, marginRight:4 }}>{String.fromCharCode(65+i)}.</span>
                          {opt}
                          {done&&isC && <Check size={11} style={{ display:"inline", marginLeft:5, color:"var(--success)" }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Controls ── */}
              <div className="flex items-center gap-1.5 px-3 py-2" style={{ background:"var(--paper-2)" }}>
                <Btn onClick={engine.prev} title="Previous" disabled={engine.idx===0}>
                  <SkipBack size={11} style={{ color:"var(--ink-700)" }} />
                </Btn>

                {engine.status==="completed" ? (
                  <Btn onClick={engine.restart} title="Restart" primary><RotateCcw size={11} color="white" /></Btn>
                ) : engine.status==="playing"||engine.status==="waiting" ? (
                  <Btn onClick={engine.pause} title="Pause" primary><Pause size={11} color="white" /></Btn>
                ) : (
                  <Btn onClick={engine.status==="paused"?engine.resume:engine.start} title="Play" primary><Play size={11} color="white" /></Btn>
                )}

                <Btn onClick={engine.skip} title="Skip" disabled={engine.status==="completed"}>
                  <SkipForward size={11} style={{ color:"var(--ink-700)" }} />
                </Btn>

                <Btn onClick={() => setMuted(m => !m)} title={muted?"Unmute":"Mute"} active={muted}>
                  {muted ? <VolumeX size={11} style={{ color:"var(--fg-muted)" }} />
                         : <Volume2 size={11} style={{ color:"var(--ink-700)" }} />}
                </Btn>

                <span className="flex-1" />

                <button
                  onClick={() => setRate(r => SPEEDS[(SPEEDS.indexOf(r)+1) % SPEEDS.length])}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-[var(--line-300)] cursor-pointer hover:bg-[var(--fill-100)] transition-colors"
                  style={{ fontFamily:"var(--font-mono)", background:"var(--surface)", color:"var(--ink-700)" }}
                  title="Speed">×{rate}
                </button>

                <Btn onClick={() => setChapOpen(o => !o)} title="Chapters" active={chapOpen}>
                  <List size={11} style={{ color: chapOpen?"var(--cobalt-600)":"var(--ink-700)" }} />
                </Btn>

                {/* Provider status icon */}
                <div title={provStatus==="ready" ? provider?.displayName : provStatus==="error" ? provError : "Connecting…"}>
                  {provStatus==="ready" && hasVideo
                    ? <Wifi  size={12} style={{ color:"#22c55e" }} />
                    : provStatus==="error"
                    ? <WifiOff size={12} style={{ color:"var(--danger)" }} />
                    : <Wifi  size={12} style={{ color:"var(--fg-muted)" }} className="ft-pulse" />}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
