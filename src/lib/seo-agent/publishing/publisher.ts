import "server-only";

// Publishing adapter (spec §22): writes an approved SEO article into the
// existing blog (blog_posts), the same table /admin/blog uses. Shared by
// "Publish now", POST /api/content/publish and the Phase 7 cron.
//
// Always called with the service-role client: blog_posts has no write
// policy for browser sessions, and cron/API calls have no session at all.
// Callers must have authenticated the request first.

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readingMinutes } from "@/lib/blog";
import { throwIfDbError } from "../db";
import { errorMessage, seoLog } from "../logger";
import { getSeoSettings } from "../settings-data";
import { getKnownInternalPaths } from "../content-data";
import { escapeLike } from "../keywords-data";
import { inferClassAndSubject, normalizeKeyword } from "../keywords";
import { extractCtas, extractLinks, htmlToText, wordCount } from "../article-html";
import { articleFingerprint } from "../seo-checks";
import { runPlainTask } from "../agents/run-task";
import { supabaseTaskStore } from "../agents/task-store";
import type { SeoAnalysis } from "../agents/seo-analyst";
import type { PublishingMode } from "../constants";
import { articleHtmlToBlogMarkdown } from "./markdown";
import {
  canTransition, textSimilarity, validateForPublish,
  type PublishCandidate, type PublishValidation, type ValidationIssue,
} from "./rules";

export const IMAGE_BUCKET = "blog-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface ArticleForPublish {
  id: string; status: string; title: string; slug: string | null; meta_title: string | null; meta_description: string | null;
  excerpt: string | null; content_html: string; featured_image_url: string | null; featured_image_alt: string | null;
  primary_keyword: string | null; secondary_keywords: string[]; category: string | null; cta_type: string | null;
  approved_at: string | null; approved_by: string | null; publish_authorization: string | null; blog_post_id: string | null;
  content_plan_id: string | null; seo_analysis: SeoAnalysis | null; published_at: string | null;
}

const COLS = `id, status, title, slug, meta_title, meta_description, excerpt, content_html, featured_image_url, featured_image_alt,
  primary_keyword, secondary_keywords, category, cta_type, approved_at, approved_by, publish_authorization, blog_post_id,
  content_plan_id, seo_analysis, published_at`;

export async function loadArticleForPublish(db: SupabaseClient, id: string): Promise<ArticleForPublish | null> {
  const { data, error } = await db.from("seo_articles").select(COLS).eq("id", id).maybeSingle();
  throwIfDbError(error, "Loading article");
  return (data as unknown as ArticleForPublish | null) ?? null;
}

/**
 * Runs every pre-publish check against the live blog. `assumeApproved`
 * lets the Approve button check everything except the approval itself.
 */
export async function buildPublishCheck(
  db: SupabaseClient,
  a: ArticleForPublish,
  mode: PublishingMode,
  opts: { assumeApproved?: boolean } = {},
): Promise<PublishValidation> {
  const [knownPaths, slugRes, titleRes, postsRes] = await Promise.all([
    getKnownInternalPaths(db),
    a.slug ? db.from("blog_posts").select("id").eq("slug", a.slug).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from("blog_posts").select("id, title").eq("status", "published").ilike("title", escapeLike(a.title.trim())).limit(5),
    db.from("blog_posts").select("id, slug, title, content").eq("status", "published").order("published_at", { ascending: false }).limit(300),
  ]);
  throwIfDbError(slugRes.error, "Checking slug");
  throwIfDbError(titleRes.error, "Checking titles");
  throwIfDbError(postsRes.error, "Loading posts for duplicate check");

  const slugRow = slugRes.data as { id: string } | null;
  const titleClash = ((titleRes.data ?? []) as { id: string; title: string }[]).find((p) => p.id !== a.blog_post_id)?.title ?? null;
  const text = htmlToText(a.content_html);
  let closest: { title: string; slug: string; similarity: number } | null = null;
  for (const p of (postsRes.data ?? []) as { id: string; slug: string; title: string; content: string }[]) {
    if (p.id === a.blog_post_id) continue;
    const similarity = textSimilarity(text, p.content);
    if (!closest || similarity > closest.similarity) closest = { title: p.title, slug: p.slug, similarity };
  }

  const candidate: PublishCandidate = {
    status: a.status, title: a.title, slug: a.slug, metaTitle: a.meta_title, metaDescription: a.meta_description, excerpt: a.excerpt,
    category: a.category, wordCount: wordCount(a.content_html), ctaCount: extractCtas(a.content_html).length,
    featuredImageUrl: a.featured_image_url, featuredImageAlt: a.featured_image_alt,
    approvedAt: opts.assumeApproved ? "assumed" : a.approved_at, approvedBy: opts.assumeApproved ? "assumed" : a.approved_by,
    internalLinks: extractLinks(a.content_html).map((l) => l.href).filter((h) => h.startsWith("/")),
    seo: a.seo_analysis
      ? { score: a.seo_analysis.score, critical: a.seo_analysis.critical ?? [], stale: a.seo_analysis.fingerprint !== articleFingerprint(a) }
      : null,
  };
  return validateForPublish(candidate, {
    mode,
    knownPaths,
    slugOwner: slugRow ? { blogPostId: slugRow.id, isOwnPost: slugRow.id === a.blog_post_id } : null,
    closestExisting: closest,
    titleClash,
  });
}

