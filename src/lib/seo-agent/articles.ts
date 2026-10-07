// Article editing rules and validation. Pure + client-safe.

import { z } from "zod";
import { BLOG_CATEGORIES, CTA_TYPES } from "./constants";

/** Statuses in which the article body and metadata can be edited. */
export const EDITABLE_ARTICLE_STATUSES: readonly string[] = ["DRAFT", "REVIEW", "REVIEW_REQUIRED", "REJECTED"];

/** Must match RESERVED_SLUGS in src/actions/blog.ts: static routes under /blog. */
export const BLOG_RESERVED_SLUGS = new Set(["category", "affiliate-disclosure", "feed.xml", "feed", "rss.xml"]);

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Rough guidance shown next to the fields (not hard limits). */
export const META_TITLE_RANGE = [30, 60] as const;
export const META_DESCRIPTION_RANGE = [120, 160] as const;

export const articleSaveSchema = z.object({
  title: z.string().trim().min(5, "Title is too short").max(160),
  slug: z.string().trim().max(100).regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens"),
  metaTitle: z.string().trim().max(120).default(""),
  metaDescription: z.string().trim().max(320).default(""),
  excerpt: z.string().trim().max(500).default(""),
  contentHtml: z.string().max(500_000, "Article is too large"),
  featuredImageUrl: z.string().trim().max(1000).refine((v) => v === "" || /^https:\/\//.test(v), "Image URL must start with https://").default(""),
  featuredImageAlt: z.string().trim().max(300).default(""),
  category: z.enum(BLOG_CATEGORIES),
  ctaType: z.enum(CTA_TYPES).nullable().default(null),
});
export type ArticleSaveInput = z.infer<typeof articleSaveSchema>;

/** "auto": version only if content/metadata changed since the last version; "force": always; "none": autosave. */
export type VersionMode = "auto" | "force" | "none";

/** The metadata kept on each version snapshot (everything except title and body). */
export function versionMetadata(a: {
  slug: string | null; metaTitle: string | null; metaDescription: string | null; excerpt: string | null;
  featuredImageUrl: string | null; featuredImageAlt: string | null; category: string | null; ctaType: string | null;
}) {
  return {
    slug: a.slug ?? "", metaTitle: a.metaTitle ?? "", metaDescription: a.metaDescription ?? "", excerpt: a.excerpt ?? "",
    featuredImageUrl: a.featuredImageUrl ?? "", featuredImageAlt: a.featuredImageAlt ?? "", category: a.category ?? "", ctaType: a.ctaType ?? "",
  };
}

/** True if a save differs from the last saved version in any tracked field. */
export function differsFromVersion(
  current: { title: string; contentHtml: string; metadata: Record<string, unknown> },
  version: { title: string; content_html: string; metadata: Record<string, unknown> } | null,
): boolean {
  if (!version) return true;
  if (current.title !== version.title || current.contentHtml !== version.content_html) return true;
  const keys = new Set([...Object.keys(current.metadata), ...Object.keys(version.metadata ?? {})]);
  for (const k of keys) if ((current.metadata[k] ?? "") !== ((version.metadata ?? {})[k] ?? "")) return true;
  return false;
}
