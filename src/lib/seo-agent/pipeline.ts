import "server-only";

// The SEO Agent's AI steps as plain functions: keyword analysis, content
// planning, article writing, SEO check, link suggestions. Admin server
// actions call them with the session (RLS) client; cron calls them with
// the service-role client. Nothing here checks who the caller is; callers
// authenticate first.

import type { SupabaseClient } from "@supabase/supabase-js";
import { throwIfDbError } from "./db";
import type { SeoSettings } from "./settings-schema";
import { createAIProvider } from "./ai";
import { runAgentTask } from "./agents/run-task";
import { supabaseTaskStore } from "./agents/task-store";
import { analyzeKeywords } from "./agents/keyword-analysis";
import { planContent } from "./agents/content-planner";
import { writeArticle, type ProcessedArticle } from "./agents/content-writer";
import { analyzeArticleSeo, type SeoAnalysis } from "./agents/seo-analyst";
import { bodyTextWithoutHeadings, suggestInternalLinks } from "./agents/internal-linker";
import { getAnalysisContext, getKeywordsForAnalysis } from "./keywords-data";
import { persistKeywordAnalysis, type SavedCluster } from "./clusters-persist";
import { getKnownInternalPaths, getLinkCandidates, getPlanningContext, getTakenPlanDates } from "./content-data";
import { addArticleVersion, replaceLinkSuggestions, syncArticleLinksAndCtas, uniqueArticleSlug } from "./articles-persist";
import { versionMetadata } from "./articles";
import { nextFreePublishDate, type OutlineSection, type PlanInternalLink } from "./content-plans";
import { articleFingerprint } from "./seo-checks";
import { extractLinks } from "./article-html";
import { inferClassAndSubject } from "./keywords";
import { CTA_DESTINATIONS } from "./site-pages";
import { CTA_TYPES, type CtaType } from "./constants";
import { zonedDateString } from "./datetime";

/** Who started the work: an admin (USER) or the scheduler (CRON). */
export interface Actor {
  createdBy: string | null;
  triggeredBy: "USER" | "CRON" | "SYSTEM";
}

/** An expected, user-facing failure (e.g. "already has an article"); not a crash. */
export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineError";
  }
}

const ctaOptions = () => CTA_TYPES.map((type) => ({ type, label: CTA_DESTINATIONS[type].label, description: CTA_DESTINATIONS[type].description }));

// ── Keyword analysis ─────────────────────────────────────────────────────

export interface AnalysisSummary {
  clusters: SavedCluster[];
  warnings: string[];
}

export async function analyzeKeywordsCore(db: SupabaseClient, settings: SeoSettings, ids: string[], actor: Actor): Promise<AnalysisSummary> {
  const keywords = await getKeywordsForAnalysis(db, ids);
  if (keywords.length === 0) throw new PipelineError("None of the selected keywords can be analysed (archived or deleted).");
  const context = await getAnalysisContext(db);
  // Throws before any task is created if the provider isn't configured.
  const provider = createAIProvider(settings);

  return runAgentTask(
    {
      agentType: "KeywordAgent", taskType: "analyze_keywords", category: "KEYWORD_ANALYSIS", entityType: "keyword",
      entityId: keywords.length === 1 ? keywords[0].id : undefined,
      inputSummary: `${keywords.length} keyword(s): ${keywords.map((k) => k.keyword).join(", ")}`,
      createdBy: actor.createdBy, triggeredBy: actor.triggeredBy,
    },
    { store: supabaseTaskStore(db), provider, pricing: settings.aiPricing },
    async ({ ai, taskId }) => {
      const analysis = await analyzeKeywords(ai, { brand: settings.brand, keywords, ...context });
      const clusters = await persistKeywordAnalysis(db, analysis, taskId);
      return {
        result: { clusters, warnings: analysis.warnings },
        outputSummary: `${clusters.length} cluster(s): ${clusters.map((c) => `${c.name} → "${c.recommendedTitle}" (${c.opportunityType})`).join("; ")}`
          + (analysis.warnings.length ? ` | ${analysis.warnings.length} warning(s)` : ""),
      };
    },
  );
}

// ── Content planning ─────────────────────────────────────────────────────

