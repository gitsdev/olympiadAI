// Approval, scheduling and pre-publish validation rules (spec §18, §19, §21, §22).
// Pure + client-safe so the editor can show the same checklist the
// publisher enforces, and so the rules are unit-tested.

import type { PublishingMode } from "../constants";
import { SLUG_PATTERN } from "../articles";
import { zonedTimeToUtc } from "../datetime";

// ── Workflow ─────────────────────────────────────────────────────────────

export type WorkflowAction =
  | "SUBMIT_FOR_REVIEW" | "APPROVE" | "WITHDRAW_APPROVAL" | "SCHEDULE" | "UNSCHEDULE" | "PUBLISH" | "REJECT" | "REOPEN";

/** Article statuses each action may start from. */
export const TRANSITIONS: Record<WorkflowAction, { from: readonly string[]; to: string }> = {
  SUBMIT_FOR_REVIEW: { from: ["DRAFT"], to: "REVIEW" },
  APPROVE: { from: ["DRAFT", "REVIEW", "REVIEW_REQUIRED"], to: "APPROVED" },
  WITHDRAW_APPROVAL: { from: ["APPROVED", "SCHEDULED"], to: "REVIEW" },
  SCHEDULE: { from: ["APPROVED", "SCHEDULED"], to: "SCHEDULED" },
  UNSCHEDULE: { from: ["SCHEDULED"], to: "APPROVED" },
  PUBLISH: { from: ["APPROVED", "SCHEDULED"], to: "PUBLISHED" },
  REJECT: { from: ["DRAFT", "REVIEW", "REVIEW_REQUIRED"], to: "REJECTED" },
  REOPEN: { from: ["REJECTED"], to: "DRAFT" },
};

export function canTransition(status: string, action: WorkflowAction): boolean {
  return TRANSITIONS[action].from.includes(status);
}

/** Plan status that mirrors an article status, so the calendar stays in step. */
export function planStatusFor(articleStatus: string): string | null {
  const map: Record<string, string> = {
    DRAFT: "DRAFT", REVIEW: "REVIEW", REVIEW_REQUIRED: "REVIEW", APPROVED: "APPROVED",
    SCHEDULED: "SCHEDULED", PUBLISHED: "PUBLISHED", REJECTED: "REJECTED",
  };
  return map[articleStatus] ?? null;
}

// ── Scheduling ───────────────────────────────────────────────────────────

/** Earliest allowed schedule: a few minutes ahead, so the next cron run picks it up cleanly. */
export const MIN_SCHEDULE_LEAD_MS = 5 * 60_000;

export function parseSchedule(date: string, time: string, tz: string, now = new Date()): { ok: true; at: Date } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: "Pick a valid date and time." };
  const at = zonedTimeToUtc(date, time, tz);
  if (at.getTime() < now.getTime() + MIN_SCHEDULE_LEAD_MS) return { ok: false, error: "Choose a time at least 5 minutes from now, or use Publish now." };
  if (at.getTime() > now.getTime() + 366 * 24 * 3600_000) return { ok: false, error: "Schedule within the next year." };
  return { ok: true, at };
}

// ── Duplicate content ────────────────────────────────────────────────────

function shingles(text: string, size = 5): Set<string> {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(" "));
  return out;
}

/** Jaccard similarity of 5-word shingles (0–1). ~0.5+ means substantially the same text. */
export function textSimilarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter++;
  return inter / (A.size + B.size - inter);
}

export const DUPLICATE_THRESHOLD = 0.5;

// ── Pre-publish validation ───────────────────────────────────────────────

export interface PublishCandidate {
  status: string;
  title: string;
  slug: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  excerpt: string | null;
  category: string | null;
  wordCount: number;
  ctaCount: number;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  /** Internal links in the body (site paths). */
  internalLinks: string[];
  seo: { score: number; critical: string[]; stale: boolean } | null;
}

