import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProcessedAnalysis } from "./agents/keyword-analysis";
import { throwIfDbError } from "./db";

export interface SavedCluster {
  id: string;
  name: string;
  recommendedTitle: string;
  opportunityType: string;
  merged: boolean;
}

/** a ∪ b, case-insensitive, keeping a's order first. */
function union(a: string[], b: string[]): string[] {
  const out = [...a];
  const seen = new Set(a.map((s) => s.toLowerCase()));
  for (const s of b) {
    if (seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}

/**
 * Saves a validated keyword analysis. Re-analysed keywords move to their new
 * cluster; clusters left with no keywords are archived; each cluster's
 * previous open recommendation is replaced by the new one.
 */
export async function persistKeywordAnalysis(db: SupabaseClient, analysis: ProcessedAnalysis, taskId: string): Promise<SavedCluster[]> {
  const saved: SavedCluster[] = [];
  const touchedOldClusters = new Set<string>();

  for (const c of analysis.clusters) {
    let clusterId: string;

    if (c.existingClusterId) {
      const { data: existing, error } = await db
        .from("seo_keyword_clusters")
        .select("secondary_keywords, question_keywords")
        .eq("id", c.existingClusterId)
        .single();
      throwIfDbError(error, "Loading existing cluster");
      const ex = existing as { secondary_keywords: string[]; question_keywords: string[] };
      const { error: upErr } = await db.from("seo_keyword_clusters").update({
        secondary_keywords: union(ex.secondary_keywords, c.secondaryKeywords).slice(0, 25),
        question_keywords: union(ex.question_keywords, c.questionKeywords).slice(0, 15),
        search_intent: c.searchIntent,
        recommended_title: c.recommendedTitle,
        agent_task_id: taskId,
        status: "ACTIVE",
      }).eq("id", c.existingClusterId);
      throwIfDbError(upErr, "Updating cluster");
      clusterId = c.existingClusterId;
    } else {
      const { data, error } = await db.from("seo_keyword_clusters").insert({
        name: c.name,
        primary_keyword_id: c.primaryKeywordId,
        primary_keyword: c.primaryKeyword,
        secondary_keywords: c.secondaryKeywords,
        question_keywords: c.questionKeywords,
        search_intent: c.searchIntent,
        recommended_title: c.recommendedTitle,
        agent_task_id: taskId,
      }).select("id").single();
      throwIfDbError(error, "Creating cluster");
      clusterId = (data as { id: string }).id;
    }

    const keywordIds = c.members.map((m) => m.keywordId);

    // Move keywords out of any other cluster they belonged to.
    const { data: oldLinks, error: oldErr } = await db
      .from("seo_keyword_cluster_members")
      .select("cluster_id")
      .in("keyword_id", keywordIds)
      .neq("cluster_id", clusterId);
    throwIfDbError(oldErr, "Loading old cluster memberships");
    for (const l of (oldLinks ?? []) as { cluster_id: string }[]) touchedOldClusters.add(l.cluster_id);
    if (oldLinks?.length) {
      const { error } = await db.from("seo_keyword_cluster_members").delete().in("keyword_id", keywordIds).neq("cluster_id", clusterId);
      throwIfDbError(error, "Moving keywords between clusters");
    }

    const { error: memErr } = await db.from("seo_keyword_cluster_members").upsert(
      c.members.map((m) => ({ cluster_id: clusterId, keyword_id: m.keywordId, role: m.role })),
      { onConflict: "cluster_id,keyword_id" },
    );
    throwIfDbError(memErr, "Saving cluster members");

    // One open keyword-analysis recommendation per cluster: replace the old one.
    const { error: dismissErr } = await db.from("seo_content_opportunities")
      .update({ status: "DISMISSED" })
      .eq("cluster_id", clusterId).eq("source", "KEYWORD_ANALYSIS").eq("status", "OPEN");
    throwIfDbError(dismissErr, "Replacing old recommendation");
    const { error: oppErr } = await db.from("seo_content_opportunities").insert({
      cluster_id: clusterId,
      type: c.opportunity.type,
      title: c.recommendedTitle,
      reason: c.opportunity.reason,
      related_blog_post_ids: c.opportunity.relatedBlogPostIds,
      cannibalization_risk: c.opportunity.cannibalizationRisk,
      source: "KEYWORD_ANALYSIS",
      agent_task_id: taskId,
    });
    throwIfDbError(oppErr, "Saving recommendation");

    saved.push({ id: clusterId, name: c.name, recommendedTitle: c.recommendedTitle, opportunityType: c.opportunity.type, merged: Boolean(c.existingClusterId) });
  }

  // Archive clusters that lost all their keywords.
  const savedIds = new Set(saved.map((s) => s.id));
  for (const oldId of touchedOldClusters) {
    if (savedIds.has(oldId)) continue;
    const { count, error } = await db.from("seo_keyword_cluster_members").select("keyword_id", { count: "exact", head: true }).eq("cluster_id", oldId);
    throwIfDbError(error, "Checking emptied cluster");
    if ((count ?? 0) === 0) {
      const { error: arcErr } = await db.from("seo_keyword_clusters").update({ status: "ARCHIVED" }).eq("id", oldId);
      throwIfDbError(arcErr, "Archiving emptied cluster");
    }
  }

  // Fill in intent only where the admin hasn't set one.
  for (const i of analysis.intents) {
    const { error } = await db.from("seo_keywords").update({ search_intent: i.searchIntent }).eq("id", i.keywordId).is("search_intent", null);
    throwIfDbError(error, "Saving keyword intent");
  }

  return saved;
}
