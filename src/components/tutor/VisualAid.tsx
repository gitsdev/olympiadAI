"use client";

import React, { useState, useEffect } from "react";
import { BarChart2, Eye, EyeOff } from "lucide-react";

export interface VisualSpec {
  type: "fraction" | "number_line" | "percentage" | "geometry" | "bar_chart" | "none";
  data: Record<string, unknown>;
}

/* ── Fraction ──────────────────────────────────────────────────────── */
function FractionVisual({ n, d }: { n: number; d: number }) {
  const safeD = Math.max(2, Math.min(d, 12));
  const safeN = Math.max(0, Math.min(n, safeD));
  const [hov, setHov] = useState<number | null>(null);

  const cx = 65, cy = 65, r = 52;
  const deg = 360 / safeD;

  function polar(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function slicePath(i: number) {
    const s = i * deg, e = (i + 1) * deg;
    const sp = polar(s), ep = polar(e);
    const large = deg > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${sp.x.toFixed(2)} ${sp.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ep.x.toFixed(2)} ${ep.y.toFixed(2)} Z`;
  }

  const decimal = safeN / safeD;
  const decStr = Number.isInteger(decimal)
    ? String(decimal)
    : decimal.toFixed(4).replace(/0+$/, "");
  const hint =
    safeN === 0     ? "Zero — nothing shaded"
    : safeN === safeD ? "One whole — fully shaded"
    : decimal > 0.5  ? "Greater than a half"
    : decimal === 0.5 ? "Exactly one half"
    : "Less than a half";

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 py-1">
      {/* Pie */}
      <svg width={130} height={130} viewBox="0 0 130 130" className="shrink-0">
        {Array.from({ length: safeD }, (_, i) => (
          <path
            key={i}
            d={slicePath(i)}
            fill={i < safeN
              ? hov === i ? "var(--cobalt-600)" : "var(--cobalt-500)"
              : "var(--fill-200)"}
            stroke="white"
            strokeWidth={2}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
            style={{ cursor: "pointer", transition: "fill 100ms" }}
          />
        ))}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-200)" strokeWidth={1} />
      </svg>

      {/* Detail panel */}
      <div className="flex flex-col gap-2.5 min-w-[130px]">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.06em] font-semibold mb-1.5" style={{ color: "var(--fg-muted)" }}>
            Fraction bar
          </p>
          <div className="flex rounded-[3px] overflow-hidden border border-[var(--line-300)]" style={{ height: 26 }}>
            {Array.from({ length: safeD }, (_, i) => (
              <div
                key={i}
                className="flex-1"
                style={{
                  background: i < safeN ? "var(--cobalt-500)" : "var(--fill-100)",
                  borderRight: i < safeD - 1 ? "1px solid white" : "none",
                  transition: "background 100ms",
                }}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
              />
            ))}
          </div>
          <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
            {safeN} of {safeD} parts shaded
          </p>
        </div>
        <div className="px-3 py-2 rounded-[var(--r-md)]" style={{ background: "var(--fill-100)" }}>
          <p className="font-semibold text-[12.5px]" style={{ color: "var(--ink-700)" }}>
            <span style={{ fontFamily: "var(--font-mono)" }}>{safeN}/{safeD}</span>
            {" = "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--cobalt-600)" }}>{decStr}</span>
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--fg-muted)" }}>{hint}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Number line ───────────────────────────────────────────────────── */
function NumberLineVisual({ min = 0, max = 1, points = [] }: {
  min: number;
  max: number;
  points: { value: number; label: string; highlight?: boolean }[];
}) {
  const W = 280, PAD = 32;
  const span = max - min || 1;
  const xOf  = (v: number) => PAD + ((v - min) / span) * (W - 2 * PAD);

  const ticks: number[] = [];
  for (let t = Math.ceil(min); t <= Math.floor(max); t++) ticks.push(t);

  return (
    <svg width="100%" viewBox={`0 0 ${W} 90`} className="block" style={{ maxWidth: W }}>
      {/* Axis */}
      <line x1={PAD - 6} y1={55} x2={W - PAD + 6} y2={55} stroke="var(--ink-700)" strokeWidth={2} strokeLinecap="round" />
      <path d={`M ${W - PAD + 6} 55 l -7 -4 l 0 8 Z`} fill="var(--ink-700)" />
      {/* Integer ticks */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={xOf(t)} y1={49} x2={xOf(t)} y2={61} stroke="var(--ink-500)" strokeWidth={1.5} />
          <text x={xOf(t)} y={74} textAnchor="middle" fontSize={12} fontFamily="var(--font-mono)" fill="var(--ink-700)">{t}</text>
        </g>
      ))}
      {/* Highlighted points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={xOf(p.value)} cy={55} r={7}
            fill={p.highlight ? "var(--cobalt-500)" : "var(--gold-400)"}
            stroke="white" strokeWidth={2}
          />
          <text
            x={xOf(p.value)} y={36} textAnchor="middle" fontSize={11}
            fontFamily="var(--font-mono)"
            fill={p.highlight ? "var(--cobalt-700)" : "var(--gold-700)"}
            fontWeight={600}
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── Percentage bar ────────────────────────────────────────────────── */
function PercentageVisual({ value, label }: { value: number; label?: string }) {
  const [filled, setFilled] = useState(0);
  const safe = Math.max(0, Math.min(100, value));
  const color = safe >= 75 ? "var(--success)" : safe >= 50 ? "var(--cobalt-500)" : "var(--gold-500)";

  useEffect(() => {
    const t = setTimeout(() => setFilled(safe), 80);
    return () => clearTimeout(t);
  }, [safe]);

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex items-baseline justify-between gap-3">
        {label && (
          <span className="text-[13px] font-semibold leading-snug flex-1" style={{ color: "var(--ink-700)" }}>
            {label}
          </span>
        )}
        <span className="font-bold text-[28px] shrink-0" style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.03em", color }}>
          {safe}%
        </span>
      </div>
      <div className="relative h-[30px] rounded-full overflow-hidden" style={{ background: "var(--fill-200)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${filled}%`,
            background: color,
            transition: "width 700ms cubic-bezier(0.34,1.2,0.64,1)",
            minWidth: safe > 0 ? 8 : 0,
          }}
        />
        <div className="absolute inset-0 flex items-center px-4">
          <span
            className="text-[12px] font-bold"
            style={{ color: safe > 28 ? "white" : "var(--ink-700)", fontFamily: "var(--font-mono)" }}
          >
            {safe} / 100
          </span>
        </div>
      </div>
      <div className="flex text-[11px]" style={{ color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
        <span>0%</span>
        <span className="flex-1 text-center" style={{ color }}>▲ {safe}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

/* ── Geometry ──────────────────────────────────────────────────────── */
function GeometryVisual({ shape, dims }: {
  shape: "triangle" | "circle" | "rectangle" | "square";
  dims: Record<string, number>;
}) {
  const W = 220, H = 155;

  if (shape === "circle") {
    const r = 55, cx = W / 2, cy = H / 2 - 5;
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <circle cx={cx} cy={cy} r={r} fill="var(--cobalt-50)" stroke="var(--cobalt-400)" strokeWidth={2} />
        <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="var(--cobalt-600)" strokeWidth={2} strokeDasharray="5 4" />
        <circle cx={cx} cy={cy} r={3.5} fill="var(--cobalt-600)" />
        <text x={cx + r / 2} y={cy - 8} textAnchor="middle" fontSize={12} fontFamily="var(--font-mono)" fill="var(--cobalt-700)" fontWeight={700}>
          r = {dims.radius ?? "r"}
        </text>
        <text x={cx} y={cy + r + 20} textAnchor="middle" fontSize={11} fill="var(--fg-muted)" fontFamily="var(--font-mono)">
          Area = πr²  ·  Circumference = 2πr
        </text>
      </svg>
    );
  }

  if (shape === "triangle") {
    const b  = dims.base   ?? dims.b ?? 6;
    const h  = dims.height ?? dims.h ?? 4;
    const pts = `${W / 2},16 ${W - 18},${H - 26} 18,${H - 26}`;
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <polygon points={pts} fill="var(--cobalt-50)" stroke="var(--cobalt-400)" strokeWidth={2} />
        <line x1={W / 2} y1={16} x2={W / 2} y2={H - 26} stroke="var(--gold-500)" strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={W / 2 + 9} y={(16 + H - 26) / 2} fontSize={11.5} fontFamily="var(--font-mono)" fill="var(--gold-700)" fontWeight={700}>
          h = {h}
        </text>
        <text x={W / 2} y={H - 9} textAnchor="middle" fontSize={12} fontFamily="var(--font-mono)" fill="var(--cobalt-700)" fontWeight={700}>
          b = {b}
        </text>
        <text x={W / 2} y={H + 5} textAnchor="middle" fontSize={11} fill="var(--fg-muted)" fontFamily="var(--font-mono)">
          Area = ½ × {b} × {h} = {(0.5 * Number(b) * Number(h)).toFixed(1).replace(/\.0$/, "")} sq. units
        </text>
      </svg>
    );
  }

  // Rectangle or square
  const w     = dims.width  ?? dims.w ?? dims.side ?? 6;
  const h     = dims.height ?? dims.h ?? (shape === "square" ? w : 4);
  const ratio = Math.min(Number(w), Number(h)) / Math.max(Number(w), Number(h));
  const RW    = 160;
  const RH    = Math.max(40, Math.round(RW * ratio * 0.55));
  const rx    = (W - RW) / 2;
  const ry    = (H - RH) / 2 - 12;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      <rect x={rx} y={ry} width={RW} height={RH} fill="var(--cobalt-50)" stroke="var(--cobalt-400)" strokeWidth={2} rx={2} />
      <text x={W / 2} y={ry - 7} textAnchor="middle" fontSize={12} fontFamily="var(--font-mono)" fill="var(--cobalt-700)" fontWeight={700}>
        {w} units
      </text>
      <text x={rx - 6} y={ry + RH / 2} textAnchor="end" dominantBaseline="central" fontSize={12} fontFamily="var(--font-mono)" fill="var(--gold-700)" fontWeight={700}>
        {h}
      </text>
      <text x={W / 2} y={ry + RH + 20} textAnchor="middle" fontSize={11} fill="var(--fg-muted)" fontFamily="var(--font-mono)">
        Area = {w} × {h} = {Number(w) * Number(h)} sq. units
      </text>
    </svg>
  );
}

