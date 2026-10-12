// Backlink Agent (spec §27): evaluates a prospect from its real page content.
// Never fabricates third-party metrics: traffic is always DATA_UNAVAILABLE,
// and spam risk is DATA_UNAVAILABLE when the page couldn't be read.

import { z } from "zod";
import type { AIProvider } from "../ai/types";
import { backlinkAnalysisPrompt, type BacklinkAnalysisPromptInput } from "../ai/prompts/backlink-analysis";
import { DATA_UNAVAILABLE, OPPORTUNITY_TYPES, SPAM_RISKS, type SpamRisk } from "../backlinks/model";
import type { PageFacts } from "../backlinks/page-parse";

export const backlinkEvaluationSchema = z.object({
  relevanceScore: z.number().int().min(0).max(100),
  qualityScore: z.number().int().min(0).max(100),
  editorialFit: z.string().trim().min(5).max(600),
  contentQuality: z.string().trim().min(5).max(600),
  estimatedTraffic: z.string().trim().max(60),
  spamRisk: z.enum(SPAM_RISKS),
  spamSignals: z.array(z.string().trim().min(2).max(300)).max(12),
  suggestedOpportunityType: z.enum(OPPORTUNITY_TYPES),
  recommendedApproach: z.string().trim().min(5).max(800),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
});
export type BacklinkEvaluationDraft = z.infer<typeof backlinkEvaluationSchema>;

export interface BacklinkEvaluation extends Omit<BacklinkEvaluationDraft, "estimatedTraffic"> {
  estimatedTraffic: typeof DATA_UNAVAILABLE;
  evaluatedAt: string;
  page: { fetched: boolean; title: string | null; finalUrl: string | null; error: string | null; wordCount: number | null };
  /** Spam signals detected in code, independent of the AI. */
  detectedSignals: string[];
}

const RISK_ORDER: SpamRisk[] = ["LOW", "MEDIUM", "HIGH"];

/** Deterministic spam signals from the page itself. */
export function detectSpamSignals(page: PageFacts): { signals: string[]; minRisk: SpamRisk | null } {
  const signals: string[] = [];
  let minRisk: SpamRisk | null = null;
  const raise = (r: SpamRisk) => { if (!minRisk || RISK_ORDER.indexOf(r) > RISK_ORDER.indexOf(minRisk)) minRisk = r; };
  if (page.signals.casinoOrAdultTerms) { signals.push("Gambling/adult/spam terms on the page"); raise("HIGH"); }
  if (page.signals.sponsoredPostTerms) { signals.push("Mentions paid/sponsored posts or link insertions"); raise("HIGH"); }
  if (page.outboundLinkCount > 150 && page.wordCount < 1500) { signals.push(`Very many outbound links (${page.outboundLinkCount}) for little content`); raise("MEDIUM"); }
  if (page.wordCount < 80) { signals.push("Almost no readable content"); raise("MEDIUM"); }
  return { signals, minRisk };
}

export function postProcessEvaluation(draft: BacklinkEvaluationDraft, page: PageFacts | { fetchError: string; url: string }, now = new Date()): BacklinkEvaluation {
  const fetched = !("fetchError" in page);
  const detected = fetched ? detectSpamSignals(page) : { signals: [] as string[], minRisk: null };
  let spamRisk: SpamRisk = draft.spamRisk;
  if (!fetched && spamRisk !== "HIGH") spamRisk = "DATA_UNAVAILABLE";
  if (detected.minRisk && (spamRisk === "DATA_UNAVAILABLE" || RISK_ORDER.indexOf(detected.minRisk) > RISK_ORDER.indexOf(spamRisk))) {
    spamRisk = detected.minRisk;
  }
  return {
    ...draft,
    estimatedTraffic: DATA_UNAVAILABLE, // never trust or invent a traffic number
    spamRisk,
    confidence: fetched ? draft.confidence : "LOW",
    evaluatedAt: now.toISOString(),
    page: fetched
      ? { fetched: true, title: page.title || null, finalUrl: page.url, error: null, wordCount: page.wordCount }
      : { fetched: false, title: null, finalUrl: null, error: page.fetchError, wordCount: null },
    detectedSignals: detected.signals,
  };
}

function withoutLinks(page: PageFacts): Omit<PageFacts, "links"> {
  const copy: Partial<PageFacts> = { ...page };
  delete copy.links;
  return copy as Omit<PageFacts, "links">;
}

export async function evaluateBacklinkProspect(
  ai: AIProvider,
  input: Omit<BacklinkAnalysisPromptInput, "page"> & { page: PageFacts | { fetchError: string; url: string } },
): Promise<BacklinkEvaluation> {
  // The prompt gets page facts but not the raw link list (large, and not needed to judge the page).
  const pageForPrompt = "fetchError" in input.page
    ? { fetchError: input.page.fetchError }
    : withoutLinks(input.page);
  const { system, prompt } = backlinkAnalysisPrompt({ ...input, page: pageForPrompt });
  const { data } = await ai.generateStructuredOutput({
    system, prompt, schema: backlinkEvaluationSchema, schemaName: "BacklinkEvaluation", maxOutputTokens: 8_000, effort: "low",
  });
  return postProcessEvaluation(data, input.page);
}