/** Plans a NEW_ARTICLE opportunity. Dated `publishAt`, or the next free day. */
export async function planOpportunityCore(
  db: SupabaseClient, settings: SeoSettings, opportunityId: string, actor: Actor, opts: { publishAt?: Date } = {},
): Promise<{ planId: string; warnings: string[]; publishAt: Date }> {
  const ctx = await getPlanningContext(db, opportunityId);
  if (ctx.opportunity.type !== "NEW_ARTICLE") {
    throw new PipelineError("Only NEW_ARTICLE recommendations become new content plans. Updating existing posts comes in a later phase.");
  }
  if (ctx.opportunity.status !== "OPEN") throw new PipelineError("This recommendation has already been handled.");
  const provider = createAIProvider(settings);

  return runAgentTask(
    {
      agentType: "ContentPlanner", taskType: "create_content_plan", category: "CONTENT", entityType: "content_plan",
      inputSummary: `Cluster "${ctx.cluster.name}" (${ctx.cluster.primaryKeyword}); ${ctx.linkCandidates.length} link candidates`,
      createdBy: actor.createdBy, triggeredBy: actor.triggeredBy,
    },
    { store: supabaseTaskStore(db), provider, pricing: settings.aiPricing },
    async ({ ai }) => {
      const plan = await planContent(ai, {
        brand: settings.brand, cluster: ctx.cluster, opportunityReason: ctx.opportunity.reason,
        linkCandidates: ctx.linkCandidates, ctaOptions: ctaOptions(),
      });
      const publishAt = opts.publishAt
        ?? nextFreePublishDate(await getTakenPlanDates(db, settings.timezone), new Date(), settings.timezone, settings.defaultPublishTime);
      const { data, error } = await db.from("seo_content_plans").insert({
        cluster_id: ctx.cluster.id,
        opportunity_id: ctx.opportunity.id,
        title: plan.title,
        primary_keyword: ctx.cluster.primaryKeyword,
        secondary_keywords: plan.secondaryKeywords,
        search_intent: plan.searchIntent,
        content_type: plan.contentType,
        target_audience: plan.targetAudience,
        outline: plan.outline,
        recommended_cta: plan.recommendedCta,
        suggested_internal_links: plan.internalLinks,
        planned_publish_at: publishAt.toISOString(),
        status: "PLANNED",
        notes: plan.notes || null,
        created_by: actor.createdBy,
      }).select("id").single();
      if (error) throw new Error(`Saving plan: ${error.message}`);
      const planId = (data as { id: string }).id;

      const { error: oppErr } = await db.from("seo_content_opportunities").update({ status: "ACCEPTED" }).eq("id", ctx.opportunity.id);
      if (oppErr) throw new Error(`Updating opportunity: ${oppErr.message}`);

      return {
        result: { planId, warnings: plan.warnings, publishAt },
        entityId: planId,
        outputSummary: `"${plan.title}": ${plan.outline.length} sections, ${plan.internalLinks.length} internal links, CTA ${plan.recommendedCta}, planned ${zonedDateString(publishAt, settings.timezone)}`
          + (plan.warnings.length ? ` | ${plan.warnings.length} warning(s)` : ""),
      };
    },
  );
}

// ── Article writing ──────────────────────────────────────────────────────

/** A GENERATING claim older than this is treated as a crashed run and may be retried. */
export const STALE_GENERATION_MS = 15 * 60_000;

export interface PlanRow {
  id: string; title: string; primary_keyword: string; secondary_keywords: string[]; search_intent: string | null;
  content_type: string | null; target_audience: string | null; outline: OutlineSection[] | null; recommended_cta: string | null;
  suggested_internal_links: PlanInternalLink[] | null; notes: string | null; status: string;
}

