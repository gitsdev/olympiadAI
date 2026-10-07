"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/auth";
import { seoDb, throwIfDbError } from "@/lib/seo-agent/db";
import { errorMessage, seoLog } from "@/lib/seo-agent/logger";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import type { SeoSettings } from "@/lib/seo-agent/settings-schema";
import { createAIProvider } from "@/lib/seo-agent/ai";
import { runAgentTask } from "@/lib/seo-agent/agents/run-task";
import { supabaseTaskStore } from "@/lib/seo-agent/agents/task-store";
import { writeArticle, type ProcessedArticle } from "@/lib/seo-agent/agents/content-writer";
import { htmlToText, sanitizeArticleHtml } from "@/lib/seo-agent/article-html";
import { diffWords } from "diff";
import {
  articleSaveSchema, differsFromVersion, EDITABLE_ARTICLE_STATUSES, versionMetadata, type VersionMode,
} from "@/lib/seo-agent/articles";
import { addArticleVersion, syncArticleLinksAndCtas, uniqueArticleSlug } from "@/lib/seo-agent/articles-persist";
import { CTA_DESTINATIONS } from "@/lib/seo-agent/site-pages";
import type { CtaType } from "@/lib/seo-agent/constants";
import type { OutlineSection, PlanInternalLink } from "@/lib/seo-agent/content-plans";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const uuid = z.uuid();
/** A GENERATING claim older than this is treated as a crashed run and may be retried. */
const STALE_GENERATION_MS = 15 * 60_000;

function revalidate() {
  revalidatePath("/admin/seo-agent", "layout");
}

interface PlanRow {
  id: string; title: string; primary_keyword: string; secondary_keywords: string[]; search_intent: string | null;
  content_type: string | null; target_audience: string | null; outline: OutlineSection[] | null; recommended_cta: string | null;
  suggested_internal_links: PlanInternalLink[] | null; notes: string | null; status: string;
}

const PLAN_COLS = "id, title, primary_keyword, secondary_keywords, search_intent, content_type, target_audience, outline, recommended_cta, suggested_internal_links, notes, status";

async function existingTitles(db: SupabaseClient, excludeArticleId?: string): Promise<string[]> {
  const [posts, arts] = await Promise.all([
    db.from("blog_posts").select("title").eq("status", "published").limit(150),
    db.from("seo_articles").select("id, title").not("status", "in", "(ARCHIVED,REJECTED)").limit(150),
  ]);
  throwIfDbError(posts.error, "Loading blog titles");
  throwIfDbError(arts.error, "Loading article titles");
  return [
    ...((posts.data ?? []) as { title: string }[]).map((p) => p.title),
    ...((arts.data ?? []) as { id: string; title: string }[]).filter((a) => a.id !== excludeArticleId).map((a) => a.title),
  ];
}

/** Runs the Content Writer Agent for a plan (shared by generate and regenerate). */
async function runWriter(
  db: SupabaseClient,
  settings: SeoSettings,
  plan: PlanRow,
  adminId: string,
  opts: { taskType: string; articleId?: string; persist: (draft: ProcessedArticle, taskId: string) => Promise<string> },
): Promise<{ articleId: string; flags: number; words: number }> {
  const provider = createAIProvider(settings);
  const ctaType = (plan.recommended_cta ?? settings.defaultCta) as CtaType;
  const links = Array.isArray(plan.suggested_internal_links) ? plan.suggested_internal_links : [];

  return runAgentTask(
    {
      agentType: "ContentWriter",
      taskType: opts.taskType,
      category: "CONTENT",
      entityType: "article",
      entityId: opts.articleId,
      inputSummary: `Plan "${plan.title}" (${plan.primary_keyword}); ${(plan.outline ?? []).length} sections, ${links.length} links, CTA ${ctaType}`,
      createdBy: adminId,
    },
    { store: supabaseTaskStore(db), provider, pricing: settings.aiPricing },
    async ({ ai, taskId }) => {
      const draft = await writeArticle(ai, {
        brand: settings.brand,
        plan: {
          title: plan.title, primaryKeyword: plan.primary_keyword, secondaryKeywords: plan.secondary_keywords,
          searchIntent: plan.search_intent, contentType: plan.content_type, targetAudience: plan.target_audience,
          outline: plan.outline ?? [], notes: plan.notes,
        },
        cta: { type: ctaType, ...CTA_DESTINATIONS[ctaType] },
        internalLinks: links,
        existingTitles: await existingTitles(db, opts.articleId),
      });
      const articleId = await opts.persist(draft, taskId);
      return {
        result: { articleId, flags: draft.qualityFlags.length, words: draft.wordCount },
        entityId: articleId,
        outputSummary: `"${draft.title}": ${draft.wordCount} words, slug /${draft.slug}, CTA ${draft.ctaType}, ${draft.qualityFlags.length} item(s) to review`,
      };
    },
  );
}