/** Public URL prefix of the image bucket, e.g. https://x.supabase.co/storage/v1/object/public/blog-images/ */
function bucketPrefix(db: SupabaseClient): string {
  return db.storage.from(IMAGE_BUCKET).getPublicUrl("").data.publicUrl;
}

/** Stores image bytes in the blog-images bucket and returns the public URL. */
export async function storeImage(db: SupabaseClient, articleId: string, bytes: Uint8Array, mime: string): Promise<string> {
  const ext = IMAGE_TYPES[mime];
  if (!ext) throw new Error("Only JPEG, PNG or WebP images are allowed.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Images must be 5 MB or smaller.");
  if (!looksLikeImage(bytes, mime)) throw new Error("The file content doesn't match its image type.");
  const path = `seo/${articleId}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return db.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Magic-byte check so a renamed file can't pose as an image. */
export function looksLikeImage(b: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (mime === "image/webp") return String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  return false;
}

/**
 * "Upload/process image if needed": external cover images are copied into
 * our bucket so the post doesn't depend on someone else's server.
 */
async function processFeaturedImage(db: SupabaseClient, a: ArticleForPublish): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const url = a.featured_image_url;
  if (!url) return { ok: true, url: null };
  if (url.startsWith(bucketPrefix(db))) return { ok: true, url };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "follow" });
    if (!res.ok) return { ok: false, error: `Featured image couldn't be downloaded (HTTP ${res.status}).` };
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!IMAGE_TYPES[mime]) return { ok: false, error: `Featured image must be JPEG, PNG or WebP (got ${mime || "unknown"}).` };
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES) return { ok: false, error: "Featured image is larger than 5 MB." };
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { ok: true, url: await storeImage(db, a.id, bytes, mime) };
  } catch (err) {
    return { ok: false, error: `Featured image check failed: ${errorMessage(err)}` };
  }
}

export type PublishOutcome =
  | { ok: true; url: string; blogPostId: string }
  | { ok: false; error: string; issues: ValidationIssue[]; reviewRequired: boolean };

/**
 * Validates and publishes one article. On a validation failure nothing is
 * published and the article moves to REVIEW_REQUIRED (spec §21).
 */
