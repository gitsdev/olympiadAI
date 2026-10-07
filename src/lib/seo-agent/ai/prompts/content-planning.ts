// Prompt for the Content Planner Agent (spec §10). Edit wording here only.

import type { BrandProfile } from "../../settings-schema";
import type { LinkCandidate } from "../../site-pages";
import { brandContext, dataBlock, HONESTY_RULES } from "./shared";

export interface ContentPlanningPromptInput {
  brand: BrandProfile;
  cluster: {
    name: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    questionKeywords: string[];
    searchIntent: string | null;
    recommendedTitle: string | null;
    targetClass: number | null;
    subject: string | null;
  };
  opportunityReason: string;
  linkCandidates: LinkCandidate[];
  ctaOptions: { type: string; label: string; description: string }[];
}

export function contentPlanningPrompt(input: ContentPlanningPromptInput): { system: string; prompt: string } {
  const system = `You are the Content Planner for an Indian Olympiad-preparation website. You plan one genuinely useful article before anyone writes it.

${brandContext(input.brand)}

${HONESTY_RULES}

Planning principles:
- People first: plan what a student or parent searching this keyword actually needs, in the order they need it. Answer the search intent early.
- No filler sections written for word count, no keyword stuffing, no copying competitors.
- Prefer practical, original value: worked examples, study plans, common mistakes, practice approaches.
- Include an FAQ section only if it is genuinely useful.`;

  const prompt = `Create a content plan for the cluster below.

Requirements:
- title: clear and specific, ideally under 65 characters. You may improve on the recommended title.
- contentType and targetAudience: pick the best fit.
- secondaryKeywords: up to 8 natural variants worth covering (from the cluster; do not invent volumes).
- outline: 4–9 H2 sections in reading order, each with 1–5 short points describing what that section must cover.
- recommendedCta: the ONE call-to-action that best fits a reader of this article, with a one-sentence ctaReason.
- internalLinks: up to 6 links that would genuinely help this reader. The url MUST be copied exactly from the link candidates list; do not create URLs. Give natural anchor text and a short reason. Skip links that aren't relevant.
- factCheckNotes: anything the writer must verify before publishing (exam dates, syllabus specifics, eligibility, fees, official names). Empty if nothing needs checking.

${dataBlock("Cluster", input.cluster)}

${dataBlock("Why this article was recommended", input.opportunityReason)}

${dataBlock("Link candidates (the ONLY allowed internal link URLs)", input.linkCandidates.map(({ url, title, kind, summary }) => ({ url, title, kind, summary })))}

${dataBlock("CTA options", input.ctaOptions)}`;

  return { system, prompt };
}