export const PLAN_COLS = "id, title, primary_keyword, secondary_keywords, search_intent, content_type, target_audience, outline, recommended_cta, suggested_internal_links, notes, status";

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
export async function runWriter(
  db: SupabaseClient,
  settings: SeoSettings,
  plan: PlanRow,
  actor: Actor,
  opts: { taskType: string; articleId?: string; persist: (draft: ProcessedArticle, taskId: string) => Promise<string> },
): Promise<{ articleId: string; flags: number; words: number }> {
  const provider = createAIProvider(settings);
  const ctaType = (plan.recommended_cta ?? settings.defaultCta) as CtaType;
  const links = Array.isArray(plan.suggested_internal_links) ? plan.suggested_internal_links : [];

  return runAgentTask(
    {
      agentType: "ContentWriter", taskType: opts.taskType, category: "CONTENT", entityType: "article", entityId: opts.articleId,
      inputSummary: `Plan "${plan.title}" (${plan.primary_keyword}); ${(plan.outline ?? []).length} sections, ${links.length} links, CTA ${ctaType}`,
      createdBy: actor.createdBy, triggeredBy: actor.triggeredBy,
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

/** Plan → new AI draft article (DRAFT, version 1). Claims the plan so two writers can't run at once. */
export async function generateArticleCore(db: SupabaseClient, settings: SeoSettings, planId: string, actor: Actor): Promise<{ articleId: string; words: number; flags: number }> {
  const staleBefore = new Date(Date.now() - STALE_GENERATION_MS).toISOString();
  const { data: before } = await db.from("seo_content_plans").select("status").eq("id", planId).maybeSingle();
  const prevStatus = (before as { status: string } | null)?.status;
  if (!prevStatus) throw new PipelineError("Plan not found.");
  const { data: claimed, error: claimErr } = await db
    .from("seo_content_plans")
    .update({ status: "GENERATING" })
    .eq("id", planId)
    .or(`status.in.(IDEA,PLANNED),and(status.eq.GENERATING,updated_at.lt.${staleBefore})`)
    .select(PLAN_COLS)
    .maybeSingle();
  if (claimErr) throw new Error(claimErr.message);
  if (!claimed) throw new PipelineError(prevStatus === "GENERATING" ? "This article is already being generated." : "This plan already has an article.");
  const plan = claimed as PlanRow;
  const restoreStatus = prevStatus === "GENERATING" ? "PLANNED" : prevStatus;

  try {
    return await runWriter(db, settings, plan, actor, {
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
          created_by: actor.createdBy,
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
  } catch (err) {
    await db.from("seo_content_plans").update({ status: restoreStatus }).eq("id", planId).eq("status", "GENERATING");
    throw err;
  }
}

// ── SEO check + link suggestions ─────────────────────────────────────────

interface ReviewArticleRow {
  id: string; title: string; slug: string | null; meta_title: string | null; meta_description: string | null; excerpt: string | null;
  content_html: string; featured_image_url: string | null; featured_image_alt: string | null; primary_keyword: string | null;
  secondary_keywords: string[]; cta_type: string | null; current_version: number; status: string;
  seo_content_plans: { search_intent: string | null; target_audience: string | null } | null;
}

async function loadReviewArticle(db: SupabaseClient, id: string): Promise<ReviewArticleRow> {
  const { data, error } = await db.from("seo_articles")
    .select(`id, title, slug, meta_title, meta_description, excerpt, content_html, featured_image_url, featured_image_alt,
      primary_keyword, secondary_keywords, cta_type, current_version, status, seo_content_plans(search_intent, target_audience)`)
    .eq("id", id).maybeSingle();
  throwIfDbError(error, "Loading article");
  if (!data) throw new PipelineError("Article not found.");
  return data as unknown as ReviewArticleRow;
}

/** SEO Agent: deterministic checks + AI review → internal score, stored on the article. */
export async function seoCheckCore(db: SupabaseClient, settings: SeoSettings, articleId: string, actor: Actor): Promise<SeoAnalysis> {
  const a = await loadReviewArticle(db, articleId);
  if (!a.primary_keyword) throw new PipelineError("This article has no primary keyword to check against.");
  const { targetClass, subject } = inferClassAndSubject(`${a.primary_keyword} ${a.title}`);
  const [knownInternalPaths, verified] = await Promise.all([getKnownInternalPaths(db), getLinkCandidates(db, { targetClass, subject })]);
  const provider = createAIProvider(settings);

  return runAgentTask(
    {
      agentType: "SEOAgent", taskType: "seo_check", category: "SEO", entityType: "article", entityId: a.id,
      inputSummary: `"${a.title}" v${a.current_version} (${a.primary_keyword})`, createdBy: actor.createdBy, triggeredBy: actor.triggeredBy,
    },
    { store: supabaseTaskStore(db), provider, pricing: settings.aiPricing },
    async ({ ai }) => {
      const result = await analyzeArticleSeo(ai, {
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
          ctaOptions: ctaOptions(),
          verifiedPages: verified.map(({ url, title }) => ({ url, title })),
        },
      }, { fingerprint: articleFingerprint(a), articleVersion: a.current_version, currentCta: a.cta_type });

      const { error } = await db.from("seo_articles").update({ seo_score: result.score, seo_analysis: result }).eq("id", a.id);
      if (error) throw new Error(`Saving SEO analysis: ${error.message}`);
      return {
        result,
        outputSummary: `Score ${result.score}/100 (internal); ${result.recommendations.length} recommendation(s), ${result.factIssues.length} fact issue(s)`
          + (result.critical.length ? `, ${result.critical.length} critical` : ""),
      };
    },
  );
}

/** Internal Linking Agent: fresh link suggestions anchored on the article's own text. */
export async function linkSuggestionsCore(db: SupabaseClient, settings: SeoSettings, articleId: string, actor: Actor): Promise<{ added: number; dropped: number }> {
  const a = await loadReviewArticle(db, articleId);
  const provider = createAIProvider(settings);
  const { targetClass, subject } = inferClassAndSubject(`${a.primary_keyword ?? ""} ${a.title}`);
  const candidates = (await getLinkCandidates(db, { targetClass, subject })).filter((c) => c.url !== `/blog/${a.slug}`);
  const alreadyLinked = extractLinks(a.content_html).map((l) => l.href);

  return runAgentTask(
    {
      agentType: "InternalLinker", taskType: "suggest_internal_links", category: "SEO", entityType: "article", entityId: a.id,
      inputSummary: `"${a.title}"; ${candidates.length} candidate pages, ${alreadyLinked.length} existing links`,
      createdBy: actor.createdBy, triggeredBy: actor.triggeredBy,
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
}
