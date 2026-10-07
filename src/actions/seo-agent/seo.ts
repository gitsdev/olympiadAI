"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { seoDb } from "@/lib/seo-agent/db";
import { errorMessage, seoLog } from "@/lib/seo-agent/logger";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { createAIProvider } from "@/lib/seo-agent/ai";
import { runAgentTask } from "@/lib/seo-agent/agents/run-task";
import { supabaseTaskStore } from "@/lib/seo-agent/agents/task-store";
import { analyzeArticleSeo, type SeoAnalysis } from "@/lib/seo-agent/agents/seo-analyst";
import { bodyTextWithoutHeadings, suggestInternalLinks } from "@/lib/seo-agent/agents/internal-linker";
import { getKnownInternalPaths, getLinkCandidates } from "@/lib/seo-agent/content-data";
import { replaceLinkSuggestions } from "@/lib/seo-agent/articles-persist";
import { articleFingerprint } from "@/lib/seo-agent/seo-checks";
import { extractLinks } from "@/lib/seo-agent/article-html";
import { inferClassAndSubject } from "@/lib/seo-agent/keywords";
import { CTA_DESTINATIONS } from "@/lib/seo-agent/site-pages";
import { CTA_TYPES } from "@/lib/seo-agent/constants";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = z.uuid();

interface ArticleRow {
  id: string; title: string; slug: string | null; meta_title: string | null; meta_description: string | null; excerpt: string | null;
  content_html: string; featured_image_url: string | null; featured_image_alt: string | null; primary_keyword: string | null;
  secondary_keywords: string[]; cta_type: string | null; current_version: number; status: string;
  seo_content_plans: { search_intent: string | null; target_audience: string | null } | null;
}

async function loadArticle(db: Awaited<ReturnType<typeof seoDb>>, id: string): Promise<ArticleRow | null> {
  const { data } = await db.from("seo_articles")
    .select(`id, title, slug, meta_title, meta_description, excerpt, content_html, featured_image_url, featured_image_alt,
      primary_keyword, secondary_keywords, cta_type, current_version, status, seo_content_plans(search_intent, target_audience)`)
    .eq("id", id).maybeSingle();
  return (data as unknown as ArticleRow | null) ?? null;
}

/** SEO Agent: deterministic checks + AI review → internal score, stored on the article. */
export async function runSeoCheck(articleId: string): Promise<Result<{ score: number }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };

  try {
    const db = await seoDb();
    const a = await loadArticle(db, articleId);
    if (!a) return { ok: false, error: "Article not found." };
    if (!a.primary_keyword) return { ok: false, error: "This article has no primary keyword to check against." };
    const { targetClass, subject } = inferClassAndSubject(`${a.primary_keyword} ${a.title}`);
    const [settings, knownInternalPaths, verified] = await Promise.all([
      getSeoSettings(), getKnownInternalPaths(db), getLinkCandidates(db, { targetClass, subject }),
    ]);
    const provider = createAIProvider(settings);
    const fingerprint = articleFingerprint(a);

    const analysis = await runAgentTask(
      {
        agentType: "SEOAgent", taskType: "seo_check", category: "SEO", entityType: "article", entityId: a.id,
        inputSummary: `"${a.title}" v${a.current_version} (${a.primary_keyword})`, createdBy: admin.id,
      },
      { store: supabaseTaskStore(db), provider, pricing: settings.aiPricing },
      async ({ ai }) => {
        const result: SeoAnalysis = await analyzeArticleSeo(ai, {
          checkInput: {
            title: a.title, metaTitle: a.meta_title ?? "", metaDescription: a.meta_description ?? "", slug: a.slug ?? "",
            excerpt: a.excerpt ?? "", html: a.content_html, primaryKeyword: a.primary_keyword!,
            featuredImageUrl: a.featured_image_url ?? "", featuredImageAlt: a.featured_image_alt ?? "", knownInternalPaths,
          },
          prompt: {
            brand: settings.brand,
            article: {
              title: a.title, metaTitle: a.meta_title ?? "", metaDescription: a.meta_description ?? "",
              primaryKeyword: a.primary_keyword!, secondaryKeywords: a.secondary_keywords,
              searchIntent: a.seo_content_plans?.search_intent ?? null, targetAudience: a.seo_content_plans?.target_audience ?? null,
              ctaType: a.cta_type,
            },
            ctaOptions: CTA_TYPES.map((type) => ({ type, label: CTA_DESTINATIONS[type].label, description: CTA_DESTINATIONS[type].description })),
            verifiedPages: verified.map(({ url, title }) => ({ url, title })),
          },
        }, { fingerprint, articleVersion: a.current_version, currentCta: a.cta_type });

        const { error } = await db.from("seo_articles").update({ seo_score: result.score, seo_analysis: result }).eq("id", a.id);
        if (error) throw new Error(`Saving SEO analysis: ${error.message}`);
        return {
          result,
          outputSummary: `Score ${result.score}/100 (internal); ${result.recommendations.length} recommendation(s), ${result.factIssues.length} fact issue(s)`
            + (result.critical.length ? `, ${result.critical.length} critical` : ""),
        };
      },
    );
    revalidatePath("/admin/seo-agent", "layout");
    return { ok: true, score: analysis.score };
  } catch (err) {
    seoLog.error("seo.check_failed", { articleId, error: errorMessage(err) });
    return { ok: false, error: `SEO check failed: ${errorMessage(err)}` };
  }
}

