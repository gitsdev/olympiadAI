// Backlink prospects, outreach and tracking: types and rules. Pure + client-safe.
// Values mirror the CHECK constraints in 013_seo_agent.sql / 017_seo_backlinks.sql.

import { z } from "zod";

export const OPPORTUNITY_TYPES = [
  "GUEST_CONTRIBUTION", "RESOURCE_PAGE", "EDUCATION_DIRECTORY", "TEACHER_RESOURCE",
  "PARENTING_RESOURCE", "EDUCATIONAL_COLLABORATION", "EXPERT_CONTRIBUTION", "BROKEN_LINK", "OTHER",
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const BACKLINK_STATUSES = ["PROSPECT", "CONTACTED", "RESPONDED", "ACCEPTED", "PUBLISHED", "ACTIVE", "LOST", "REJECTED"] as const;
export type BacklinkStatus = (typeof BACKLINK_STATUSES)[number];

export const SPAM_RISKS = ["LOW", "MEDIUM", "HIGH", "DATA_UNAVAILABLE"] as const;
export type SpamRisk = (typeof SPAM_RISKS)[number];

/** The marker the spec requires when no reliable data exists (§27). */
export const DATA_UNAVAILABLE = "DATA_UNAVAILABLE" as const;

const httpUrl = z.string().trim().max(2000).refine((v) => /^https?:\/\/[^\s]+$/i.test(v), "Use a full http(s):// URL");
const optText = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();

export const prospectInputSchema = z.object({
  url: httpUrl,
  website: optText(200),
  topic: optText(200),
  opportunityType: z.enum(OPPORTUNITY_TYPES).default("OTHER"),
  contactName: optText(120),
  contactEmail: z.string().trim().max(200).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Not a valid email").transform((v) => v || null).nullable().optional(),
  contactUrl: z.string().trim().max(2000).refine((v) => v === "" || /^https?:\/\//i.test(v), "Use a full http(s):// URL").transform((v) => v || null).nullable().optional(),
  status: z.enum(BACKLINK_STATUSES).default("PROSPECT"),
  notes: optText(4000),
});
export type ProspectInput = z.infer<typeof prospectInputSchema>;

/** Website name from a URL when the admin didn't give one, e.g. "www.example.org" → "example.org". */
export function websiteFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const backlinkInputSchema = z.object({
  sourceUrl: httpUrl,
  targetUrl: httpUrl,
  anchorText: optText(300),
  status: z.enum(BACKLINK_STATUSES).default("PUBLISHED"),
  notes: optText(4000),
});
export type BacklinkInput = z.infer<typeof backlinkInputSchema>;

/** The result of fetching a source page and looking for our link. */
export interface LinkCheckResult {
  found: boolean;
  anchorText: string | null;
  rel: string[];
  followed: boolean | null;
  httpStatus: number | null;
  error: string | null;
  checkedUrl: string;
  checkedAt: string;
}

/**
 * Tracker status after a check: found → ACTIVE; missing (or the page is
 * gone) after being live → LOST; not live yet → unchanged. A fetch error
 * on a live link doesn't flip it to LOST (it may be a temporary outage).
 */
export function nextBacklinkStatus(prev: BacklinkStatus, check: Pick<LinkCheckResult, "found" | "error" | "httpStatus">): BacklinkStatus {
  if (check.found) return "ACTIVE";
  const wasLive = prev === "ACTIVE" || prev === "PUBLISHED";
  const pageGone = check.httpStatus === 404 || check.httpStatus === 410;
  if (wasLive && (!check.error || pageGone)) return "LOST";
  return prev;
}
