// Timezone helpers for the SEO Agent. Pure + client-safe.
//
// Convention: timestamps are stored in UTC (timestamptz) and shown in the
// configured timezone (default Asia/Kolkata). Uses Intl only — no tz library.

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** True if `tz` is an IANA zone this runtime understands. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Wall-clock parts of `date` as seen in `tz`. */
export function getZonedParts(date: Date, tz: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Offset of `tz` from UTC at instant `date`, in milliseconds (IST → +19800000). */
function tzOffsetMs(date: Date, tz: string): number {
  const p = getZonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Converts a wall-clock date + time in `tz` to the UTC instant.
 * @param date "YYYY-MM-DD"
 * @param time "HH:MM" (24h)
 */
export function zonedTimeToUtc(date: string, time: string, tz: string = DEFAULT_TIMEZONE): Date {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dm || !tm) throw new Error(`Invalid date/time: "${date}" "${time}"`);
  const naiveUtc = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2], tm[3] ? +tm[3] : 0);
  // Two passes so instants near a DST transition resolve to the right offset.
  let result = naiveUtc - tzOffsetMs(new Date(naiveUtc), tz);
  result = naiveUtc - tzOffsetMs(new Date(result), tz);
  return new Date(result);
}

/** "YYYY-MM-DD" of `date` in `tz`. */
export function zonedDateString(date: Date, tz: string = DEFAULT_TIMEZONE): string {
  const p = getZonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Adds whole calendar days to a "YYYY-MM-DD" string. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** UTC [start, end) bounds of the calendar day `offsetDays` from today in `tz`. */
export function zonedDayRange(now: Date, tz: string = DEFAULT_TIMEZONE, offsetDays = 0): { date: string; start: Date; end: Date } {
  const date = addDays(zonedDateString(now, tz), offsetDays);
  return {
    date,
    start: zonedTimeToUtc(date, "00:00", tz),
    end: zonedTimeToUtc(addDays(date, 1), "00:00", tz),
  };
}

/** UTC [start, end) of the calendar month containing `now` in `tz`. */
export function zonedMonthRange(now: Date, tz: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const p = getZonedParts(now, tz);
  const first = `${p.year}-${String(p.month).padStart(2, "0")}-01`;
  const nextYear = p.month === 12 ? p.year + 1 : p.year;
  const nextMonth = p.month === 12 ? 1 : p.month + 1;
  const next = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start: zonedTimeToUtc(first, "00:00", tz), end: zonedTimeToUtc(next, "00:00", tz) };
}

/** Human display, e.g. "8 Oct 2026, 10:00 am IST". */
export function formatZoned(iso: string | Date, tz: string = DEFAULT_TIMEZONE, opts: { dateOnly?: boolean } = {}): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    day: "numeric", month: "short", year: "numeric",
    ...(opts.dateOnly ? {} : { hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
  }).format(date);
}
