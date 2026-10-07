import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { seoDb, throwIfDbError } from "./db";
import { zonedDateString, zonedDayRange } from "./datetime";
import { STATIC_LINK_CANDIDATES, type LinkCandidate } from "./site-pages";
import type { OutlineSection, PlanInternalLink } from "./content-plans";

// ── Opportunities ────────────────────────────────────────────────────────

export interface OpportunityView {
  id: string;
  type: string;
  title: string | null;
  reason: string;
  cannibalizationRisk: string;
  source: string;
  status: string;
  createdAt: string;
  cluster: { id: string; name: string; primaryKeyword: string } | null;
  relatedPosts: { slug: string; title: string }[];
  plans: { id: string; title: string; status: string }[];
}

export async function listOpportunities(f: { status: string; type?: string }): Promise<OpportunityView[]> {
  const db = await seoDb();
  let q = db
    .from("seo_content_opportunities")
    .select(`id, type, title, reason, cannibalization_risk, source, status, created_at, related_blog_post_ids,
      seo_keyword_clusters(id, name, primary_keyword),
      seo_content_plans(id, title, status)`)
    .eq("status", f.status);
  if (f.type) q = q.eq("type", f.type);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  throwIfDbError(error, "Loading content opportunities");

  type Raw = {
    id: string; type: string; title: string | null; reason: string; cannibalization_risk: string; source: string;
    status: string; created_at: string; related_blog_post_ids: string[];
    seo_keyword_clusters: { id: string; name: string; primary_keyword: string } | null;
    seo_content_plans: { id: string; title: string; status: string }[];
  };
  const rows = (data ?? []) as unknown as Raw[];

  const postIds = [...new Set(rows.flatMap((r) => r.related_blog_post_ids))];
  const posts = new Map<string, { slug: string; title: string }>();
  if (postIds.length) {
    const { data: p, error: pErr } = await db.from("blog_posts").select("id, slug, title").in("id", postIds);
    throwIfDbError(pErr, "Loading related posts");
    for (const r of (p ?? []) as { id: string; slug: string; title: string }[]) posts.set(r.id, { slug: r.slug, title: r.title });
  }

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    reason: r.reason,
    cannibalizationRisk: r.cannibalization_risk,
    source: r.source,
    status: r.status,
    createdAt: r.created_at,
    cluster: r.seo_keyword_clusters
      ? { id: r.seo_keyword_clusters.id, name: r.seo_keyword_clusters.name, primaryKeyword: r.seo_keyword_clusters.primary_keyword }
      : null,
    relatedPosts: r.related_blog_post_ids.map((id) => posts.get(id)).filter((p): p is { slug: string; title: string } => Boolean(p)),
    plans: r.seo_content_plans ?? [],
  }));
}

export async function countOpenOpportunities(): Promise<Record<string, number>> {
  const db = await seoDb();
  const out: Record<string, number> = {};
  for (const status of ["OPEN", "ACCEPTED", "DISMISSED"]) {
    const { count, error } = await db.from("seo_content_opportunities").select("id", { count: "exact", head: true }).eq("status", status);
    throwIfDbError(error, "Counting opportunities");
    out[status] = count ?? 0;
  }
  return out;
}

// ── Planning context (for the Content Planner Agent) ─────────────────────

export interface PlanningContext {
  opportunity: { id: string; type: string; reason: string; status: string };
  cluster: {
    id: string; name: string; primaryKeyword: string; secondaryKeywords: string[]; questionKeywords: string[];
    searchIntent: string | null; recommendedTitle: string | null; targetClass: number | null; subject: string | null;
  };
  linkCandidates: LinkCandidate[];
}

function mostCommon<T>(items: (T | null)[]): T | null {
  const counts = new Map<T, number>();
  for (const i of items) if (i !== null) counts.set(i, (counts.get(i) ?? 0) + 1);
  let best: T | null = null;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return best;
}

