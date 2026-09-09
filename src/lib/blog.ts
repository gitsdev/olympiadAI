import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { asBlogPosts, asBlogPost } from "@/lib/supabase/types-helper";
import type { BlogCategory } from "@/types/database";
import { slugify } from "@/lib/slug";

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

// ── Data access (public, anon key — RLS restricts to published rows) ──────
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const getPublishedPosts = cache(async () => {
  const supabase = publicClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(
      "slug, title, excerpt, cover_image_url, cover_image_alt, category, board, tags, author_name, reading_minutes, published_at"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return asBlogPosts(data);
});

export const getPostBySlug = cache(async (slug: string) => {
  const supabase = publicClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return asBlogPost(data);
});

export const getRelatedPosts = cache(async (category: string, excludeSlug: string) => {
  const supabase = publicClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, cover_image_alt, category, reading_minutes, published_at")
    .eq("status", "published")
    .eq("category", category)
    .neq("slug", excludeSlug)
    .order("published_at", { ascending: false })
    .limit(3);
  return asBlogPosts(data);
});