export async function publishArticle(
  db: SupabaseClient,
  articleId: string,
  opts: { actorId: string | null; triggeredBy: "USER" | "CRON" | "SYSTEM" },
): Promise<PublishOutcome> {
  const owner = `${opts.triggeredBy}:${Date.now()}`;
  const lockName = `publish:${articleId}`;
  const { data: locked, error: lockErr } = await db.rpc("seo_try_acquire_lock", { p_job: lockName, p_ttl_seconds: 180, p_owner: owner });
  if (lockErr) return { ok: false, error: `Could not take the publish lock: ${lockErr.message}`, issues: [], reviewRequired: false };
  if (!locked) return { ok: false, error: "This article is already being published.", issues: [], reviewRequired: false };

  try {
    const settings = await getSeoSettings(db);
    const a = await loadArticleForPublish(db, articleId);
    if (!a) return { ok: false, error: "Article not found.", issues: [], reviewRequired: false };
    if (!canTransition(a.status, "PUBLISH")) {
      return { ok: false, error: `Only approved or scheduled articles can be published (this one is ${a.status.toLowerCase()}).`, issues: [], reviewRequired: false };
    }

    return await runPlainTask<PublishOutcome>(
      {
        agentType: "Publisher", taskType: "publish", entityType: "article", entityId: a.id,
        inputSummary: `"${a.title}" → /blog/${a.slug} (${settings.publishingMode})`,
        triggeredBy: opts.triggeredBy, createdBy: opts.actorId,
      },
      { store: supabaseTaskStore(db) },
      async () => {
        const validation = await buildPublishCheck(db, a, settings.publishingMode);
        const issues = [...validation.errors];
        let image: string | null = a.featured_image_url;
        if (!issues.length) {
          const img = await processFeaturedImage(db, a);
          if (img.ok) image = img.url;
          else issues.push({ code: "IMAGE", message: img.error });
        }

        if (issues.length) {
          // Do not publish. Send it back for a human to fix (§21).
          await db.from("seo_articles").update({ status: "REVIEW_REQUIRED" }).eq("id", a.id);
          if (a.content_plan_id) await db.from("seo_content_plans").update({ status: "REVIEW" }).eq("id", a.content_plan_id);
          const summary = issues.map((i) => i.message).join(" ");
          return {
            result: { ok: false, error: `Not published: ${summary}`, issues, reviewRequired: true },
            outputSummary: `Blocked by ${issues.length} validation error(s); moved to Review required`,
            failed: summary,
          };
        }

        const markdown = articleHtmlToBlogMarkdown(a.content_html);
        const { targetClass } = inferClassAndSubject(`${a.primary_keyword ?? ""} ${a.title}`);
        const now = new Date().toISOString();
        const post = {
          title: a.title.trim(),
          excerpt: a.excerpt!.trim(),
          content: markdown,
          cover_image_url: image,
          cover_image_alt: image ? a.featured_image_alt : null,
          category: a.category!,
          class_levels: targetClass ? [targetClass] : [],
          tags: [a.primary_keyword, ...a.secondary_keywords].filter((t): t is string => Boolean(t)).slice(0, 5),
          seo_title: a.meta_title,
          seo_description: a.meta_description,
          has_affiliate_links: /amazon\.|amzn\.to/i.test(markdown),
          reading_minutes: readingMinutes(markdown),
          status: "published" as const,
        };

        let blogPostId = a.blog_post_id;
        let slug = a.slug!;
        if (blogPostId) {
          // Re-publish: update the existing post, keeping its URL and first-published date.
          const { data, error } = await db.from("blog_posts").update(post).eq("id", blogPostId).select("slug").single();
          throwIfDbError(error, "Updating blog post");
          slug = (data as { slug: string }).slug;
        } else {
          const { data, error } = await db.from("blog_posts").insert({
            ...post, slug, board: "Both", author_name: "OlympiadIQ Team", published_at: now, created_by: opts.actorId,
          }).select("id").single();
          throwIfDbError(error, "Creating blog post");
          blogPostId = (data as { id: string }).id;
        }

        const url = `${settings.blogBaseUrl.replace(/\/$/, "")}/${slug}`;
        const { error: artErr } = await db.from("seo_articles").update({
          status: "PUBLISHED",
          published_at: a.published_at ?? now,
          published_url: url,
          blog_post_id: blogPostId,
          featured_image_url: image,
          // Approved by a person, or allowed by AUTO_PUBLISH mode.
          publish_authorization: a.approved_at ? "MANUAL_APPROVAL" : "AUTO_PUBLISH",
        }).eq("id", a.id);
        throwIfDbError(artErr, "Marking article published");

        if (a.content_plan_id) await db.from("seo_content_plans").update({ status: "PUBLISHED", planned_publish_at: a.published_at ?? now }).eq("id", a.content_plan_id);
        if (a.primary_keyword) {
          await db.from("seo_keywords").update({ status: "USED" }).eq("keyword_normalized", normalizeKeyword(a.primary_keyword)).eq("status", "ACTIVE");
        }

        try {
          revalidatePath("/blog", "layout");
          revalidatePath("/sitemap.xml");
          revalidatePath("/admin/seo-agent", "layout");
        } catch (err) {
          // Outside a request context (e.g. tests); ISR will catch up within 10 minutes.
          seoLog.warn("publish.revalidate_failed", { error: errorMessage(err) });
        }

        seoLog.info("publish.completed", { articleId: a.id, blogPostId, url, warnings: validation.warnings.length });
        return {
          result: { ok: true, url, blogPostId: blogPostId! },
          entityId: a.id,
          outputSummary: `Published ${url}${validation.warnings.length ? ` (${validation.warnings.length} warning(s))` : ""}`,
        };
      },
    );
  } catch (err) {
    seoLog.error("publish.failed", { articleId, error: errorMessage(err) });
    return { ok: false, error: `Publishing failed: ${errorMessage(err)}`, issues: [], reviewRequired: false };
  } finally {
    await db.rpc("seo_release_lock", { p_job: lockName, p_owner: owner });
  }
}