export async function getPlanningContext(db: SupabaseClient, opportunityId: string): Promise<PlanningContext> {
  const { data, error } = await db
    .from("seo_content_opportunities")
    .select(`id, type, reason, status,
      seo_keyword_clusters(id, name, primary_keyword, secondary_keywords, question_keywords, search_intent, recommended_title,
        seo_keyword_cluster_members(seo_keywords(target_class, subject)))`)
    .eq("id", opportunityId)
    .maybeSingle();
  throwIfDbError(error, "Loading opportunity");
  if (!data) throw new Error("That opportunity no longer exists.");

  type Raw = {
    id: string; type: string; reason: string; status: string;
    seo_keyword_clusters: {
      id: string; name: string; primary_keyword: string; secondary_keywords: string[]; question_keywords: string[];
      search_intent: string | null; recommended_title: string | null;
      seo_keyword_cluster_members: { seo_keywords: { target_class: number | null; subject: string | null } | null }[];
    } | null;
  };
  const raw = data as unknown as Raw;
  const c = raw.seo_keyword_clusters;
  if (!c) throw new Error("This opportunity has no keyword cluster to plan from.");

  const kws = c.seo_keyword_cluster_members.map((m) => m.seo_keywords).filter((k): k is NonNullable<typeof k> => Boolean(k));
  const targetClass = mostCommon(kws.map((k) => k.target_class));
  const subject = mostCommon(kws.map((k) => k.subject));

  return {
    opportunity: { id: raw.id, type: raw.type, reason: raw.reason, status: raw.status },
    cluster: {
      id: c.id, name: c.name, primaryKeyword: c.primary_keyword, secondaryKeywords: c.secondary_keywords,
      questionKeywords: c.question_keywords, searchIntent: c.search_intent, recommendedTitle: c.recommended_title,
      targetClass, subject,
    },
    linkCandidates: await getLinkCandidates(db, { targetClass, subject }),
  };
}

/** Real, public OlympiadIQ pages an article may link to. */
export async function getLinkCandidates(db: SupabaseClient, f: { targetClass: number | null; subject: string | null }): Promise<LinkCandidate[]> {
  let topics = db.from("topic_pages").select("slug, topic_name, chapter_name, class_level, subject, summary").order("order_index").limit(40);
  if (f.targetClass) topics = topics.eq("class_level", f.targetClass);
  if (f.subject && ["Mathematics", "Science", "English", "General Knowledge", "Cyber"].includes(f.subject)) topics = topics.eq("subject", f.subject);

  const [posts, topicRes] = await Promise.all([
    db.from("blog_posts").select("slug, title, excerpt").eq("status", "published").order("published_at", { ascending: false }).limit(100),
    topics,
  ]);
  throwIfDbError(posts.error, "Loading blog posts for links");
  throwIfDbError(topicRes.error, "Loading topic pages for links");

  return [
    ...((posts.data ?? []) as { slug: string; title: string; excerpt: string }[]).map((p) => ({
      url: `/blog/${p.slug}`, title: p.title, kind: "BLOG_POST" as const, summary: p.excerpt?.slice(0, 200),
    })),
    ...((topicRes.data ?? []) as { slug: string; topic_name: string; chapter_name: string; class_level: number; subject: string; summary: string }[]).map((t) => ({
      url: `/learn/${t.slug}`, title: `${t.topic_name} (Class ${t.class_level} ${t.subject})`, kind: "TOPIC_PAGE" as const, summary: t.summary?.slice(0, 160),
    })),
    ...STATIC_LINK_CANDIDATES,
  ];
}

/** Days (YYYY-MM-DD in tz) from tomorrow on that already have an active plan. */
export async function getTakenPlanDates(db: SupabaseClient, tz: string, now = new Date()): Promise<string[]> {
  const { data, error } = await db
    .from("seo_content_plans")
    .select("planned_publish_at")
    .gte("planned_publish_at", zonedDayRange(now, tz, 1).start.toISOString())
    .not("status", "in", "(REJECTED,ARCHIVED)")
    .limit(1000);
  throwIfDbError(error, "Loading planned dates");
  return ((data ?? []) as { planned_publish_at: string }[]).map((r) => zonedDateString(new Date(r.planned_publish_at), tz));
}

