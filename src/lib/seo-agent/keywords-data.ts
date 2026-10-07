import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { seoDb, throwIfDbError } from "./db";
import type { AnalysisKeyword, ExistingCluster, ExistingContent } from "./agents/keyword-analysis";

export const KEYWORDS_PAGE_SIZE = 50;

export interface KeywordRow {
  id: string;
  keyword: string;
  search_intent: string | null;
  target_class: number | null;
  subject: string | null;
  priority: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  clusters: { id: string; name: string; role: string }[];
}

export interface KeywordFilters {
  q?: string;
  status?: string;
  priority?: string;
  subject?: string;
  targetClass?: number;
  clustered?: "yes" | "no";
  page: number;
}

/** Escapes LIKE wildcards in user search text. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listKeywords(f: KeywordFilters): Promise<{ rows: KeywordRow[]; count: number }> {
  const db = await seoDb();
  let q = db
    .from("seo_keywords_overview")
    .select("id, keyword, search_intent, target_class, subject, priority, status, notes, created_at, updated_at, clusters", { count: "exact" });

  if (f.q) q = q.ilike("keyword", `%${escapeLike(f.q)}%`);
  if (f.status) q = q.eq("status", f.status);
  else q = q.neq("status", "ARCHIVED");
  if (f.priority) q = q.eq("priority", f.priority);
  if (f.subject) q = q.eq("subject", f.subject);
  if (f.targetClass) q = q.eq("target_class", f.targetClass);
  if (f.clustered) q = q.eq("is_clustered", f.clustered === "yes");

  const from = (f.page - 1) * KEYWORDS_PAGE_SIZE;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + KEYWORDS_PAGE_SIZE - 1);
  throwIfDbError(error, "Loading keywords");
  return { rows: (data ?? []) as KeywordRow[], count: count ?? 0 };
}

export async function getKeywordsForAnalysis(db: SupabaseClient, ids: string[]): Promise<AnalysisKeyword[]> {
  const { data, error } = await db
    .from("seo_keywords")
    .select("id, keyword, target_class, subject")
    .in("id", ids)
    .neq("status", "ARCHIVED");
  throwIfDbError(error, "Loading keywords for analysis");
  return ((data ?? []) as { id: string; keyword: string; target_class: number | null; subject: string | null }[])
    .map((k) => ({ id: k.id, keyword: k.keyword, targetClass: k.target_class, subject: k.subject }));
}

/** Everything the agent should know already exists, to avoid cannibalisation. */
export async function getAnalysisContext(db: SupabaseClient): Promise<{ existingContent: ExistingContent[]; existingClusters: ExistingCluster[] }> {
  const [posts, articles, clusters] = await Promise.all([
    db.from("blog_posts").select("id, slug, title").eq("status", "published").order("published_at", { ascending: false }).limit(300),
    db.from("seo_articles").select("slug, title, primary_keyword").not("status", "in", "(ARCHIVED,REJECTED,PUBLISHED)").limit(200),
    db.from("seo_keyword_clusters").select("id, name, primary_keyword").eq("status", "ACTIVE").limit(300),
  ]);
  throwIfDbError(posts.error, "Loading blog posts");
  throwIfDbError(articles.error, "Loading draft articles");
  throwIfDbError(clusters.error, "Loading clusters");

  const existingContent: ExistingContent[] = [
    ...((posts.data ?? []) as { id: string; slug: string; title: string }[]).map((p) => ({ slug: p.slug, title: p.title, source: "blog" as const, blogPostId: p.id })),
    ...((articles.data ?? []) as { slug: string | null; title: string; primary_keyword: string | null }[])
      .filter((a) => a.slug)
      .map((a) => ({ slug: a.slug!, title: a.title, primaryKeyword: a.primary_keyword, source: "draft" as const })),
  ];
  const existingClusters = ((clusters.data ?? []) as { id: string; name: string; primary_keyword: string }[])
    .map((c) => ({ id: c.id, name: c.name, primaryKeyword: c.primary_keyword }));
  return { existingContent, existingClusters };
}
