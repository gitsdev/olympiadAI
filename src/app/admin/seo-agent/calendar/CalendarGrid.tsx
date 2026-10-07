"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { reschedulePlan } from "@/actions/seo-agent/content";
import { STATUS_TONES, humanizeStatus } from "@/lib/seo-agent/constants";
import { DELETABLE_PLAN_STATUSES, type CalendarDay } from "@/lib/seo-agent/content-plans";
import type { PlanSummary } from "@/lib/seo-agent/content-data";
import { cn } from "@/lib/utils";

const TONE_STYLE: Record<string, { bg: string; fg: string }> = {
  cobalt: { bg: "var(--cobalt-50)", fg: "var(--cobalt-700)" },
  green: { bg: "var(--success-bg)", fg: "var(--success-tx)" },
  amber: { bg: "var(--warning-bg)", fg: "var(--warning-tx)" },
  red: { bg: "var(--danger-bg)", fg: "var(--danger-tx)" },
  gold: { bg: "var(--gold-100)", fg: "var(--gold-700)" },
  neutral: { bg: "var(--fill-100)", fg: "var(--ink-700)" },
};

interface Props {
  weeks: CalendarDay[][];
  /** Plans keyed by YYYY-MM-DD (in the configured timezone). */
  plansByDate: Record<string, (PlanSummary & { time: string })[]>;
  today: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarGrid({ weeks, plansByDate, today }: Props) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function drop(date: string) {
    const id = dragId;
    setDragId(null);
    setOverDate(null);
    if (!id || date < today) return;
    setBusy(true);
    setError(null);
    const res = await reschedulePlan(id, date);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  const chip = (p: PlanSummary & { time: string }) => {
    const tone = TONE_STYLE[STATUS_TONES[p.status] ?? "neutral"];
    const movable = DELETABLE_PLAN_STATUSES.includes(p.status);
    return (
      <Link
        key={p.id}
        href={`/admin/seo-agent/calendar/${p.id}`}
        draggable={movable}
        onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={() => { setDragId(null); setOverDate(null); }}
        title={`${p.title}\n${p.time} · ${humanizeStatus(p.status)}${movable ? "\nDrag to another day to reschedule" : ""}`}
        className={cn("block rounded-[var(--r-sm)] px-1.5 py-1 text-[11.5px] leading-tight", movable && "cursor-grab active:cursor-grabbing")}
        style={{ background: tone.bg, color: tone.fg }}
      >
        <span className="font-semibold line-clamp-2">{p.title}</span>
        <span className="opacity-80">{p.time} · {humanizeStatus(p.status)}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="flex items-center gap-2 text-[13px] p-2.5 rounded-[var(--r-md)]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
          <TriangleAlert size={15} /> {error}
        </p>
      )}

      {/* Month grid (desktop) */}
      <div className={cn("hidden md:block", busy && "opacity-60 pointer-events-none")} aria-busy={busy}>
        <div className="grid grid-cols-7 text-[11.5px] font-semibold uppercase tracking-wide pb-1.5" style={{ color: "var(--fg-muted)" }}>
          {WEEKDAYS.map((d) => <div key={d} className="px-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 border-t border-l" style={{ borderColor: "var(--line-200)" }}>
          {weeks.flat().map((day) => {
            const past = day.date < today;
            const plans = plansByDate[day.date] ?? [];
            return (
              <div
                key={day.date}
                onDragOver={(e) => { if (dragId && !past) { e.preventDefault(); setOverDate(day.date); } }}
                onDragLeave={() => setOverDate((d) => (d === day.date ? null : d))}
                onDrop={(e) => { e.preventDefault(); drop(day.date); }}
                className="min-h-[104px] border-r border-b p-1.5 flex flex-col gap-1"
                style={{
                  borderColor: "var(--line-200)",
                  background: overDate === day.date ? "var(--cobalt-50)" : day.inMonth ? "var(--surface)" : "var(--paper-2)",
                }}
              >
                <span
                  className={cn("text-[12px] w-6 h-6 flex items-center justify-center rounded-full", day.date === today && "font-bold")}
                  style={{
                    color: day.date === today ? "white" : day.inMonth && !past ? "var(--ink-700)" : "var(--fg-subtle)",
                    background: day.date === today ? "var(--cobalt-500)" : undefined,
                  }}
                >
                  {Number(day.date.slice(8))}
                </span>
                {plans.map(chip)}
              </div>
            );
          })}
        </div>
        <p className="text-[12px] pt-2" style={{ color: "var(--fg-subtle)" }}>Drag a plan to another day to reschedule it. Its publishing time stays the same.</p>
      </div>

      {/* Agenda list (mobile) */}
      <ul className="md:hidden flex flex-col divide-y divide-[var(--line-200)]">
        {weeks.flat().filter((d) => d.inMonth && (plansByDate[d.date]?.length ?? 0) > 0).map((d) => (
          <li key={d.date} className="py-2.5 flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold" style={{ color: d.date === today ? "var(--cobalt-700)" : "var(--ink-700)" }}>
              {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
            </span>
            {plansByDate[d.date].map(chip)}
          </li>
        ))}
        {weeks.flat().every((d) => !d.inMonth || !(plansByDate[d.date]?.length)) && (
          <li className="py-6 text-center text-[13px]" style={{ color: "var(--fg-muted)" }}>Nothing scheduled this month.</li>
        )}
      </ul>
    </div>
  );
}
