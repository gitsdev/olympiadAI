import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressTone = "brand" | "gold" | "green";

const TONE_COLOR: Record<ProgressTone, string> = {
  brand: "var(--cobalt-500)",
  gold:  "var(--gold-400)",
  green: "var(--success)",
};

interface OAProgressBarProps {
  value: number;           // 0–100
  tone?: ProgressTone;
  height?: number;
  className?: string;
}

function OAProgressBar({ value, tone = "brand", height = 7, className }: OAProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full", className)}
      style={{ height, background: "var(--fill-200)" }}
    >
      <div
        style={{
          height: "100%",
          width: `${clamped}%`,
          background: TONE_COLOR[tone],
          borderRadius: 999,
          transition: "width 600ms var(--ease-out)",
        }}
      />
    </div>
  );
}

export { OAProgressBar };
export type { ProgressTone };
