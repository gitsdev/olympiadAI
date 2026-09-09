import type { BlogCategory } from "@/types/database";
import { slugify } from "@/lib/slug";

// Pure constants + helpers only — safe to import from Client Components.
// Data-access lives in "@/lib/blog-data" (server-only).

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.olympiadiq.in";

/** Amazon Associates store/tracking ID, e.g. "olympiadiq-21". */
export const AMAZON_ASSOC_TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOC_TAG ?? "";

export const BLOG_CATEGORIES: { name: BlogCategory; blurb: string }[] = [
  { name: "Olympiad Prep",    blurb: "Syllabus breakdowns, past papers and prep plans for IMO, NSO, IEO and more." },
  { name: "Study Guides",     blurb: "Chapter-wise notes and concept guides for CBSE & ICSE, Classes 1–10." },
  { name: "Book Reviews",     blurb: "Honest reviews of Olympiad workbooks, reference books and practice sets." },
  { name: "Exam Strategy",    blurb: "Time management, revision technique and exam-day tactics." },
  { name: "Parent Resources", blurb: "How parents can support Olympiad and board-exam preparation at home." },
];

export function categorySlug(category: string): string {
  return slugify(category);
}

export function categoryFromSlug(slug: string): BlogCategory | null {
  return BLOG_CATEGORIES.find((c) => categorySlug(c.name) === slug)?.name ?? null;
}

/** OABadge tone for each blog category, so cards/badges read at a glance. */
export function categoryTone(
  category: string
): "cobalt" | "gold" | "green" | "red" | "amber" | "neutral" {
  switch (category) {
    case "Olympiad Prep": return "green";
    case "Book Reviews": return "gold";
    case "Exam Strategy": return "cobalt";
    case "Parent Resources": return "red";
    case "Study Guides":
    default: return "cobalt";
  }
}

/** "All classes" · "Class 7" · "Classes 4–9" from a class_levels array. */
export function classRangeLabel(levels: number[] | null | undefined): string {
  if (!levels || levels.length === 0) return "All classes";
  const sorted = [...levels].sort((a, b) => a - b);
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  return lo === hi ? `Class ${lo}` : `Classes ${lo}–${hi}`;
}

/** Most-used tags across posts, for the "Popular" quick-search chips. */
export function popularTags(posts: { tags: string[] }[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([t]) => t);
}

/**
 * Amazon Associates + Google compliance for outbound product links:
 * - append the associate tag if configured and not already present
 * - callers render these with rel="sponsored nofollow noopener noreferrer"
 */
export function withAmazonTag(url: string): string {
  if (!AMAZON_ASSOC_TAG) return url;
  try {
    const u = new URL(url);
    const isAmazon =
      /(^|\.)amazon\.[a-z.]+$/.test(u.hostname) || u.hostname === "amzn.to";
    if (!isAmazon) return url;
    if (u.hostname === "amzn.to") return url; // short links carry the tag already
    if (!u.searchParams.has("tag")) u.searchParams.set("tag", AMAZON_ASSOC_TAG);
    return u.toString();
  } catch {
    return url;
  }
}

export function isAmazonUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return /(^|\.)amazon\.[a-z.]+$/.test(h) || h === "amzn.to";
  } catch {
    return false;
  }
}

/** Rough reading time from Markdown source (~200 wpm). */
export function readingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export const AFFILIATE_DISCLOSURE_SHORT =
  "OlympiadIQ is a participant in the Amazon Services LLC Associates Program. As an Amazon Associate we earn from qualifying purchases made through links on this page — at no extra cost to you.";

export const AFFILIATE_PRICE_DISCLAIMER =
  "Product prices and availability are accurate as of the date/time shown and are subject to change. Any price and availability information displayed on Amazon at the time of purchase will apply.";
