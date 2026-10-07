import "server-only";

import { seoDb, throwIfDbError } from "./db";

export interface ClusterView {
  id: string;
  name: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  questionKeywords: string[];
  searchIntent: string | null;
  recommendedTitle: string | null;
  status: string;
  updatedAt: string;
  members: { id: string; keyword: string; role: string }[];
  plans: { id: string; title: string; status: string }[];
  opportunity: {
    id: string;
    type: string;
    reason: string;
    cannibalizationRisk: string;
    relatedPosts: { slug: string; title: string }[];
  } | null;
}

export const CLUSTERS_LIMIT = 200;

export async function listClusters(status: "ACTIVE" | "ARCHIVED"): Promise<ClusterView[]> {
  const db = await seoDb();
  const { data, error } = await db
    .from("seo_keyword_clusters")
    .select(`id, name, primary_keyword, secondary_keywords, question_keywords, search_intent, recommended_title, status, updated_at,
      seo_keyword_cluster_members(role, seo_keywords(id, keyword)),
      seo_content_opportunities(id, type, reason, cannibalization_risk, related_blog_post_ids, status, created_at),
      seo_content_plans(id, title, status)`)
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .limit(CLUSTERS_LIMIT);
  throwIfDbError(error, "Loading clusters");

  type Raw = {
    id: string; name: string; primary_keyword: string; secondary_keywords: string[]; question_keywords: string[];
    search_intent: string | null; recommended_title: string | null; status: string; updated_at: string;
    seo_keyword_cluster_members: { role: string; seo_keywords: { id: string; keyword: string } | null }[];
    seo_content_opportunities: { id: string; type: string; reason: string; cannibalization_risk: string; related_blog_post_ids: string[]; status: string; created_at: string }[];
    seo_content_plans: { id: string; title: string; status: string }[];
  };
  const raw = (data ?? []) as unknown as Raw[];

  // Newest open recommendation per cluster.
  const latest = new Map(raw.map((c) => [
    c.id,
    c.seo_content_opportunities.filter((o) => o.status === "OPEN").sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
  ]));

  const postIds = [...new Set([...latest.values()].flatMap((o) => o?.related_blog_post_ids ?? []))];
  const posts = new Map<string, { slug: string; title: string }>();
  if (postIds.length) {
    const { data: rows, error: postErr } = await db.from("blog_posts").select("id, slug, title").in("id", postIds);
    throwIfDbError(postErr, "Loading related posts");
    for (const p of (rows ?? []) as { id: string; slug: string; title: string }[]) posts.set(p.id, { slug: p.slug, title: p.title });
  }

  const roleOrder: Record<string, number> = { PRIMARY: 0, SECONDARY: 1, QUESTION: 2 };
  return raw.map((c) => {
    const opp = latest.get(c.id);
    return {
      id: c.id,
      name: c.name,
      primaryKeyword: c.primary_keyword,
      secondaryKeywords: c.secondary_keywords,
      questionKeywords: c.question_keywords,
      searchIntent: c.search_intent,
      recommendedTitle: c.recommended_title,
      status: c.status,
      updatedAt: c.updated_at,
      members: c.seo_keyword_cluster_members
        .filter((m) => m.seo_keywords)
        .map((m) => ({ id: m.seo_keywords!.id, keyword: m.seo_keywords!.keyword, role: m.role }))
        .sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9) || a.keyword.localeCompare(b.keyword)),
      plans: (c.seo_content_plans ?? []).filter((p) => p.status !== "ARCHIVED"),
      opportunity: opp
        ? {
            id: opp.id,
            type: opp.type,
            reason: opp.reason,
            cannibalizationRisk: opp.cannibalization_risk,
            relatedPosts: opp.related_blog_post_ids.map((id) => posts.get(id)).filter((p): p is { slug: string; title: string } => Boolean(p)),
          }
        : null,
    };
  });
}
