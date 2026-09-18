export type DateRangePreset = "today" | "7d" | "30d" | "90d" | "year" | "custom";

export interface ResolvedDateRange {
  preset: DateRangePreset;
  from: Date;
  to: Date;
  label: string;
}

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

/**
 * Resolves the admin dashboard's global date filter from URL search params.
 * `to` is always end-of-day so a "today" filter includes all of today.
 */
export function resolveDateRange(params: {
  range?: string;
  from?: string;
  to?: string;
}): ResolvedDateRange {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const preset = (params.range as DateRangePreset) || "30d";

  if (preset === "custom" && params.from && params.to) {
    const from = new Date(params.from);
    const to = new Date(params.to);
    to.setHours(23, 59, 59, 999);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      return { preset, from, to, label: "Custom Range" };
    }
  }

  switch (preset) {
    case "today":
      return { preset, from: startOfToday, to: endOfToday, label: "Today" };
    case "7d":
      return { preset, from: daysAgo(now, 7), to: endOfToday, label: "Last 7 Days" };
    case "90d":
      return { preset, from: daysAgo(now, 90), to: endOfToday, label: "Last 90 Days" };
    case "year":
      return { preset, from: new Date(now.getFullYear(), 0, 1), to: endOfToday, label: "This Year" };
    case "30d":
    default:
      return { preset: "30d", from: daysAgo(now, 30), to: endOfToday, label: "Last 30 Days" };
  }
}

function daysAgo(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