/** Internal Linking Agent: fresh link suggestions for the article (anchored on its own text). */
export async function findLinkSuggestions(articleId: string): Promise<Result<{ added: number; dropped: number }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };

  try {
    const db = await seoDb();
    const a = await loadArticle(db, articleId);
    if (!a) return { ok: false, error: "Article not found." };
    const settings = await getSeoSettings();
    const provider = createAIProvider(settings);
    const { targetClass, subject } = inferClassAndSubject(`${a.primary_keyword ?? ""} ${a.title}`);
    const candidates = (await getLinkCandidates(db, { targetClass, subject })).filter((c) => c.url !== `/blog/${a.slug}`);
    const alreadyLinked = extractLinks(a.content_html).map((l) => l.href);

    const out = await runAgentTask(
      {
        agentType: "InternalLinker", taskType: "suggest_internal_links", category: "SEO", entityType: "article", entityId: a.id,
        inputSummary: `"${a.title}"; ${candidates.length} candidate pages, ${alreadyLinked.length} existing links`, createdBy: admin.id,
      },
      { store: supabaseTaskStore(db), provider, pricing: settings.aiPricing },
      async ({ ai }) => {
        const { links, dropped } = await suggestInternalLinks(ai, {
          title: a.title, primaryKeyword: a.primary_keyword ?? a.title,
          bodyText: bodyTextWithoutHeadings(a.content_html), alreadyLinked, candidates,
        });
        const added = await replaceLinkSuggestions(db, a.id, a.content_html, links);
        return {
          result: { added, dropped: dropped.length },
          outputSummary: `${added} suggestion(s)${dropped.length ? `; ${dropped.length} rejected by validation (${dropped.slice(0, 3).join("; ")})` : ""}`,
        };
      },
    );
    revalidatePath("/admin/seo-agent", "layout");
    return { ok: true, ...out };
  } catch (err) {
    seoLog.error("seo.links_failed", { articleId, error: errorMessage(err) });
    return { ok: false, error: `Link suggestions failed: ${errorMessage(err)}` };
  }
}

/** Dismiss a suggestion; it is kept as REJECTED so it isn't suggested again. */
export async function dismissLinkSuggestion(linkId: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(linkId).success) return { ok: false, error: "Invalid suggestion." };
  const db = await seoDb();
  const { error } = await db.from("seo_article_links").update({ status: "REJECTED" }).eq("id", linkId).eq("status", "SUGGESTED");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/seo-agent", "layout");
  return { ok: true };
}