/** Plan → new AI draft article (status DRAFT, version 1). */
export async function generateArticleFromPlan(planId: string): Promise<Result<{ articleId: string }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(planId).success) return { ok: false, error: "Invalid plan." };
  const db = await seoDb();

  // Claim the plan so a double-click can't start two writers.
  const staleBefore = new Date(Date.now() - STALE_GENERATION_MS).toISOString();
  const { data: before } = await db.from("seo_content_plans").select("status").eq("id", planId).maybeSingle();
  const prevStatus = (before as { status: string } | null)?.status;
  if (!prevStatus) return { ok: false, error: "Plan not found." };
  const { data: claimed, error: claimErr } = await db
    .from("seo_content_plans")
    .update({ status: "GENERATING" })
    .eq("id", planId)
    .or(`status.in.(IDEA,PLANNED),and(status.eq.GENERATING,updated_at.lt.${staleBefore})`)
    .select(PLAN_COLS)
    .maybeSingle();
  if (claimErr) return { ok: false, error: claimErr.message };
  if (!claimed) {
    return { ok: false, error: prevStatus === "GENERATING" ? "This article is already being generated." : "This plan already has an article." };
  }
  const plan = claimed as PlanRow;
  const restoreStatus = prevStatus === "GENERATING" ? "PLANNED" : prevStatus;

  try {
    const settings = await getSeoSettings();
    const out = await runWriter(db, settings, plan, admin.id, {
      taskType: "generate_article",
      persist: async (draft, taskId) => {
        const slug = await uniqueArticleSlug(db, draft.slug);
        const { data, error } = await db.from("seo_articles").insert({
          content_plan_id: plan.id,
          title: draft.title,
          slug,
          meta_title: draft.metaTitle,
          meta_description: draft.metaDescription,
          excerpt: draft.excerpt,
          content_html: draft.contentHtml,
          featured_image_prompt: draft.featuredImagePrompt,
          featured_image_alt: draft.featuredImageAlt,
          primary_keyword: plan.primary_keyword,
          secondary_keywords: plan.secondary_keywords,
          category: settings.defaultArticleCategory,
          cta_type: draft.ctaType,
          origin: "AI",
          status: "DRAFT",
          quality_flags: draft.qualityFlags,
          created_by: admin.id,
        }).select("id").single();
        throwIfDbError(error, "Saving article");
        const articleId = (data as { id: string }).id;
        try {
          await addArticleVersion(db, articleId, {
            title: draft.title,
            content_html: draft.contentHtml,
            metadata: versionMetadata({ slug, metaTitle: draft.metaTitle, metaDescription: draft.metaDescription, excerpt: draft.excerpt,
              featuredImageUrl: null, featuredImageAlt: draft.featuredImageAlt, category: settings.defaultArticleCategory, ctaType: draft.ctaType }),
          }, { source: "AI_GENERATED", createdBy: null, agentTaskId: taskId });
          await syncArticleLinksAndCtas(db, articleId, draft.contentHtml, { source: "AI", suggestions: plan.suggested_internal_links ?? [] });
          const { error: planErr } = await db.from("seo_content_plans").update({ status: "DRAFT" }).eq("id", plan.id);
          throwIfDbError(planErr, "Updating plan status");
        } catch (e) {
          // Don't leave a half-saved article behind.
          await db.from("seo_articles").delete().eq("id", articleId);
          throw e;
        }
        return articleId;
      },
    });
    revalidate();
    return { ok: true, articleId: out.articleId };
  } catch (err) {
    await db.from("seo_content_plans").update({ status: restoreStatus }).eq("id", planId).eq("status", "GENERATING");
    seoLog.error("article.generate_failed", { planId, error: errorMessage(err) });
    return { ok: false, error: `Article generation failed: ${errorMessage(err)}` };
  }
}

