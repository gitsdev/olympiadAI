// Prompt for the Keyword Analysis Agent (spec §7). Edit wording here only.

import type { BrandProfile } from "../../settings-schema";
import { brandContext, dataBlock, HONESTY_RULES } from "./shared";

export interface KeywordAnalysisPromptInput {
  brand: BrandProfile;
  keywords: { keyword: string; targetClass: number | null; subject: string | null }[];
  existingContent: { slug: string; title: string; primaryKeyword?: string | null; source: "blog" | "draft" }[];
  existingClusters: { name: string; primaryKeyword: string }[];
}

export function keywordAnalysisPrompt(input: KeywordAnalysisPromptInput): { system: string; prompt: string } {
  const system = `You are the Keyword Analysis Agent for an Indian Olympiad-preparation website. You turn a list of target keywords into SEO keyword clusters and content recommendations.

${brandContext(input.brand)}

${HONESTY_RULES}`;

  const prompt = `Analyse the target keywords below.

Steps:
1. Treat keywords that differ only in case, spacing or word order as the same search.
2. Identify the search intent of each keyword (INFORMATIONAL, NAVIGATIONAL, COMMERCIAL, TRANSACTIONAL).
3. Group keywords that one article could satisfy into a cluster. Keep different classes (grades) or different subjects in separate clusters unless the keyword is explicitly class-agnostic.
4. For each cluster choose the primaryKeyword. It MUST be copied exactly from that cluster's memberKeywords.
5. memberKeywords: copy keywords EXACTLY as given in the input. Every input keyword should appear in exactly one cluster.
6. secondaryKeywords: close variants a searcher might use (may include variants not in the input). questionKeywords: natural questions people ask about the topic. Keep both lists short and realistic; no keyword stuffing.
7. recommendedTitle: a clear, people-first article title (no clickbait, no year unless the topic is year-specific, max ~70 characters).
8. recommendation: compare against the existing content.
   - NEW_ARTICLE if nothing covers the topic.
   - UPDATE_EXISTING if an existing page already targets it and should be improved instead.
   - MERGE_ARTICLES if two or more existing pages compete for it.
   - NO_ACTION if it is already well covered or not worth an article.
   relatedSlugs may ONLY contain slugs from the existing content list. Set cannibalizationRisk to how strongly a new article would compete with existing pages. reason: one or two concrete sentences.
9. If an existing cluster already covers a keyword, reuse that cluster's exact name and primary keyword.

${dataBlock("Target keywords", input.keywords)}

${dataBlock("Existing OlympiadIQ content", input.existingContent.length ? input.existingContent : "none yet")}

${dataBlock("Existing keyword clusters", input.existingClusters.length ? input.existingClusters : "none yet")}`;

  return { system, prompt };
}
