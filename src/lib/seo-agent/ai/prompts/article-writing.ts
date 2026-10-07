// Prompt for the Content Writer Agent (spec §10, §11, §39). Edit wording here only.

import type { BrandProfile } from "../../settings-schema";
import { CTA_PLACEHOLDER } from "../../article-html";
import { brandContext, dataBlock, HONESTY_RULES } from "./shared";

export interface ArticleWritingPromptInput {
  brand: BrandProfile;
  plan: {
    title: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    searchIntent: string | null;
    contentType: string | null;
    targetAudience: string | null;
    outline: { heading: string; points: string[] }[];
    notes: string | null;
  };
  cta: { type: string; label: string; description: string } | null;
  /** The only internal links allowed: url + suggested anchor + why. */
  internalLinks: { url: string; anchorText: string; reason: string }[];
  /** Titles of existing OlympiadIQ articles, so this one doesn't duplicate them. */
  existingTitles: string[];
}

export const QUALITY_RULES = `Content quality rules (mandatory):
- Write for people first. Answer the search intent in the first two or three sentences.
- Do not keyword stuff or repeat phrases unnaturally. Use the primary keyword naturally in the introduction and where it reads well. Never aim for a keyword-density percentage.
- Do not copy or closely paraphrase any competitor or source. Write original explanations and original example questions.
- No filler written to increase length. Every section must give the reader something useful.
- Do not invent statistics, rankings, results, quotes, citations, organisations, exam dates, fees, syllabus specifics or official rules. Where specifics need checking, give general guidance instead and list the claim in needsVerification.
- Clearly mark genuinely uncertain information as such in the text (e.g. "check the official website for this year's dates").
- Prefer practical examples, worked problems, study plans and common mistakes.
- Short readable paragraphs (2–4 sentences). Use H2 for main sections and H3 for sub-points. Use a Markdown table where it genuinely helps (e.g. a weekly plan or topic list). Include an FAQ section only if it is genuinely useful.
- Write in clear Indian English for students and parents. Warm and encouraging, never pressuring; readers may be children.`;

export function articleWritingPrompt(input: ArticleWritingPromptInput): { system: string; prompt: string } {
  const system = `You are the Content Writer for OlympiadIQ's blog. You write original, genuinely useful articles for Indian students preparing for school Olympiads, and for their parents.

${brandContext(input.brand)}

${HONESTY_RULES}

${QUALITY_RULES}`;

  const prompt = `Write the complete article for this content plan.

Output fields:
- title: the article's H1 (you may refine the planned title; keep it under ~65 characters).
- slug: lowercase words joined by hyphens, based on the primary keyword, no dates or stop-word padding.
- metaTitle: 50–60 characters, includes the primary keyword naturally. metaDescription: 140–160 characters, a specific promise of what the reader gets.
- excerpt: 1–2 sentences for blog listings.
- bodyMarkdown: the full article in GitHub-flavoured Markdown. Do NOT include the H1 title. Start with a short introduction, follow the outline's sections (you may merge or rename sections if it reads better), and end with a brief conclusion.
  - Put the line ${CTA_PLACEHOLDER} on its own, exactly once, where the call to action fits most naturally (usually after the most practical section or before the conclusion). Do not write the CTA text yourself; a designed CTA block replaces the marker.
  - Internal links: use ONLY the URLs listed below, as Markdown links with natural anchor text, each at most once, only where it genuinely helps. Never invent OlympiadIQ URLs.
  - External links: only if truly necessary and only to official sources; avoid otherwise.
- ctaType: the CTA type for the marker (normally the plan's CTA).
- featuredImagePrompt: a description for generating an original, text-free illustration suitable for children's education (no logos, no real people). featuredImageAlt: concise alt text for that image.
- needsVerification: every factual claim in the article an editor must check against an official source before publishing (empty if none).

${dataBlock("Content plan", input.plan)}

${dataBlock("Call to action", input.cta ?? "none: choose the best fit from the brand's real features")}

${dataBlock("Allowed internal links", input.internalLinks.length ? input.internalLinks : "none")}

${dataBlock("Existing OlympiadIQ article titles (don't duplicate them)", input.existingTitles.length ? input.existingTitles : "none")}`;

  return { system, prompt };
}