/** Rewrites an existing draft from its plan. The previous text stays in version history. */
export async function regenerateArticle(articleId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  const db = await seoDb();

  const { data: art } = await db.from("seo_articles").select("status, content_plan_id, slug, category").eq("id", articleId).maybeSingle();
  const a = art as { status: string; content_plan_id: string | null; slug: string | null; category: string | null } | null;
  if (!a) return { ok: false, error: "Article not found." };
  if (!a.content_plan_id) return { ok: false, error: "This article has no content plan to regenerate from." };
  if (!EDITABLE_ARTICLE_STATUSES.includes(a.status)) return { ok: false, error: `A ${a.status.toLowerCase()} article can't be regenerated.` };

  // Claim the article while the writer runs.
  const { data: claimed } = await db.from("seo_articles").update({ status: "GENERATING" })
    .eq("id", articleId).in("status", EDITABLE_ARTICLE_STATUSES as string[]).select("id").maybeSingle();
  if (!claimed) return { ok: false, error: "This article is already being regenerated." };

  try {
    const [settings, planRes] = await Promise.all([getSeoSettings(), db.from("seo_content_plans").select(PLAN_COLS).eq("id", a.content_plan_id).single()]);
    throwIfDbError(planRes.error, "Loading plan");
    const plan = planRes.data as PlanRow;

    await runWriter(db, settings, plan, admin.id, {
      taskType: "regenerate_article",
      articleId,
      persist: async (draft, taskId) => {
        // Keep the existing slug: it may already be shared or indexed.
        const slug = a.slug ?? (await uniqueArticleSlug(db, draft.slug, articleId));
        const { error } = await db.from("seo_articles").update({
          title: draft.title, slug, meta_title: draft.metaTitle, meta_description: draft.metaDescription, excerpt: draft.excerpt,
          content_html: draft.contentHtml, featured_image_prompt: draft.featuredImagePrompt, featured_image_alt: draft.featuredImageAlt,
          cta_type: draft.ctaType, quality_flags: draft.qualityFlags, status: "DRAFT", seo_score: null, seo_analysis: null,
        }).eq("id", articleId);
        throwIfDbError(error, "Saving regenerated article");
        await addArticleVersion(db, articleId, {
          title: draft.title,
          content_html: draft.contentHtml,
          metadata: versionMetadata({ slug, metaTitle: draft.metaTitle, metaDescription: draft.metaDescription, excerpt: draft.excerpt,
            featuredImageUrl: null, featuredImageAlt: draft.featuredImageAlt, category: a.category, ctaType: draft.ctaType }),
        }, { source: "AI_GENERATED", createdBy: null, agentTaskId: taskId });
        await syncArticleLinksAndCtas(db, articleId, draft.contentHtml, { source: "AI", suggestions: plan.suggested_internal_links ?? [] });
        return articleId;
      },
    });
    revalidate();
    return { ok: true };
  } catch (err) {
    await db.from("seo_articles").update({ status: a.status }).eq("id", articleId).eq("status", "GENERATING");
    seoLog.error("article.regenerate_failed", { articleId, error: errorMessage(err) });
    return { ok: false, error: `Regeneration failed: ${errorMessage(err)}` };
  }
}

export interface SaveArticleResult {
  savedAt: string;
  version: number | null;
}

