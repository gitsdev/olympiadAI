// SEO Agent (spec §14) + content-safety gate (§39).
// Deterministic checks run in code; the AI judges intent, completeness,
// readability, CTA fit and quality, and lists fact issues. combineAnalysis()
// turns both into the stored analysis and the internal 0–100 score.

import { z } from "zod";
import type { AIProvider } from "../ai/types";
import { seoAnalysisPrompt, type SeoAnalysisPromptInput } from "../ai/prompts/seo-analysis";
import { CTA_TYPES, type CtaType } from "../constants";
import { htmlToReviewMarkdown } from "../article-html";
import {
  categoryScores, overallScore, runDeterministicChecks, SEO_CATEGORIES,
  type SeoCategory, type SeoCheck, type SeoCheckInput,
} from "../seo-checks";

const judged = z.object({ score: z.number().min(0).max(10), note: z.string().trim().min(1).max(400) });

export const FACT_ISSUE_KINDS = [
  "UNSUPPORTED_STATISTIC", "UNSUPPORTED_RANKING", "UNVERIFIED_CLAIM", "FAKE_CITATION",
  "UNKNOWN_ORGANIZATION", "COMPETITION_DETAIL", "POSSIBLY_OUTDATED",
] as const;

export const seoReviewSchema = z.object({
  intentMatch: judged,
  completeness: judged,
  readability: judged,
  ctaRelevance: judged.extend({ recommendedCta: z.enum(CTA_TYPES), reason: z.string().trim().min(1).max(400) }),
  overallQuality: judged,
  recommendations: z.array(z.object({
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
    area: z.enum(SEO_CATEGORIES),
    message: z.string().trim().min(5).max(500),
  })).max(12),
  factIssues: z.array(z.object({
    excerpt: z.string().trim().min(2).max(300),
    issue: z.string().trim().min(5).max(400),
    kind: z.enum(FACT_ISSUE_KINDS),
    severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
  })).max(25),
});
export type SeoReview = z.infer<typeof seoReviewSchema>;

export interface SeoAnalysis {
  /** Internal content-quality score, NOT a Google ranking score. */
  score: number;
  checkedAt: string;
  fingerprint: string;
  articleVersion: number;
  categories: { category: SeoCategory; score: number; notes: string[] }[];
  checks: SeoCheck[];
  recommendations: SeoReview["recommendations"];
  factIssues: (SeoReview["factIssues"][number] & { foundInText: boolean })[];
  cta: { current: string | null; recommended: CtaType; reason: string };
  /** HIGH-severity fact issues or failed critical checks: blocks auto-publish (Phase 6/7). */
  critical: string[];
  model: string;
}

/** The article as Markdown-like text (headings, lists, tables, links visible) for the reviewer. */
export function articleBodyForReview(html: string): string {
  return htmlToReviewMarkdown(html);
}

export function combineAnalysis(
  checks: SeoCheck[],
  review: SeoReview,
  meta: { fingerprint: string; articleVersion: number; currentCta: string | null; model: string; bodyText: string; now?: Date },
): SeoAnalysis {
  const ai: Partial<Record<SeoCategory, number>> = {
    SEARCH_INTENT: review.intentMatch.score,
    COMPLETENESS: review.completeness.score,
    READABILITY: review.readability.score,
    CTA: review.ctaRelevance.score,
    // High-severity fact problems cap overall quality.
    OVERALL_QUALITY: Math.min(review.overallQuality.score, review.factIssues.some((f) => f.severity === "HIGH") ? 5 : 10),
  };
  const scores = categoryScores(checks, ai);
  const aiNotes: Partial<Record<SeoCategory, string>> = {
    SEARCH_INTENT: review.intentMatch.note, COMPLETENESS: review.completeness.note, READABILITY: review.readability.note,
    CTA: review.ctaRelevance.note, OVERALL_QUALITY: review.overallQuality.note,
  };
  const text = meta.bodyText.toLowerCase();
  // Excerpts quote visible text, so also compare against the text without Markdown link/bold syntax.
  const plain = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*\*?/g, "");
  const found = (excerpt: string) => {
    const e = excerpt.toLowerCase().replace(/[“”"]/g, "").trim();
    return text.includes(e) || plain.includes(e);
  };

  const critical = [
    ...review.factIssues.filter((f) => f.severity === "HIGH").map((f) => `Fact check: "${f.excerpt}": ${f.issue}`),
    ...checks.filter((c) => c.status === "fail" && ["INTERNAL_LINKING", "META_TITLE", "META_DESCRIPTION", "CTA"].includes(c.category)).map((c) => c.message),
  ];

  return {
    score: overallScore(scores),
    checkedAt: (meta.now ?? new Date()).toISOString(),
    fingerprint: meta.fingerprint,
    articleVersion: meta.articleVersion,
    categories: SEO_CATEGORIES.map((c) => ({
      category: c,
      score: Math.round(scores[c] * 100),
      notes: [...checks.filter((x) => x.category === c && x.status !== "pass").map((x) => x.message), ...(aiNotes[c] ? [aiNotes[c]!] : [])],
    })),
    checks,
    recommendations: [...review.recommendations].sort((a, b) => ["HIGH", "MEDIUM", "LOW"].indexOf(a.priority) - ["HIGH", "MEDIUM", "LOW"].indexOf(b.priority)),
    factIssues: review.factIssues.map((f) => ({ ...f, foundInText: found(f.excerpt) })),
    cta: { current: meta.currentCta, recommended: review.ctaRelevance.recommendedCta, reason: review.ctaRelevance.reason },
    critical,
    model: meta.model,
  };
}

export async function analyzeArticleSeo(
  ai: AIProvider,
  input: { checkInput: SeoCheckInput; prompt: Omit<SeoAnalysisPromptInput, "automaticFindings" | "article"> & { article: Omit<SeoAnalysisPromptInput["article"], "body"> } },
  meta: { fingerprint: string; articleVersion: number; currentCta: string | null },
): Promise<SeoAnalysis> {
  const checks = runDeterministicChecks(input.checkInput);
  const body = articleBodyForReview(input.checkInput.html);
  const { system, prompt } = seoAnalysisPrompt({
    ...input.prompt,
    article: { ...input.prompt.article, body },
    automaticFindings: checks.filter((c) => c.status !== "pass").map((c) => c.message),
  });
  const { data, model } = await ai.generateStructuredOutput({
    system, prompt, schema: seoReviewSchema, schemaName: "SeoReview", maxOutputTokens: 16_000, effort: "medium",
  });
  return combineAnalysis(checks, data, { ...meta, model, bodyText: body });
}
