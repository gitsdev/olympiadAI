// Keyword Analysis Agent (spec §7): keywords → clusters + recommendations.
//
// Normalisation and de-duplication are done in code (deterministic); the AI
// does intent, grouping and recommendations; postProcessAnalysis() then
// checks the AI's answer against reality (only real input keywords, only real
// slugs) before anything is saved.

import { z } from "zod";
import type { AIProvider } from "../ai/types";
import { keywordAnalysisPrompt, type KeywordAnalysisPromptInput } from "../ai/prompts/keyword-analysis";
import { SEARCH_INTENTS, type SearchIntent } from "../constants";
import { dedupeKeywords, normalizeKeyword } from "../keywords";

export const OPPORTUNITY_TYPES = ["NEW_ARTICLE", "UPDATE_EXISTING", "MERGE_ARTICLES", "NO_ACTION"] as const;
export const CANNIBALIZATION_RISKS = ["NONE", "LOW", "MEDIUM", "HIGH"] as const;

const kw = z.string().trim().min(1).max(200);

export const keywordAnalysisSchema = z.object({
  clusters: z.array(z.object({
    name: z.string().trim().min(3).max(120),
    primaryKeyword: kw,
    searchIntent: z.enum(SEARCH_INTENTS),
    memberKeywords: z.array(kw).min(1).max(50),
    secondaryKeywords: z.array(kw).max(15),
    questionKeywords: z.array(kw).max(10),
    recommendedTitle: z.string().trim().min(10).max(120),
    recommendation: z.object({
      type: z.enum(OPPORTUNITY_TYPES),
      reason: z.string().trim().min(10).max(800),
      relatedSlugs: z.array(z.string().trim()).max(5),
      cannibalizationRisk: z.enum(CANNIBALIZATION_RISKS),
    }),
  })).min(1).max(25),
  keywordIntents: z.array(z.object({ keyword: kw, searchIntent: z.enum(SEARCH_INTENTS) })).max(60),
});
export type KeywordAnalysis = z.infer<typeof keywordAnalysisSchema>;

export interface AnalysisKeyword {
  id: string;
  keyword: string;
  targetClass: number | null;
  subject: string | null;
}

export interface ExistingContent {
  slug: string;
  title: string;
  primaryKeyword?: string | null;
  source: "blog" | "draft";
  blogPostId?: string;
}

export interface ExistingCluster {
  id: string;
  name: string;
  primaryKeyword: string;
}

export interface PlannedMember {
  keywordId: string;
  role: "PRIMARY" | "SECONDARY" | "QUESTION";
}

export interface PlannedCluster {
  /** Set when the AI's cluster matches an existing active cluster (merge). */
  existingClusterId: string | null;
  name: string;
  primaryKeyword: string;
  primaryKeywordId: string;
  searchIntent: SearchIntent;
  secondaryKeywords: string[];
  questionKeywords: string[];
  recommendedTitle: string;
  members: PlannedMember[];
  opportunity: {
    type: (typeof OPPORTUNITY_TYPES)[number];
    reason: string;
    relatedBlogPostIds: string[];
    cannibalizationRisk: (typeof CANNIBALIZATION_RISKS)[number];
  };
}

export interface ProcessedAnalysis {
  clusters: PlannedCluster[];
  intents: { keywordId: string; searchIntent: SearchIntent }[];
  warnings: string[];
}

const QUESTION_START = /^(how|what|which|why|when|where|who|is|are|can|should|does|do)\b/i;

function uniqueStrings(items: string[], exclude: Set<string>): string[] {
  const seen = new Set(exclude);
  const out: string[] = [];
  for (const raw of items) {
    const key = normalizeKeyword(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw.replace(/\s+/g, " ").trim());
  }
  return out;
}

/**
 * Validates the AI's analysis against the real inputs. Drops anything that
 * references keywords or slugs we never gave it, and records why.
 */
