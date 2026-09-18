import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  Icon?: React.ElementType;
  tone?: "default" | "warning" | "danger";
  className?: string;
}

const TONE_BG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "var(--cobalt-50)",
  warning: "var(--gold-50)",
  danger: "oklch(0.96 0.03 25)",
};
const TONE_FG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "var(--cobalt-600)",
  warning: "oklch(0.55 0.15 70)",
  danger: "oklch(0.55 0.18 25)",
};

export function StatCard({ label, value, hint, Icon, tone = "default", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--r-lg)] border p-4 lg:p-5 flex flex-col gap-2 min-w-0",
        className
      )}
      style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium truncate" style={{ color: "var(--fg-muted)" }}>{label}</span>
        {Icon && (
          <span
            className="w-7 h-7 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
            style={{ background: TONE_BG[tone] }}
          >
            <Icon size={15} style={{ color: TONE_FG[tone] }} />
          </span>
        )}
      </div>
      <span
        className="font-black tracking-tight truncate"
        style={{ fontFamily: "var(--font-display)", fontSize: "26px", color: "var(--ink-900)" }}
      >
        {value}
      </span>
      {hint && <span className="text-[11.5px] truncate" style={{ color: "var(--fg-subtle)" }}>{hint}</span>}
    </div>
  );
}
