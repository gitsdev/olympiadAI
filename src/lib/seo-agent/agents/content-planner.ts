// Content Planner Agent (spec §10): cluster + recommendation → content plan.
// The AI drafts the plan; postProcessPlan() keeps only internal links to
// pages that really exist.

import { z } from "zod";
import type { AIProvider } from "../ai/types";
import { contentPlanningPrompt, type ContentPlanningPromptInput } from "../ai/prompts/content-planning";
import { CTA_TYPES, SEARCH_INTENTS } from "../constants";
import { CONTENT_TYPES, TARGET_AUDIENCES, type OutlineSection, type PlanInternalLink } from "../content-plans";
import type { LinkCandidate } from "../site-pages";

const t = (max: number) => z.string().trim().min(1).max(max);

export const contentPlanSchema = z.object({
  title: z.string().trim().min(10).max(120),
  contentType: z.enum(CONTENT_TYPES),
  targetAudience: z.enum(TARGET_AUDIENCES),
  searchIntent: z.enum(SEARCH_INTENTS),
  secondaryKeywords: z.array(t(200)).max(10),
  outline: z.array(z.object({ heading: t(160), points: z.array(t(300)).min(1).max(6) })).min(3).max(12),
  recommendedCta: z.enum(CTA_TYPES),
  ctaReason: t(400),
  internalLinks: z.array(z.object({ url: t(300), anchorText: t(120), reason: t(300) })).max(8),
  factCheckNotes: z.array(t(400)).max(10),
});
export type ContentPlanDraft = z.infer<typeof contentPlanSchema>;

export interface ProcessedPlan {
  title: string;
  contentType: ContentPlanDraft["contentType"];
  targetAudience: ContentPlanDraft["targetAudience"];
  searchIntent: ContentPlanDraft["searchIntent"];
  secondaryKeywords: string[];
  outline: OutlineSection[];
  recommendedCta: ContentPlanDraft["recommendedCta"];
  internalLinks: PlanInternalLink[];
  notes: string;
  warnings: string[];
}

/** Drops links to pages we didn't offer, removes duplicates, and folds review notes into `notes`. */
export function postProcessPlan(draft: ContentPlanDraft, candidates: LinkCandidate[], primaryKeyword: string): ProcessedPlan {
  const warnings: string[] = [];
  const allowed = new Set(candidates.map((c) => c.url));
  const seen = new Set<string>();
  const internalLinks: PlanInternalLink[] = [];
  for (const l of draft.internalLinks) {
    const url = l.url.replace(/^https?:\/\/(www\.)?olympiadiq\.in/i, "");
    if (!allowed.has(url)) {
      warnings.push(`Removed link to "${l.url}": not an existing OlympiadIQ page.`);
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    internalLinks.push({ url, anchorText: l.anchorText, reason: l.reason });
  }

  const primaryLower = primaryKeyword.toLowerCase();
  const secondaryKeywords = [...new Set(draft.secondaryKeywords.map((s) => s.replace(/\s+/g, " ").trim()))]
    .filter((s) => s.toLowerCase() !== primaryLower);

  const notes = [
    `CTA: ${draft.ctaReason}`,
    draft.factCheckNotes.length ? `Verify before publishing:\n${draft.factCheckNotes.map((n) => `- ${n}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");

  return {
    title: draft.title,
    contentType: draft.contentType,
    targetAudience: draft.targetAudience,
    searchIntent: draft.searchIntent,
    secondaryKeywords,
    outline: draft.outline,
    recommendedCta: draft.recommendedCta,
    internalLinks,
    notes,
    warnings,
  };
}

export async function planContent(ai: AIProvider, input: ContentPlanningPromptInput): Promise<ProcessedPlan> {
  const { system, prompt } = contentPlanningPrompt(input);
  const { data } = await ai.generateStructuredOutput({
    system, prompt, schema: contentPlanSchema, schemaName: "ContentPlan", maxOutputTokens: 16000, effort: "medium",
  });
  return postProcessPlan(data, input.linkCandidates, input.cluster.primaryKeyword);
}