export function postProcessAnalysis(
  analysis: KeywordAnalysis,
  keywords: AnalysisKeyword[],
  existingContent: ExistingContent[],
  existingClusters: ExistingCluster[],
): ProcessedAnalysis {
  const warnings: string[] = [];
  const byNorm = new Map(keywords.map((k) => [normalizeKeyword(k.keyword), k]));
  const slugToBlogId = new Map(existingContent.filter((c) => c.blogPostId).map((c) => [c.slug, c.blogPostId!]));
  const knownSlugs = new Set(existingContent.map((c) => c.slug));
  const clusterByPrimary = new Map(existingClusters.map((c) => [normalizeKeyword(c.primaryKeyword), c]));
  const assigned = new Set<string>();
  const clusters: PlannedCluster[] = [];

  for (const c of analysis.clusters) {
    const members: AnalysisKeyword[] = [];
    for (const m of c.memberKeywords) {
      const match = byNorm.get(normalizeKeyword(m));
      if (!match) {
        warnings.push(`Ignored "${m}" in cluster "${c.name}": not one of the submitted keywords.`);
      } else if (!assigned.has(match.id)) {
        assigned.add(match.id);
        members.push(match);
      }
    }
    if (members.length === 0) {
      warnings.push(`Dropped cluster "${c.name}": none of its keywords were submitted keywords.`);
      continue;
    }

    let primary = members.find((m) => normalizeKeyword(m.keyword) === normalizeKeyword(c.primaryKeyword));
    let secondary = c.secondaryKeywords;
    if (!primary) {
      primary = members[0];
      warnings.push(`Cluster "${c.name}": primary keyword "${c.primaryKeyword}" was not a member; using "${primary.keyword}" instead.`);
      secondary = [c.primaryKeyword, ...secondary];
    }

    const questionNorms = new Set(c.questionKeywords.map(normalizeKeyword));
    const memberRoles: PlannedMember[] = members.map((m) => ({
      keywordId: m.id,
      role: m.id === primary!.id ? "PRIMARY" : questionNorms.has(normalizeKeyword(m.keyword)) || QUESTION_START.test(m.keyword) ? "QUESTION" : "SECONDARY",
    }));

    const relatedSlugs = c.recommendation.relatedSlugs.filter((s) => {
      if (knownSlugs.has(s)) return true;
      warnings.push(`Cluster "${c.name}": removed unknown related slug "${s}".`);
      return false;
    });
    let type = c.recommendation.type;
    if ((type === "UPDATE_EXISTING" || type === "MERGE_ARTICLES") && relatedSlugs.length === 0) {
      warnings.push(`Cluster "${c.name}": AI suggested ${type} but named no real existing page; treating as NEW_ARTICLE.`);
      type = "NEW_ARTICLE";
    }

    const primaryNorm = normalizeKeyword(primary.keyword);
    clusters.push({
      existingClusterId: clusterByPrimary.get(primaryNorm)?.id ?? null,
      name: c.name,
      primaryKeyword: primary.keyword,
      primaryKeywordId: primary.id,
      searchIntent: c.searchIntent,
      secondaryKeywords: uniqueStrings(secondary, new Set([primaryNorm])).slice(0, 15),
      questionKeywords: uniqueStrings(c.questionKeywords, new Set([primaryNorm])).slice(0, 10),
      recommendedTitle: c.recommendedTitle,
      members: memberRoles,
      opportunity: {
        type,
        reason: c.recommendation.reason,
        relatedBlogPostIds: relatedSlugs.map((s) => slugToBlogId.get(s)).filter((id): id is string => Boolean(id)),
        cannibalizationRisk: c.recommendation.cannibalizationRisk,
      },
    });
  }

  if (clusters.length === 0) throw new Error("The AI returned no usable clusters for these keywords.");

  const unassigned = keywords.filter((k) => !assigned.has(k.id));
  if (unassigned.length) warnings.push(`Not clustered: ${unassigned.map((k) => `"${k.keyword}"`).join(", ")}.`);

  const intents = analysis.keywordIntents
    .map((i) => ({ k: byNorm.get(normalizeKeyword(i.keyword)), searchIntent: i.searchIntent }))
    .filter((i): i is { k: AnalysisKeyword; searchIntent: SearchIntent } => Boolean(i.k))
    .map((i) => ({ keywordId: i.k.id, searchIntent: i.searchIntent }));

  return { clusters, intents, warnings };
}

export interface KeywordAnalysisInput {
  brand: KeywordAnalysisPromptInput["brand"];
  keywords: AnalysisKeyword[];
  existingContent: ExistingContent[];
  existingClusters: ExistingCluster[];
}

/** Runs the AI step and validates the result. Persistence is the caller's job. */
export async function analyzeKeywords(ai: AIProvider, input: KeywordAnalysisInput): Promise<ProcessedAnalysis> {
  const { unique } = dedupeKeywords(input.keywords);
  const { system, prompt } = keywordAnalysisPrompt({
    brand: input.brand,
    keywords: unique.map((k) => ({ keyword: k.keyword, targetClass: k.targetClass, subject: k.subject })),
    existingContent: input.existingContent.map(({ slug, title, primaryKeyword, source }) => ({ slug, title, primaryKeyword, source })),
    existingClusters: input.existingClusters.map(({ name, primaryKeyword }) => ({ name, primaryKeyword })),
  });

  const { data } = await ai.analyze({
    system, prompt, schema: keywordAnalysisSchema, schemaName: "KeywordAnalysis", maxOutputTokens: 16000, effort: "medium",
  });
  return postProcessAnalysis(data, unique, input.existingContent, input.existingClusters);
}
