import "server-only";

import { seoDb, throwIfDbError } from "./db";
import { escapeLike } from "./keywords-data";
import type { QualityFlag } from "./agents/content-writer";
import type { SeoAnalysis } from "./agents/seo-analyst";
import { articleFingerprint } from "./seo-checks";

export const ARTICLES_PAGE_SIZE = 25;

export interface ArticleListRow {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  primaryKeyword: string | null;
  seoScore: number | null;
  origin: string;
  currentVersion: number;
  updatedAt: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  plannedPublishAt: string | null;
}

export async function listArticles(f: { statuses?: string[]; q?: string; page: number }): Promise<{ rows: ArticleListRow[]; count: number }> {
  const db = await seoDb();
  let q = db
    .from("seo_articles")
    .select("id, title, slug, status, primary_keyword, seo_score, origin, current_version, updated_at, scheduled_for, published_at, seo_content_plans(planned_publish_at)", { count: "exact" });
  if (f.statuses?.length) q = q.in("status", f.statuses);
  else q = q.neq("status", "ARCHIVED");
  if (f.q) q = q.or(`title.ilike.%${escapeLike(f.q).replace(/[,()]/g, " ")}%,primary_keyword.ilike.%${escapeLike(f.q).replace(/[,()]/g, " ")}%`);
  const from = (f.page - 1) * ARTICLES_PAGE_SIZE;
  const { data, count, error } = await q.order("updated_at", { ascending: false }).range(from, from + ARTICLES_PAGE_SIZE - 1);
  throwIfDbError(error, "Loading articles");

  type Raw = {
    id: string; title: string; slug: string | null; status: string; primary_keyword: string | null; seo_score: number | null;
    origin: string; current_version: number; updated_at: string; scheduled_for: string | null; published_at: string | null;
    seo_content_plans: { planned_publish_at: string | null } | null;
  };
  return {
    count: count ?? 0,
    rows: ((data ?? []) as unknown as Raw[]).map((r) => ({
      id: r.id, title: r.title, slug: r.slug, status: r.status, primaryKeyword: r.primary_keyword, seoScore: r.seo_score,
      origin: r.origin, currentVersion: r.current_version, updatedAt: r.updated_at, scheduledFor: r.scheduled_for,
      publishedAt: r.published_at, plannedPublishAt: r.seo_content_plans?.planned_publish_at ?? null,
    })),
  };
}

export interface ArticleVersionRow {
  id: string;
  versionNumber: number;
  source: string;
  title: string;
  createdAt: string;
  createdByName: string | null;
}

export interface ArticleDetail {
  id: string;
  title: string;
  slug: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  excerpt: string | null;
  contentHtml: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  featuredImagePrompt: string | null;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  category: string | null;
  ctaType: string | null;
  origin: string;
  status: string;
  seoScore: number | null;
  qualityFlags: QualityFlag[];
  currentVersion: number;
  updatedAt: string;
  plan: { id: string; title: string; plannedPublishAt: string | null } | null;
  versions: ArticleVersionRow[];
  approvedAt: string | null;
  approvedByName: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
  seoAnalysis: SeoAnalysis | null;
  /** True when the saved article changed after the last SEO check. */
  seoStale: boolean;
  linkSuggestions: { id: string; url: string; anchorText: string; reason: string | null; targetType: string }[];
}

export async function getArticle(id: string): Promise<ArticleDetail | null> {
  const db = await seoDb();
  const [art, vers, links] = await Promise.all([
    db.from("seo_articles")
      .select(`id, title, slug, meta_title, meta_description, excerpt, content_html, featured_image_url, featured_image_alt,
        featured_image_prompt, primary_keyword, secondary_keywords, category, cta_type, origin, status, seo_score, quality_flags,
        current_version, updated_at, seo_analysis, approved_at, scheduled_for, published_at, published_url,
        approver:profiles!seo_articles_approved_by_fkey(full_name), seo_content_plans(id, title, planned_publish_at)`)
      .eq("id", id)
      .maybeSingle(),
    db.from("seo_article_versions")
      .select("id, version_number, source, title, created_at, profiles(full_name)")
      .eq("article_id", id)
      .order("version_number", { ascending: false })
      .limit(100),
    db.from("seo_article_links")
      .select("id, target_url, anchor_text, reason, target_type")
      .eq("article_id", id)
      .eq("status", "SUGGESTED")
      .order("created_at"),
  ]);
  throwIfDbError(links.error, "Loading link suggestions");
  throwIfDbError(art.error, "Loading article");
  throwIfDbError(vers.error, "Loading versions");
  if (!art.data) return null;

  type Raw = {
    id: string; title: string; slug: string | null; meta_title: string | null; meta_description: string | null; excerpt: string | null;
    content_html: string; featured_image_url: string | null; featured_image_alt: string | null; featured_image_prompt: string | null;
    primary_keyword: string | null; secondary_keywords: string[]; category: string | null; cta_type: string | null; origin: string;
    status: string; seo_score: number | null; quality_flags: QualityFlag[] | null; current_version: number; updated_at: string;
    seo_analysis: SeoAnalysis | null;
    approved_at: string | null; scheduled_for: string | null; published_at: string | null; published_url: string | null;
    approver: { full_name: string } | null;
    seo_content_plans: { id: string; title: string; planned_publish_at: string | null } | null;
  };
  const a = art.data as unknown as Raw;
  type V = { id: string; version_number: number; source: string; title: string; created_at: string; profiles: { full_name: string } | null };

  return {
    id: a.id, title: a.title, slug: a.slug, metaTitle: a.meta_title, metaDescription: a.meta_description, excerpt: a.excerpt,
    contentHtml: a.content_html, featuredImageUrl: a.featured_image_url, featuredImageAlt: a.featured_image_alt,
    featuredImagePrompt: a.featured_image_prompt, primaryKeyword: a.primary_keyword, secondaryKeywords: a.secondary_keywords,
    category: a.category, ctaType: a.cta_type, origin: a.origin, status: a.status, seoScore: a.seo_score,
    qualityFlags: Array.isArray(a.quality_flags) ? a.quality_flags : [], currentVersion: a.current_version, updatedAt: a.updated_at,
    plan: a.seo_content_plans ? { id: a.seo_content_plans.id, title: a.seo_content_plans.title, plannedPublishAt: a.seo_content_plans.planned_publish_at } : null,
    versions: ((vers.data ?? []) as unknown as V[]).map((v) => ({
      id: v.id, versionNumber: v.version_number, source: v.source, title: v.title, createdAt: v.created_at, createdByName: v.profiles?.full_name ?? null,
    })),
    approvedAt: a.approved_at, approvedByName: a.approver?.full_name ?? null, scheduledFor: a.scheduled_for,
    publishedAt: a.published_at, publishedUrl: a.published_url,
    seoAnalysis: a.seo_analysis,
    seoStale: Boolean(a.seo_analysis && a.seo_analysis.fingerprint !== articleFingerprint(a)),
    linkSuggestions: ((links.data ?? []) as { id: string; target_url: string; anchor_text: string; reason: string | null; target_type: string }[])
      .map((l) => ({ id: l.id, url: l.target_url, anchorText: l.anchor_text, reason: l.reason, targetType: l.target_type })),
  };
}
