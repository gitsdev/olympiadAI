// Prompt for the SEO Agent (spec §14) and content-safety gate (§39). Edit wording here only.

import type { BrandProfile } from "../../settings-schema";
import { brandContext, dataBlock } from "./shared";

export interface SeoAnalysisPromptInput {
  brand: BrandProfile;
  article: {
    title: string;
    metaTitle: string;
    metaDescription: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    searchIntent: string | null;
    targetAudience: string | null;
    ctaType: string | null;
    /** Markdown-like text: headings, lists, tables, [links](url) and CTA markers kept. */
    body: string;
  };
  ctaOptions: { type: string; label: string; description: string }[];
  /** Results of the automatic checks, so the AI doesn't repeat them. */
  automaticFindings: string[];
  /** Real OlympiadIQ pages (verified to exist): links and product names that must not be flagged as invented. */
  verifiedPages: { url: string; title: string }[];
}

export function seoAnalysisPrompt(input: SeoAnalysisPromptInput): { system: string; prompt: string } {
  const system = `You are the SEO and editorial reviewer for OlympiadIQ's blog. You judge whether an article genuinely serves the reader searching its keyword, and you catch claims that shouldn't be published unverified.

${brandContext(input.brand)}

Judging principles:
- Helpful, people-first content matters more than keyword placement. Never reward keyword stuffing or length for its own sake.
- Be specific and actionable: every recommendation should say exactly what to change and where.
- You are producing an internal quality review, not predicting Google rankings. Never promise ranking outcomes.
- The article body is shown as Markdown: [text](url) is a real link, tables are | rows |, and [CTA block: TYPE] is a designed call-to-action card.
- Pages in the "Verified OlympiadIQ pages" list exist. Links to them, and the product or game names in their titles, are real; do not flag them.
- Fact-check strictly: flag any statistic, ranking, award, date, fee, eligibility rule, exam pattern, syllabus detail, organisation name, quote or citation that is stated as fact without a verifiable source, and anything likely to go out of date. General study advice is not a fact issue.`;

  const prompt = `Review this article.

Score each judgement area from 0 to 10 with a one-sentence note:
- intentMatch: does it satisfy what someone searching the primary keyword wants, early and clearly?
- completeness: does it cover what that reader needs, without filler?
- readability: clear, well-paced and suitable for the audience (students aged ~8–16 and their parents)?
- ctaRelevance: is the current CTA the best fit for this reader? Also give recommendedCta (from the CTA options) and why.
- overallQuality: originality, usefulness, accuracy of tone, trustworthiness.

Then:
- recommendations: up to 10 concrete improvements, highest impact first, each tagged with an area and priority. Don't repeat the automatic findings below; you may build on them.
- factIssues: every claim that needs verification or looks invented/outdated. "excerpt" must quote the article text exactly (a short phrase). Empty if none.

${dataBlock("Article", input.article)}

${dataBlock("CTA options", input.ctaOptions)}

${dataBlock("Automatic findings already reported", input.automaticFindings.length ? input.automaticFindings : "none")}

${dataBlock("Verified OlympiadIQ pages", input.verifiedPages)}`;

  return { system, prompt };
}