/* ── Bar chart ─────────────────────────────────────────────────────── */
function BarChartVisual({ bars }: { bars: { label: string; value: number; color?: string }[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 60); return () => clearTimeout(t); }, []);

  const max    = Math.max(...bars.map((b) => b.value), 1);
  const COLORS = ["var(--cobalt-500)", "var(--gold-500)", "var(--success)", "oklch(0.6 0.16 290)", "var(--subj-english)"];

  return (
    <div className="flex items-end gap-2.5 pt-2 pb-1" style={{ minHeight: 110 }}>
      {bars.map((b, i) => {
        const pct   = (b.value / max) * 100;
        const color = b.color ?? COLORS[i % COLORS.length];
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <span className="text-[11px] font-bold" style={{ fontFamily: "var(--font-mono)", color }}>{b.value}</span>
            <div
              className="w-full rounded-t-[4px]"
              style={{
                height:     `${ready ? Math.max(pct * 0.85, 4) : 4}px`,
                background: color,
                minHeight:  4,
                transition: "height 600ms cubic-bezier(0.34,1.2,0.64,1)",
              }}
            />
            <span className="text-[10px] text-center leading-tight truncate w-full" style={{ color: "var(--fg-muted)" }}>
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Dispatcher ────────────────────────────────────────────────────── */
export function VisualAid({ spec }: { spec: VisualSpec }) {
  const [visible, setVisible] = useState(true);
  if (spec.type === "none") return null;

  const d = spec.data;

  return (
    <div
      className="rounded-[var(--r-lg)] border border-[var(--cobalt-200)] overflow-hidden"
      style={{ background: "var(--cobalt-50)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-[9px] border-b border-[var(--cobalt-200)]">
        <BarChart2 size={13} style={{ color: "var(--brand)" }} />
        <span className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--brand)" }}>
          Visual Aid
        </span>
        <span className="flex-1" />
        <button
          onClick={() => setVisible((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold border-none bg-transparent cursor-pointer"
          style={{ color: "var(--cobalt-600)" }}
        >
          {visible ? <><EyeOff size={11} /> Hide</> : <><Eye size={11} /> Show</>}
        </button>
      </div>

      {visible && (
        <div className="px-4 py-3.5">
          {spec.type === "fraction" && (
            <FractionVisual n={Number(d.n ?? 1)} d={Number(d.d ?? 2)} />
          )}
          {spec.type === "number_line" && (
            <NumberLineVisual
              min={Number(d.min ?? 0)}
              max={Number(d.max ?? 1)}
              points={(d.points as { value: number; label: string; highlight?: boolean }[]) ?? []}
            />
          )}
          {spec.type === "percentage" && (
            <PercentageVisual value={Number(d.value ?? 50)} label={d.label as string | undefined} />
          )}
          {spec.type === "geometry" && (
            <GeometryVisual
              shape={(d.shape as "triangle" | "circle" | "rectangle" | "square") ?? "rectangle"}
              dims={(d.dims as Record<string, number>) ?? {}}
            />
          )}
          {spec.type === "bar_chart" && (
            <BarChartVisual
              bars={(d.bars as { label: string; value: number; color?: string }[]) ?? []}
            />
          )}
        </div>
      )}
    </div>
  );
}
