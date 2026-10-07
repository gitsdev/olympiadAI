import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/slug";
import { throwIfDbError } from "./db";
import { extractCtas, extractLinks } from "./article-html";
import { BLOG_RESERVED_SLUGS } from "./articles";

/**
 * A slug free in both seo_articles (non-archived) and the live blog
 * (blog_posts), so publishing can never collide with an existing URL.
 */
export async function uniqueArticleSlug(db: SupabaseClient, wanted: string, excludeArticleId?: string): Promise<string> {
  const base = slugify(wanted) || "article";
  let candidate = BLOG_RESERVED_SLUGS.has(base) ? `${base}-guide` : base;
  for (let i = 2; i < 200; i++) {
    const [art, post] = await Promise.all([
      db.from("seo_articles").select("id").eq("slug", candidate).neq("status", "ARCHIVED").limit(2),
      db.from("blog_posts").select("id").eq("slug", candidate).limit(1),
    ]);
    throwIfDbError(art.error, "Checking article slugs");
    throwIfDbError(post.error, "Checking blog slugs");
    const clash = ((art.data ?? []) as { id: string }[]).some((r) => r.id !== excludeArticleId) || (post.data ?? []).length > 0;
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
  throw new Error("Could not find a free slug.");
}

export interface VersionSnapshot {
  title: string;
  content_html: string;
  metadata: Record<string, unknown>;
}

/** Appends a version (next number) and bumps seo_articles.current_version. */
export async function addArticleVersion(
  db: SupabaseClient,
  articleId: string,
  snapshot: VersionSnapshot,
  meta: { source: "AI_GENERATED" | "MANUAL_EDIT" | "RESTORE"; createdBy: string | null; agentTaskId?: string | null },
): Promise<number> {
  const { data: last, error: lastErr } = await db
    .from("seo_article_versions")
    .select("version_number")
    .eq("article_id", articleId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfDbError(lastErr, "Reading versions");
  const next = ((last as { version_number: number } | null)?.version_number ?? 0) + 1;

  const { error } = await db.from("seo_article_versions").insert({
    article_id: articleId,
    version_number: next,
    title: snapshot.title,
    content_html: snapshot.content_html,
    metadata: snapshot.metadata,
    source: meta.source,
    created_by: meta.createdBy,
    agent_task_id: meta.agentTaskId ?? null,
  });
  throwIfDbError(error, "Saving version");
  const { error: upErr } = await db.from("seo_articles").update({ current_version: next }).eq("id", articleId);
  throwIfDbError(upErr, "Updating current version");
  return next;
}

/**
 * Keeps seo_article_links / seo_article_ctas in step with what is actually in
 * the article body: links the editor placed are INSERTED; AI suggestions
 * that aren't in the body are kept as SUGGESTED.
 */
export async function syncArticleLinksAndCtas(
  db: SupabaseClient,
  articleId: string,
  html: string,
  opts: { source: "AI" | "MANUAL"; suggestions?: { url: string; anchorText: string; reason: string }[] },
): Promise<void> {
  const inBody = extractLinks(html);
  const inBodyUrls = new Set(inBody.map((l) => l.href));

  const { error: delErr } = await db.from("seo_article_links").delete().eq("article_id", articleId);
  throwIfDbError(delErr, "Resetting article links");

  const rows = [
    ...inBody.map((l) => ({
      article_id: articleId,
      target_url: l.href,
      target_type: l.href.startsWith("/") ? (l.href.startsWith("/blog/") ? "ARTICLE" : "FEATURE_PAGE") : "EXTERNAL",
      anchor_text: l.text || l.href,
      reason: opts.suggestions?.find((s) => s.url === l.href)?.reason ?? null,
      source: opts.source,
      status: "INSERTED",
    })),
    ...(opts.suggestions ?? []).filter((s) => !inBodyUrls.has(s.url)).map((s) => ({
      article_id: articleId,
      target_url: s.url,
      target_type: s.url.startsWith("/blog/") ? "ARTICLE" : "FEATURE_PAGE",
      anchor_text: s.anchorText,
      reason: s.reason,
      source: "AI",
      status: "SUGGESTED",
    })),
  ];
  if (rows.length) {
    const { error } = await db.from("seo_article_links").insert(rows);
    throwIfDbError(error, "Saving article links");
  }

  const ctas = extractCtas(html);
  const { error: ctaDel } = await db.from("seo_article_ctas").delete().eq("article_id", articleId);
  throwIfDbError(ctaDel, "Resetting article CTAs");
  if (ctas.length) {
    const { error } = await db.from("seo_article_ctas").insert(
      ctas.map((t, i) => ({ article_id: articleId, cta_type: t, placement: i === 0 ? "INLINE" : "END", selected_by: opts.source })),
    );
    throwIfDbError(error, "Saving article CTAs");
  }
}