/** Saves editor content. Content is sanitized server-side; see VersionMode for when a version is created. */
export async function saveArticle(articleId: string, input: unknown, mode: VersionMode): Promise<Result<SaveArticleResult>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success || !["auto", "force", "none"].includes(mode)) return { ok: false, error: "Invalid request." };
  const parsed = articleSaveSchema.safeParse(input);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `${i?.path.join(".") || "input"}: ${i?.message ?? "invalid"}` };
  }
  const v = parsed.data;

  try {
    const db = await seoDb();
    const { data: art } = await db.from("seo_articles").select("status, content_plan_id").eq("id", articleId).maybeSingle();
    const a = art as { status: string; content_plan_id: string | null } | null;
    if (!a) return { ok: false, error: "Article not found." };
    if (!EDITABLE_ARTICLE_STATUSES.includes(a.status)) return { ok: false, error: `A ${a.status.toLowerCase()} article can't be edited.` };

    const free = await uniqueArticleSlug(db, v.slug, articleId);
    if (free !== v.slug) return { ok: false, error: `The URL /blog/${v.slug} is already used. Try /blog/${free}.` };

    const html = sanitizeArticleHtml(v.contentHtml);
    const meta = versionMetadata({ ...v, featuredImageUrl: v.featuredImageUrl || null, featuredImageAlt: v.featuredImageAlt || null });
    const { error } = await db.from("seo_articles").update({
      title: v.title, slug: v.slug, meta_title: v.metaTitle || null, meta_description: v.metaDescription || null,
      excerpt: v.excerpt || null, content_html: html, featured_image_url: v.featuredImageUrl || null,
      featured_image_alt: v.featuredImageAlt || null, category: v.category, cta_type: v.ctaType,
    }).eq("id", articleId);
    if (error) throw error;

    let version: number | null = null;
    if (mode !== "none") {
      const { data: last } = await db.from("seo_article_versions").select("title, content_html, metadata")
        .eq("article_id", articleId).order("version_number", { ascending: false }).limit(1).maybeSingle();
      const lastV = last as { title: string; content_html: string; metadata: Record<string, unknown> } | null;
      if (mode === "force" || differsFromVersion({ title: v.title, contentHtml: html, metadata: meta }, lastV)) {
        version = await addArticleVersion(db, articleId, { title: v.title, content_html: html, metadata: meta }, { source: "MANUAL_EDIT", createdBy: admin.id });
      }
    }

    let suggestions: PlanInternalLink[] = [];
    if (a.content_plan_id) {
      const { data: plan } = await db.from("seo_content_plans").select("suggested_internal_links").eq("id", a.content_plan_id).maybeSingle();
      suggestions = ((plan as { suggested_internal_links: PlanInternalLink[] | null } | null)?.suggested_internal_links) ?? [];
    }
    await syncArticleLinksAndCtas(db, articleId, html, { source: "MANUAL", suggestions });

    if (mode !== "none") revalidate();
    return { ok: true, savedAt: new Date().toISOString(), version };
  } catch (err) {
    seoLog.error("article.save_failed", { articleId, error: errorMessage(err) });
    return { ok: false, error: `Could not save: ${errorMessage(err)}` };
  }
}

export interface VersionContent {
  versionNumber: number;
  source: string;
  title: string;
  contentHtml: string;
  metadata: Record<string, string>;
  createdAt: string;
}

export async function getArticleVersion(versionId: string): Promise<Result<{ version: VersionContent }>> {
  await requireAdmin();
  if (!uuid.safeParse(versionId).success) return { ok: false, error: "Invalid version." };
  const db = await seoDb();
  const { data, error } = await db.from("seo_article_versions")
    .select("version_number, source, title, content_html, metadata, created_at").eq("id", versionId).maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Version not found." };
  const r = data as { version_number: number; source: string; title: string; content_html: string; metadata: Record<string, string>; created_at: string };
  return {
    ok: true,
    version: {
      versionNumber: r.version_number, source: r.source, title: r.title,
      // Stored versions were sanitized on save; sanitize again on the way out anyway.
      contentHtml: sanitizeArticleHtml(r.content_html), metadata: r.metadata ?? {}, createdAt: r.created_at,
    },
  };
}

