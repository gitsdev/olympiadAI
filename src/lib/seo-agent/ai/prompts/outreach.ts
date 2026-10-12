// Prompt for outreach drafting (spec §28). Edit wording here only.

import type { BrandProfile } from "../../settings-schema";
import { brandContext, dataBlock } from "./shared";

export interface OutreachPromptInput {
  brand: BrandProfile;
  prospect: { website: string; url: string; topic: string | null; opportunityType: string; contactName: string | null };
  /** Facts from the fetched page; the only basis for personalisation. */
  pageFacts: { title: string; description: string; headings: string[] } | null;
  evaluation: { editorialFit: string; recommendedApproach: string } | null;
  /** OlympiadIQ pages that may be offered (the only allowed resource URLs). */
  resources: { url: string; title: string; summary?: string }[];
}

export function outreachPrompt(input: OutreachPromptInput): { system: string; prompt: string } {
  const system = `You write short, genuine outreach emails for OlympiadIQ's small team to education websites, asking for a legitimate, editorially earned mention or link.

${brandContext(input.brand)}

Rules (mandatory):
- Honest and specific. Personalise ONLY with facts from the page data provided (its title, description, headings). If there is no page data, keep the opening polite and general; never pretend to have read something you weren't given.
- No flattery you can't back up, no invented statistics, users, awards or partnerships, no fake urgency.
- Never offer or hint at payment, link exchanges, "dofollow" requests or anchor-text demands. Those break search-engine guidelines.
- Offer something useful to THEIR readers (a free resource, a contribution or a correction), not a favour to us.
- The resource must be one of the provided OlympiadIQ pages.
- Plain text, under ~170 words for the whole body, warm and professional.
- Do NOT write a closing or sign-off (no "Warm regards", no team name) in any part; the sign-off is added automatically.`;

  const prompt = `Draft one outreach email.

Return the parts separately:
- subject (under ~70 characters, no clickbait)
- opening (personalised first line, per the rules)
- reason (why we're writing to them specifically)
- contribution (what we suggest: e.g. adding a free resource to their list, a guest article idea, fixing a broken link)
- resource: { url, why } where url is copied exactly from the resources list
- callToAction (a low-pressure ask)

${dataBlock("Prospect", input.prospect)}

${dataBlock("Their page", input.pageFacts ?? "not available")}

${dataBlock("Our evaluation", input.evaluation ?? "not evaluated")}

${dataBlock("OlympiadIQ resources you may offer", input.resources)}`;

  return { system, prompt };
}
