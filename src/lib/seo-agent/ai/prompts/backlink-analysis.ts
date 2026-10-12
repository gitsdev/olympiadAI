// Prompt for the Backlink Agent (spec §27). Edit wording here only.

import type { BrandProfile } from "../../settings-schema";
import type { PageFacts } from "../../backlinks/page-parse";
import { brandContext, dataBlock } from "./shared";

export interface BacklinkAnalysisPromptInput {
  brand: BrandProfile;
  prospect: { website: string; url: string; topic: string | null; opportunityType: string; notes: string | null };
  /** What we actually fetched from the page, or why we couldn't. */
  page: Omit<PageFacts, "links"> | { fetchError: string };
}

export function backlinkAnalysisPrompt(input: BacklinkAnalysisPromptInput): { system: string; prompt: string } {
  const system = `You evaluate websites as potential backlink partners for OlympiadIQ, an Indian Olympiad-preparation platform for students, parents and teachers. You favour legitimate, editorially earned links from relevant education sites, and you flag spam.

${brandContext(input.brand)}

Rules (mandatory):
- Judge ONLY from the page data provided. Never invent domain authority, domain rating, traffic, backlink counts, rankings or any third-party metric. You have none of these.
- estimatedTraffic must always be "DATA_UNAVAILABLE".
- If the page could not be fetched, say so: scores must reflect low confidence, and spamRisk must be "DATA_UNAVAILABLE" unless the URL itself is clearly spammy.
- Paid links, link exchanges and "sponsored post" schemes are not legitimate opportunities; treat them as spam signals.`;

  const prompt = `Evaluate this prospect.

Return:
- relevanceScore (0–100): topical fit with Olympiad prep, school subjects, education, parenting or teaching in India.
- qualityScore (0–100): how trustworthy and useful the page looks from its actual content (original writing, clear purpose, maintained, not thin or auto-generated).
- editorialFit: one or two sentences on whether a link to OlympiadIQ would be natural there and on what basis.
- contentQuality: one or two sentences describing the page's content quality, citing what you saw.
- estimatedTraffic: "DATA_UNAVAILABLE".
- spamRisk: LOW, MEDIUM, HIGH or DATA_UNAVAILABLE, with spamSignals listing the concrete things that raised it (empty if none).
- suggestedOpportunityType: the most fitting type.
- recommendedApproach: how to approach them legitimately (what to offer, which page to suggest), or why to skip them.
- confidence: LOW, MEDIUM or HIGH (LOW if the page couldn't be fetched or had little content).

${dataBlock("Prospect", input.prospect)}

${dataBlock("Fetched page", input.page)}`;

  return { system, prompt };
}
