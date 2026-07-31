"use client";

/* ═══════════════════════════════════════════════════════════
   TeacherWidget
   Floating, draggable, resizable panel that hosts TeacherScene
   and orchestrates SpeechController + LessonBridge.
   ═══════════════════════════════════════════════════════════ */

import dynamic from "next/dynamic";
import {
  useRef, useState, useCallback, useEffect,
  forwardRef, useImperativeHandle,
} from "react";
import { SpeechController }        from "./SpeechController";
import { LessonBridge }            from "./LessonBridge";
import type { TeacherSceneHandle } from "./TeacherScene";
import type {
  Slide, TeacherGender, TeacherCommand, GestureName, ExpressionName,
} from "./types";

/* Lazy-load scene (no SSR — uses WebGL) */
const TeacherScene = dynamic(() => import("./TeacherScene"), { ssr: false });

/* ── Public handle ── */
export interface TeacherWidgetHandle {
  dispatch(cmd: TeacherCommand): void;
  processSlide(slide: Slide):    void;
  celebrate():                   void;
  stop():                        void;
}

/* ── Sizes ── */
const SIZES = {
  pip:    { w: 180, h: 200 },
  normal: { w: 300, h: 340 },
  large:  { w: 420, h: 480 },
} as const;
type SizeKey = keyof typeof SIZES;

interface Props {
  gender?:       TeacherGender;
  defaultSize?:  SizeKey;
  defaultPos?:   { x: number; y: number };
  onMinimize?:   () => void;
}

const TeacherWidget = forwardRef<TeacherWidgetHandle, Props>(
  (
    {
      gender      = "female",
      defaultSize = "normal",
      defaultPos  = { x: 16, y: 80 },
      onMinimize,
    },
    ref,
  ) => {
    const sceneRef    = useRef<TeacherSceneHandle>(null);
    const speechRef   = useRef<SpeechController | null>(null);
    const bridgeRef   = useRef(new LessonBridge());

    const [sizeKey,     setSizeKey]     = useState<SizeKey>(defaultSize);
    const [minimized,   setMinimized]   = useState(false);
    const [pos,         setPos]         = useState(defaultPos);
    const [speaking,    setSpeaking]    = useState(false);

    const dragRef   = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);

    /* ── Init speech controller once on mount ── */
    useEffect(() => {
      const sc = new SpeechController({
        onStart: () => {
          setSpeaking(true);
          sceneRef.current?.setSpeaking(true);
          sceneRef.current?.playGesture("one_hand");
        },
        onEnd: () => {
          setSpeaking(false);
          sceneRef.current?.setSpeaking(false);
          sceneRef.current?.idle();
        },
        onViseme: (vis, w) => sceneRef.current?.setViseme(vis, w),
      });
      speechRef.current = sc;
      return () => sc.destroy();
    }, []);

    /* ── Dispatch a single TeacherCommand ── */
    const dispatch = useCallback((cmd: TeacherCommand) => {
      const sc  = speechRef.current;
      const sc3 = sceneRef.current;
      switch (cmd.type) {
        case "speak":
          sc?.speak(cmd.text);
          break;
        case "gesture":
          sc3?.playGesture(cmd.name as GestureName);
          break;
        case "express":
          sc3?.setExpression(cmd.emotion as ExpressionName);
          break;
        case "idle":
          sc?.stop();
          sc3?.idle();
          break;
        case "think":
          sc3?.playGesture("hand_chin");
          sc3?.setExpression("thinking");
          break;
        case "celebrate":
          sc3?.playGesture("clap");
          sc3?.setExpression("happy");
          break;
      }
    }, []);

    /* ── Expose imperative handle ── */
    useImperativeHandle(ref, () => ({
      dispatch,
      processSlide(slide) { bridgeRef.current.processSlide(slide, dispatch); },
      celebrate()         { bridgeRef.current.celebrate(dispatch); },
      stop()              { speechRef.current?.stop(); sceneRef.current?.idle(); bridgeRef.current.flush(); },
    }), [dispatch]);

    /* ── Dragging ── */
    const onPointerDown = useCallback((e: React.PointerEvent) => {
      if ((e.target as HTMLElement).dataset.nodrag) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
    }, [pos]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const { ox, oy, px, py } = dragRef.current;
      setPos({ x: px + e.clientX - ox, y: py + e.clientY - oy });
    }, []);

    const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

    /* ── Keyboard shortcut T to toggle minimise ── */
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const tag = (document.activeElement as HTMLElement)?.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA") return;
          setMinimized(p => !p);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    const size       = SIZES[sizeKey];
    const panelStyle: React.CSSProperties = {
      position:  "fixed",
      left:      pos.x,
      top:       pos.y,
      zIndex:    9999,
      userSelect:"none",
      transition: dragRef.current ? "none" : "box-shadow 0.2s",
      borderRadius: 16,
      overflow:  "hidden",
      boxShadow: "0 8px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
      background: "var(--surface-1, #1e1e2e)",
    };

    /* Title bar */
    const barStyle: React.CSSProperties = {
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      padding:        "6px 10px",
      background:     "var(--cobalt-700, #3730a3)",
      color:          "#fff",
      fontSize:       12,
      fontWeight:     600,
      cursor:         "grab",
      gap:            6,
    };

    const btnStyle: React.CSSProperties = {
      background: "rgba(255,255,255,0.15)",
      border:     "none",
      color:      "#fff",
      borderRadius: 6,
      padding:    "2px 8px",
      cursor:     "pointer",
      fontSize:   11,
    };

    return (
      <div
        style={panelStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Title bar */}
        <div style={barStyle}>
          <span style={{ pointerEvents: "none" }}>
            {speaking ? "🗣 Teaching…" : "🧑‍🏫 AI Teacher"}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {/* Size toggle */}
            {(["pip", "normal", "large"] as SizeKey[]).map(k => (
              <button
                key={k}
                data-nodrag="1"
                style={{ ...btnStyle, fontWeight: sizeKey === k ? 700 : 400 }}
                onClick={() => { setSizeKey(k); }}
                title={k}
              >
                {k === "pip" ? "▪" : k === "normal" ? "◼" : "◾"}
              </button>
            ))}
            <button data-nodrag="1" style={btnStyle} onClick={() => {
              setMinimized(p => !p);
              if (!minimized) onMinimize?.();
            }}>
              {minimized ? "▲" : "▼"}
            </button>
          </div>
        </div>

        {/* 3D scene — hidden (not unmounted) when minimised so audio keeps playing */}
        <div style={{
          width:    size.w,
          height:   minimized ? 0 : size.h,
          overflow: "hidden",
          transition:"height 0.25s ease",
        }}>
          <TeacherScene
            ref={sceneRef}
            gender={gender}
            width={size.w}
            height={size.h}
          />
        </div>
      </div>
    );
  },
);

TeacherWidget.displayName = "TeacherWidget";
export default TeacherWidget;