/** Makes an old version current again, recorded as a new RESTORE version. */
export async function restoreArticleVersion(articleId: string, versionId: string): Promise<Result<{ version: number }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success || !uuid.safeParse(versionId).success) return { ok: false, error: "Invalid request." };
  try {
    const db = await seoDb();
    const [{ data: art }, { data: ver }] = await Promise.all([
      db.from("seo_articles").select("status, content_plan_id").eq("id", articleId).maybeSingle(),
      db.from("seo_article_versions").select("article_id, version_number, title, content_html, metadata").eq("id", versionId).maybeSingle(),
    ]);
    const a = art as { status: string; content_plan_id: string | null } | null;
    const v = ver as { article_id: string; version_number: number; title: string; content_html: string; metadata: Record<string, string> } | null;
    if (!a || !v || v.article_id !== articleId) return { ok: false, error: "Version not found for this article." };
    if (!EDITABLE_ARTICLE_STATUSES.includes(a.status)) return { ok: false, error: `A ${a.status.toLowerCase()} article can't be edited.` };

    const m = v.metadata ?? {};
    const slug = m.slug ? await uniqueArticleSlug(db, m.slug, articleId) : undefined;
    const html = sanitizeArticleHtml(v.content_html);
    const { error } = await db.from("seo_articles").update({
      title: v.title, content_html: html,
      ...(slug ? { slug } : {}),
      meta_title: m.metaTitle || null, meta_description: m.metaDescription || null, excerpt: m.excerpt || null,
      featured_image_url: m.featuredImageUrl || null, featured_image_alt: m.featuredImageAlt || null,
      ...(m.category ? { category: m.category } : {}), cta_type: m.ctaType || null,
    }).eq("id", articleId);
    if (error) throw error;

    const version = await addArticleVersion(db, articleId, { title: v.title, content_html: html, metadata: { ...m, ...(slug ? { slug } : {}), restoredFrom: v.version_number } },
      { source: "RESTORE", createdBy: admin.id });
    await syncArticleLinksAndCtas(db, articleId, html, { source: "MANUAL" });
    revalidate();
    return { ok: true, version };
  } catch (err) {
    seoLog.error("article.restore_failed", { articleId, versionId, error: errorMessage(err) });
    return { ok: false, error: `Could not restore: ${errorMessage(err)}` };
  }
}

export interface VersionComparison {
  from: { versionNumber: number; source: string; createdAt: string };
  to: { versionNumber: number; source: string; createdAt: string };
  /** Word-level diff of the article text (title included). */
  parts: { value: string; added?: boolean; removed?: boolean }[];
  metaChanges: { field: string; from: string; to: string }[];
}

const META_LABELS: Record<string, string> = {
  slug: "Slug", metaTitle: "Meta title", metaDescription: "Meta description", excerpt: "Excerpt",
  featuredImageUrl: "Featured image", featuredImageAlt: "Image alt text", category: "Category", ctaType: "CTA",
};

export async function compareArticleVersions(fromId: string, toId: string): Promise<Result<{ comparison: VersionComparison }>> {
  await requireAdmin();
  if (!uuid.safeParse(fromId).success || !uuid.safeParse(toId).success) return { ok: false, error: "Invalid versions." };
  const db = await seoDb();
  const { data, error } = await db.from("seo_article_versions")
    .select("id, article_id, version_number, source, title, content_html, metadata, created_at").in("id", [fromId, toId]);
  if (error) return { ok: false, error: error.message };
  type V = { id: string; article_id: string; version_number: number; source: string; title: string; content_html: string; metadata: Record<string, unknown> | null; created_at: string };
  const rows = (data ?? []) as V[];
  const a = rows.find((r) => r.id === fromId);
  const b = rows.find((r) => r.id === toId);
  if (!a || !b || a.article_id !== b.article_id) return { ok: false, error: "Versions not found for the same article." };

  const text = (v: V) => `${v.title}\n\n${htmlToText(v.content_html)}`;
  const parts = diffWords(text(a), text(b)).map((p) => ({ value: p.value, added: p.added || undefined, removed: p.removed || undefined }));
  const metaChanges = Object.keys(META_LABELS)
    .map((k) => ({ field: META_LABELS[k], from: String(a.metadata?.[k] ?? ""), to: String(b.metadata?.[k] ?? "") }))
    .filter((c) => c.from !== c.to);

  return {
    ok: true,
    comparison: {
      from: { versionNumber: a.version_number, source: a.source, createdAt: a.created_at },
      to: { versionNumber: b.version_number, source: b.source, createdAt: b.created_at },
      parts, metaChanges,
    },
  };
}
