"use client";

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { EmptyState } from "./EmptyState";
import { LineChart as LineChartIcon } from "lucide-react";

interface TrendChartProps {
  data: { x: string; y: number }[];
  formatX?: (x: string) => string;
  formatY?: (y: number) => string;
  variant?: "area" | "bar";
  emptyLabel?: string;
}

function CustomTooltip({ active, payload, label, formatX, formatY }: {
  active?: boolean; label?: string;
  payload?: { value: number }[];
  formatX: (x: string) => string; formatY: (y: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-[var(--r-md)] border px-3 py-2 shadow-sm"
      style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}
    >
      <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--ink-900)" }}>
        {formatY(payload[0].value)}
      </p>
      <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{formatX(label ?? "")}</p>
    </div>
  );
}

export function TrendChart({
  data, formatX = (x) => x, formatY = (y) => String(y), variant = "area", emptyLabel = "No data in this period",
}: TrendChartProps) {
  const hasData = data.some((d) => d.y > 0);
  if (!hasData) {
    return <EmptyState Icon={LineChartIcon} title={emptyLabel} />;
  }

  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <ResponsiveContainer width="100%" height={200}>
      {variant === "area" ? (
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="admin-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--cobalt-500)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--cobalt-500)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line-200)" strokeDasharray="0" />
          <XAxis
            dataKey="x" tickFormatter={formatX} tick={{ fontSize: 11, fill: "var(--fg-muted)" }}
            axisLine={{ stroke: "var(--line-200)" }} tickLine={false} minTickGap={24}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ stroke: "var(--line-300)", strokeWidth: 1 }}
            content={<CustomTooltip formatX={formatX} formatY={formatY} />}
          />
          <Area
            type="monotone" dataKey="y" stroke="var(--cobalt-500)" strokeWidth={2}
            fill="url(#admin-trend-fill)" isAnimationActive={!reduceMotion}
            dot={false} activeDot={{ r: 4, fill: "var(--cobalt-500)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      ) : (
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line-200)" />
          <XAxis
            dataKey="x" tickFormatter={formatX} tick={{ fontSize: 11, fill: "var(--fg-muted)" }}
            axisLine={{ stroke: "var(--line-200)" }} tickLine={false} minTickGap={24}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ fill: "var(--fill-100)" }}
            content={<CustomTooltip formatX={formatX} formatY={formatY} />}
          />
          <Bar dataKey="y" fill="var(--cobalt-500)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduceMotion} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
