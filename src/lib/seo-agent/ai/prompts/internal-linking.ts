// Prompt for the Internal Linking Agent (spec §15). Edit wording here only.

import type { LinkCandidate } from "../../site-pages";
import { dataBlock } from "./shared";

export interface InternalLinkingPromptInput {
  article: { title: string; primaryKeyword: string; body: string };
  alreadyLinked: string[];
  candidates: LinkCandidate[];
}

export function internalLinkingPrompt(input: InternalLinkingPromptInput): { system: string; prompt: string } {
  const system = `You are the Internal Linking editor for OlympiadIQ's blog. You add links only where they genuinely help the reader go deeper; you never force irrelevant links.`;

  const prompt = `Suggest up to 6 internal links for this article.

Rules:
- url must be copied exactly from the candidates list, and must not be one of the already-linked URLs.
- anchorText must be a short phrase (2–7 words) copied EXACTLY from a paragraph, list item or table cell of the article, so it can be linked in place. Never use a heading as anchor text. Choose descriptive phrases, never "click here".
- The anchor must accurately describe the target page. Never link phrases like "official syllabus" or "official website" to OlympiadIQ pages; those words promise an official source.
- Each suggestion needs a one-sentence reason a reader would benefit.
- Prefer product/feature pages (mock tests, brain games, topic pages) only where the text naturally talks about that activity.
- Fewer good links beat many weak ones. Return an empty list if nothing fits.

${dataBlock("Article", input.article)}

${dataBlock("Already linked URLs", input.alreadyLinked.length ? input.alreadyLinked : "none")}

${dataBlock("Candidates", input.candidates.map(({ url, title, kind, summary }) => ({ url, title, kind, summary })))}`;

  return { system, prompt };
}
