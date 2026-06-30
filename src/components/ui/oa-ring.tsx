"use client";

import * as React from "react";

interface OARingProps {
  /** Current value 0–100 */
  value?: number;
  /** Diameter in px */
  size?: number;
  /** Stroke width in px */
  stroke?: number;
  /** Track + fill color (CSS color string) */
  color?: string;
  children?: React.ReactNode;
}

/**
 * Readiness ring — the signature OlympiadAI SVG ring metric.
 * Renders an animated circular progress ring with children centred inside.
 */
function OARing({
  value = 0,
  size = 96,
  stroke = 9,
  color = "var(--gold-400)",
  children,
}: OARingProps) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value / 100);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--fill-200)"
          strokeWidth={stroke}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms var(--ease-out)" }}
        />
      </svg>
      {/* Centred content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export { OARing };
