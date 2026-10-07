// Content plans: validation, scheduling and calendar helpers. Pure + client-safe.

import { z } from "zod";
import { CTA_TYPES, SEARCH_INTENTS } from "./constants";
import { addDays, getZonedParts, zonedDateString, zonedTimeToUtc } from "./datetime";

export const CONTENT_TYPES = ["GUIDE", "QUESTION_PRACTICE", "TIPS_LIST", "EXPLAINER", "SYLLABUS_OVERVIEW", "COMPARISON"] as const;
export const CONTENT_TYPE_LABELS: Record<(typeof CONTENT_TYPES)[number], string> = {
  GUIDE: "Preparation guide",
  QUESTION_PRACTICE: "Practice questions",
  TIPS_LIST: "Tips list",
  EXPLAINER: "Explainer",
  SYLLABUS_OVERVIEW: "Syllabus overview",
  COMPARISON: "Comparison",
};

export const TARGET_AUDIENCES = ["STUDENTS", "PARENTS", "STUDENTS_AND_PARENTS", "TEACHERS"] as const;
export const TARGET_AUDIENCE_LABELS: Record<(typeof TARGET_AUDIENCES)[number], string> = {
  STUDENTS: "Students",
  PARENTS: "Parents",
  STUDENTS_AND_PARENTS: "Students and parents",
  TEACHERS: "Teachers",
};

/** Statuses an admin may set by hand. The rest are set by the workflow (generation, approval, publishing). */
export const MANUAL_PLAN_STATUSES = ["IDEA", "PLANNED", "REJECTED", "ARCHIVED"] as const;
/** Plans in these statuses have no article yet, so they can be deleted. */
export const DELETABLE_PLAN_STATUSES: readonly string[] = ["IDEA", "PLANNED", "REJECTED", "ARCHIVED"];

const text = (max: number) => z.string().trim().min(1).max(max);

export const outlineSectionSchema = z.object({
  heading: text(160),
  points: z.array(text(300)).max(8),
});
export type OutlineSection = z.infer<typeof outlineSectionSchema>;

export const internalLinkSchema = z.object({
  url: z.string().trim().regex(/^\/[^\s]*$/, "Use a site path starting with /"),
  anchorText: text(120),
  reason: z.string().trim().max(300).default(""),
});
export type PlanInternalLink = z.infer<typeof internalLinkSchema>;

export const planInputSchema = z.object({
  title: text(160),
  primaryKeyword: text(200),
  secondaryKeywords: z.array(text(200)).max(20).default([]),
  searchIntent: z.enum(SEARCH_INTENTS).nullable().default(null),
  contentType: z.enum(CONTENT_TYPES).nullable().default(null),
  targetAudience: z.enum(TARGET_AUDIENCES).nullable().default(null),
  outline: z.array(outlineSectionSchema).max(20).default([]),
  recommendedCta: z.enum(CTA_TYPES).nullable().default(null),
  internalLinks: z.array(internalLinkSchema).max(15).default([]),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  plannedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
  status: z.enum(MANUAL_PLAN_STATUSES).default("PLANNED"),
  notes: z.string().trim().max(4000).default(""),
}).refine((p) => p.status !== "PLANNED" || p.plannedDate !== null, {
  message: "A planned article needs a publication date (or set the status to Idea).",
  path: ["plannedDate"],
});
export type PlanInput = z.infer<typeof planInputSchema>;

/** Converts plan input to the seo_content_plans columns it owns. */
export function planInputToRow(p: PlanInput, tz: string, defaultTime: string) {
  return {
    title: p.title,
    primary_keyword: p.primaryKeyword,
    secondary_keywords: p.secondaryKeywords,
    search_intent: p.searchIntent,
    content_type: p.contentType,
    target_audience: p.targetAudience,
    outline: p.outline,
    recommended_cta: p.recommendedCta,
    suggested_internal_links: p.internalLinks,
    planned_publish_at: p.plannedDate ? zonedTimeToUtc(p.plannedDate, p.plannedTime ?? defaultTime, tz).toISOString() : null,
    status: p.status,
    notes: p.notes || null,
  };
}

/**
 * First calendar day from tomorrow (in `tz`) with no plan on it, at the
 * default publishing time. One article per day keeps the cadence steady.
 */
export function nextFreePublishDate(takenDates: Iterable<string>, now: Date, tz: string, defaultTime: string, horizonDays = 365): Date {
  const taken = new Set(takenDates);
  let day = addDays(zonedDateString(now, tz), 1);
  for (let i = 0; i < horizonDays && taken.has(day); i++) day = addDays(day, 1);
  return zonedTimeToUtc(day, defaultTime, tz);
}

/**
 * Moves a plan to `date` (YYYY-MM-DD in tz), keeping its time of day — or the
 * default publishing time if it had none.
 */
export function rescheduleTo(date: string, currentIso: string | null, tz: string, defaultTime: string): Date {
  let time = defaultTime;
  if (currentIso) {
    const p = getZonedParts(new Date(currentIso), tz);
    time = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  }
  return zonedTimeToUtc(date, time, tz);
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
}

/** Monday-first weeks covering `month` ("YYYY-MM"). */
export function buildMonthGrid(month: string): CalendarDay[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(`${month}-01`, -lead);
  const totalCells = Math.ceil((lead + daysInMonth) / 7) * 7;

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < totalCells; i++) {
    const date = addDays(start, i);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({ date, inMonth: date.startsWith(month) });
  }
  return weeks;
}

/** "2026-10" → "2026-11" (delta = +1) or "2026-09" (delta = -1). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonth(s: string | undefined): s is string {
  return Boolean(s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s));
}