// ── Plans ────────────────────────────────────────────────────────────────

export interface PlanSummary {
  id: string;
  title: string;
  primaryKeyword: string;
  status: string;
  plannedPublishAt: string | null;
}

const SUMMARY_COLS = "id, title, primary_keyword, status, planned_publish_at";
type SummaryRow = { id: string; title: string; primary_keyword: string; status: string; planned_publish_at: string | null };
const toSummary = (r: SummaryRow): PlanSummary => ({
  id: r.id, title: r.title, primaryKeyword: r.primary_keyword, status: r.status, plannedPublishAt: r.planned_publish_at,
});

export async function listPlansBetween(start: Date, end: Date): Promise<PlanSummary[]> {
  const db = await seoDb();
  const { data, error } = await db
    .from("seo_content_plans")
    .select(SUMMARY_COLS)
    .gte("planned_publish_at", start.toISOString())
    .lt("planned_publish_at", end.toISOString())
    .neq("status", "ARCHIVED")
    .order("planned_publish_at");
  throwIfDbError(error, "Loading content calendar");
  return ((data ?? []) as SummaryRow[]).map(toSummary);
}

export async function listUnscheduledPlans(): Promise<PlanSummary[]> {
  const db = await seoDb();
  const { data, error } = await db
    .from("seo_content_plans")
    .select(SUMMARY_COLS)
    .is("planned_publish_at", null)
    .not("status", "in", "(ARCHIVED,REJECTED)")
    .order("created_at", { ascending: false })
    .limit(100);
  throwIfDbError(error, "Loading unscheduled plans");
  return ((data ?? []) as SummaryRow[]).map(toSummary);
}

export interface PlanDetail {
  id: string;
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string | null;
  contentType: string | null;
  targetAudience: string | null;
  outline: OutlineSection[];
  recommendedCta: string | null;
  internalLinks: PlanInternalLink[];
  plannedPublishAt: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  cluster: { id: string; name: string } | null;
  opportunity: { type: string; reason: string } | null;
}

export async function getPlan(id: string): Promise<PlanDetail | null> {
  const db = await seoDb();
  const { data, error } = await db
    .from("seo_content_plans")
    .select(`id, title, primary_keyword, secondary_keywords, search_intent, content_type, target_audience, outline,
      recommended_cta, suggested_internal_links, planned_publish_at, status, notes, created_at,
      seo_keyword_clusters(id, name), seo_content_opportunities(type, reason)`)
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(error, "Loading content plan");
  if (!data) return null;

  type Raw = {
    id: string; title: string; primary_keyword: string; secondary_keywords: string[]; search_intent: string | null;
    content_type: string | null; target_audience: string | null; outline: OutlineSection[] | null; recommended_cta: string | null;
    suggested_internal_links: PlanInternalLink[] | null; planned_publish_at: string | null; status: string; notes: string | null;
    created_at: string; seo_keyword_clusters: { id: string; name: string } | null; seo_content_opportunities: { type: string; reason: string } | null;
  };
  const r = data as unknown as Raw;
  return {
    id: r.id, title: r.title, primaryKeyword: r.primary_keyword, secondaryKeywords: r.secondary_keywords,
    searchIntent: r.search_intent, contentType: r.content_type, targetAudience: r.target_audience,
    outline: Array.isArray(r.outline) ? r.outline : [], recommendedCta: r.recommended_cta,
    internalLinks: Array.isArray(r.suggested_internal_links) ? r.suggested_internal_links : [],
    plannedPublishAt: r.planned_publish_at, status: r.status, notes: r.notes, createdAt: r.created_at,
    cluster: r.seo_keyword_clusters, opportunity: r.seo_content_opportunities,
  };
}
