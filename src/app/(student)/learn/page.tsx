"use client";

import Link from "next/link";
import { Route, Lightbulb, ArrowRight, Check } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OABadge, OACard, OASubjectDot } from "@/components/ui";


const NODES = [
  { id: "int",   x: 90,  y: 250, label: "Integers",       st: "mastered", m: 96 },
  { id: "frac",  x: 230, y: 150, label: "Fractions",      st: "mastered", m: 94 },
  { id: "rat",   x: 230, y: 350, label: "Rational nos.",  st: "mastered", m: 88 },
  { id: "dec",   x: 390, y: 240, label: "Decimals",       st: "active",   m: 71 },
  { id: "pct",   x: 545, y: 150, label: "Percentages",    st: "active",   m: 58 },
  { id: "ratio", x: 545, y: 330, label: "Ratio & Prop.",  st: "weak",     m: 44 },
  { id: "pl",    x: 700, y: 240, label: "Profit & Loss",  st: "locked",   m: 0  },
] as const;

type NodeState = "mastered" | "active" | "weak" | "locked";

const ST: Record<NodeState, { fill: string; ring: string; tx: string; label: string }> = {
  mastered: { fill: "var(--success)",     ring: "var(--success-bg)", tx: "#fff",             label: "Mastered" },
  active:   { fill: "var(--cobalt-500)",  ring: "var(--cobalt-100)", tx: "#fff",             label: "In progress" },
  weak:     { fill: "var(--gold-400)",    ring: "var(--gold-100)",   tx: "var(--ink-900)",   label: "Needs work" },
  locked:   { fill: "var(--fill-200)",    ring: "transparent",       tx: "var(--fg-subtle)", label: "Locked" },
};

const EDGES: [string, string][] = [
  ["int","frac"],["int","rat"],["frac","dec"],["rat","dec"],
  ["dec","pct"],["dec","ratio"],["pct","pl"],["ratio","pl"],
];

const PATH_STEPS = ["Fractions", "Decimals", "Percentages", "Ratio & Proportion", "Profit & Loss"];

const pos = Object.fromEntries(NODES.map((n) => [n.id, n]));

export default function LearnPage() {
  return (
    <AppShell title="Learning paths" subtitle="Your curriculum knowledge graph">
      <div className="px-7 py-6 pb-10">
        <div className="grid grid-cols-[1fr_300px] gap-5 items-start">
          {/* Knowledge graph */}
          <OACard noPadding className="overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--line-200)]">
              <OABadge tone="cobalt" className="gap-1.5">
                <OASubjectDot subject="Mathematics" size={8} /> Mathematics
              </OABadge>
              <span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Number System · Class 7</span>
              <span className="flex-1" />
              <div className="flex gap-3.5">
                {(Object.entries(ST) as [NodeState, typeof ST[NodeState]][]).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--fg-muted)" }}>
                    <span
                      className="w-[9px] h-[9px] rounded-full"
                      style={{
                        background: v.fill,
                        border: k === "locked" ? "1px solid var(--line-300)" : "none",
                      }}
                    />
                    {v.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative graph-bg" style={{ background: "var(--paper-2)", backgroundSize: "24px 24px" }}>
              <svg viewBox="0 0 790 480" className="w-full block">
                {EDGES.map(([a, b], i) => {
                  const A = pos[a], B = pos[b];
                  const done = A.st === "mastered" && (B.st === "mastered" || B.st === "active");
                  return (
                    <line
                      key={i}
                      x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                      stroke={done ? "var(--cobalt-400)" : "var(--line-300)"}
                      strokeWidth={done ? 2.5 : 2}
                      strokeDasharray={B.st === "locked" ? "5 6" : undefined}
                      strokeLinecap="round"
                      opacity={done ? 0.7 : 0.6}
                    />
                  );
                })}
                {NODES.map((n) => {
                  const s = ST[n.st as NodeState];
                  return (
                    <g key={n.id} style={{ cursor: "pointer" }}>
                      <circle cx={n.x} cy={n.y} r={30} fill={s.ring} opacity={n.st === "locked" ? 0 : 0.5} />
                      <circle
                        cx={n.x} cy={n.y} r={21} fill={s.fill} stroke="#fff" strokeWidth={2.5}
                        style={{ filter: "drop-shadow(0 2px 5px oklch(0.3 0.04 264 / 0.18))" }}
                      />
                      {n.st === "mastered" && (
                        <path d={`M${n.x - 8} ${n.y} l5 5 l9 -10`} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      )}
                      {(n.st === "active" || n.st === "weak") && (
                        <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={s.tx} fontFamily="var(--font-mono)">{n.m}</text>
                      )}
                      {n.st === "locked" && (
                        <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="central" fontSize={15} fill="var(--fg-subtle)" fontFamily="var(--font-mono)">·</text>
                      )}
                      <text x={n.x} y={n.y + 42} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink-900)" fontFamily="var(--font-sans)">{n.label}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </OACard>

          {/* Right panel */}
          <div className="flex flex-col gap-5">
            {/* Active path */}
            <OACard style={{ padding: "18px 20px" }}>
              <div className="flex items-center gap-2 mb-1">
                <Route size={18} style={{ color: "var(--brand)" }} />
                <h3 className="font-bold text-[17px]" style={{ fontFamily: "var(--font-display)" }}>Your active path</h3>
              </div>
              <p className="text-[13px] mb-4" style={{ color: "var(--fg-muted)" }}>Number System mastery · 64% complete</p>

              <div className="flex flex-col gap-0.5">
                {PATH_STEPS.map((step, i) => {
                  const state = i < 1 ? "done" : i < 3 ? "now" : "next";
                  return (
                    <div key={step} className="flex items-center gap-2.5">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center"
                          style={{
                            background: state === "done" ? "var(--success)" : state === "now" ? "var(--cobalt-500)" : "var(--fill-200)",
                            border: state === "next" ? "2px solid var(--line-300)" : "none",
                          }}
                        >
                          {state === "done" && <Check size={13} color="#fff" strokeWidth={2.5} />}
                          {state === "now" && <span className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        {i < PATH_STEPS.length - 1 && (
                          <div className="w-0.5 h-[22px]" style={{ background: state === "done" ? "var(--success)" : "var(--line-300)" }} />
                        )}
                      </div>
                      <span
                        className="text-[14px] pb-[22px]"
                        style={{
                          fontWeight: state === "now" ? 600 : 500,
                          color: state === "next" ? "var(--fg-muted)" : "var(--ink-900)",
                          paddingBottom: i < PATH_STEPS.length - 1 ? 22 : 0,
                        }}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>

              <Link href="/practice">
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 rounded-[var(--r-md)] text-[14px] font-semibold text-white border-none cursor-pointer"
                  style={{ background: "var(--cobalt-500)", boxShadow: "var(--shadow-brand)" }}
                >
                  Continue path <ArrowRight size={16} />
                </button>
              </Link>
            </OACard>

            {/* Suggested unlock */}
            <OACard style={{ padding: "16px 18px", background: "var(--gold-50)", border: "1px solid var(--gold-100)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb size={17} style={{ color: "var(--gold-700)" }} />
                <span className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
                  Suggested unlock
                </span>
              </div>
              <p className="text-[13px] leading-[1.5]" style={{ color: "var(--ink-700)" }}>
                Master <b>Ratio &amp; Proportion</b> (44%) to unlock <b>Profit &amp; Loss</b> and finish the path.
              </p>
            </OACard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
