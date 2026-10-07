// Scheduling rules for the cron jobs. Pure, so they're unit-tested.

import type { Frequency, PublishingMode } from "../constants";
import { getZonedParts } from "../datetime";
import type { PublishValidation } from "../publishing/rules";

/** DAILY runs every day; WEEKLY only on Mondays (in the configured timezone); OFF never. */
export function isRunDay(frequency: Frequency, now: Date, tz: string): boolean {
  if (frequency === "OFF") return false;
  if (frequency === "DAILY") return true;
  const p = getZonedParts(now, tz);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() === 1;
}

/**
 * Where a freshly generated article goes (spec §20, §21):
 * manual mode → REVIEW (waits for a human); auto-publish → SCHEDULED only
 * if every publishing check passes, otherwise REVIEW_REQUIRED.
 */
export function nextStatusAfterGeneration(mode: PublishingMode, validation: PublishValidation | null):
  { status: "REVIEW" | "SCHEDULED" | "REVIEW_REQUIRED"; reason: string } {
  if (mode === "MANUAL_APPROVAL") return { status: "REVIEW", reason: "Waiting for your review and approval." };
  if (!validation) return { status: "REVIEW_REQUIRED", reason: "Publishing checks couldn't run." };
  if (validation.errors.length) {
    return { status: "REVIEW_REQUIRED", reason: `Auto-publish blocked: ${validation.errors.map((e) => e.message).join(" ")}` };
  }
  return { status: "SCHEDULED", reason: "Every check passed; scheduled to auto-publish." };
}

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Highest priority first, then oldest first. */
export function pickKeywords<T extends { priority: string; created_at: string }>(rows: T[], max: number): T[] {
  return [...rows]
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || a.created_at.localeCompare(b.created_at))
    .slice(0, max);
}

/** Time budget for one cron invocation (Vercel limit is 300 s on every plan). */
export const CRON_BUDGET_MS = 280_000;
/** Don't start the SEO check / link suggestions after this much of the budget is used. */
export const SEO_CHECK_CUTOFF_MS = 190_000;
export const LINKS_CUTOFF_MS = 240_000;