export interface PublishContext {
  mode: PublishingMode;
  /** Every public site path that exists. */
  knownPaths: Set<string>;
  /** Blog post (if any) already using this slug, and whether it's this article's own post. */
  slugOwner: { blogPostId: string; isOwnPost: boolean } | null;
  /** Most similar existing blog post. */
  closestExisting: { title: string; slug: string; similarity: number } | null;
  /** Same title already published on another post. */
  titleClash: string | null;
}

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface PublishValidation {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** Every check that must pass before an article goes live. Errors block publishing. */
export function validateForPublish(a: PublishCandidate, ctx: PublishContext): PublishValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (code: string, message: string) => errors.push({ code, message });
  const warn = (code: string, message: string) => warnings.push({ code, message });

  // Authorization (§18): never publish without an approval record in manual mode.
  if (ctx.mode === "MANUAL_APPROVAL" && (!a.approvedAt || !a.approvedBy)) err("NOT_APPROVED", "The article hasn't been approved.");

  // Required fields
  if (a.title.trim().length < 5) err("TITLE", "Title is missing or too short.");
  if (!a.slug || !SLUG_PATTERN.test(a.slug)) err("SLUG", "URL slug is missing or invalid.");
  if (!a.metaTitle?.trim()) err("META_TITLE", "Meta title is missing.");
  if (!a.metaDescription?.trim()) err("META_DESCRIPTION", "Meta description is missing.");
  if (!a.excerpt?.trim()) err("EXCERPT", "Excerpt is missing (blog listings need it).");
  if (!a.category) err("CATEGORY", "Blog category is missing.");
  if (a.wordCount < 300) err("CONTENT", `The article is only ${a.wordCount} words.`);
  if ((a.metaTitle?.length ?? 0) > 70) warn("META_TITLE_LONG", "Meta title is over 70 characters and will be cut off in search results.");
  if ((a.metaDescription?.length ?? 0) > 175) warn("META_DESCRIPTION_LONG", "Meta description is over 175 characters.");

  // Slug uniqueness
  if (ctx.slugOwner && !ctx.slugOwner.isOwnPost) err("SLUG_TAKEN", `/blog/${a.slug} is already used by another blog post.`);

  // Links
  const broken = a.internalLinks.filter((l) => !ctx.knownPaths.has(l.split("#")[0].split("?")[0]));
  if (broken.length) err("BROKEN_LINKS", `Links to pages that don't exist: ${broken.join(", ")}.`);

  // Image
  if (a.featuredImageUrl && !/^https:\/\//.test(a.featuredImageUrl)) err("IMAGE_URL", "Featured image must be an https URL.");
  if (a.featuredImageUrl && !a.featuredImageAlt?.trim()) err("IMAGE_ALT", "Featured image needs alt text.");
  if (!a.featuredImageUrl) warn("NO_IMAGE", "No featured image. The post will publish without a cover.");

  // CTA
  if (a.ctaCount === 0) warn("NO_CTA", "The article has no CTA block.");

  // Duplicate content
  if (ctx.titleClash) err("DUPLICATE_TITLE", `Another published post already uses this title: "${ctx.titleClash}".`);
  if (ctx.closestExisting && ctx.closestExisting.similarity >= DUPLICATE_THRESHOLD) {
    err("DUPLICATE_CONTENT", `The text is ${Math.round(ctx.closestExisting.similarity * 100)}% similar to /blog/${ctx.closestExisting.slug}.`);
  } else if (ctx.closestExisting && ctx.closestExisting.similarity >= 0.25) {
    warn("SIMILAR_CONTENT", `Overlaps noticeably (${Math.round(ctx.closestExisting.similarity * 100)}%) with /blog/${ctx.closestExisting.slug}.`);
  }

  // SEO / quality gate (§21): auto-publish is strict; manual mode trusts the approver but warns.
  if (!a.seo) {
    (ctx.mode === "AUTO_PUBLISH" ? err : warn)("NO_SEO_CHECK", "No SEO check has been run.");
  } else {
    if (a.seo.stale) (ctx.mode === "AUTO_PUBLISH" ? err : warn)("SEO_STALE", "The article changed after the last SEO check.");
    for (const c of a.seo.critical) (ctx.mode === "AUTO_PUBLISH" ? err : warn)("SEO_CRITICAL", c);
  }

  return { errors, warnings };
}
