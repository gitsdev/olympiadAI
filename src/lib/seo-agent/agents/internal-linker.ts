// Internal Linking Agent (spec §15): suggests links to existing OlympiadIQ
// pages, anchored on text already in the article so they can be applied in place.

import { z } from "zod";
import type { AIProvider } from "../ai/types";
import { internalLinkingPrompt } from "../ai/prompts/internal-linking";
import type { LinkCandidate } from "../site-pages";
import { htmlToText } from "../article-html";

/** Article text without headings: anchors must come from running text, not headings. */
export function bodyTextWithoutHeadings(html: string): string {
  return htmlToText(html.replace(/<h[1-4]>[\s\S]*?<\/h[1-4]>/g, ""));
}

export const linkSuggestionsSchema = z.object({
  links: z.array(z.object({
    url: z.string().trim().min(1).max(300),
    anchorText: z.string().trim().min(2).max(120),
    reason: z.string().trim().min(5).max(300),
  })).max(10),
});
export type LinkSuggestionDraft = z.infer<typeof linkSuggestionsSchema>["links"][number];

export interface LinkSuggestion {
  url: string;
  anchorText: string;
  reason: string;
  targetType: "ARTICLE" | "FEATURE_PAGE";
}

/**
 * Keeps suggestions to real, not-yet-linked pages whose anchor is a short
 * phrase in the article's running text (not a heading).
 * `bodyText` should exclude headings; see bodyTextWithoutHeadings().
 */
export function validateLinkSuggestions(
  drafts: LinkSuggestionDraft[],
  ctx: { bodyText: string; alreadyLinked: string[]; candidates: LinkCandidate[] },
): { links: LinkSuggestion[]; dropped: string[] } {
  const byUrl = new Map(ctx.candidates.map((c) => [c.url, c]));
  const linked = new Set(ctx.alreadyLinked);
  const body = ctx.bodyText.toLowerCase();
  const seen = new Set<string>();
  const links: LinkSuggestion[] = [];
  const dropped: string[] = [];

  for (const d of drafts) {
    const url = d.url.replace(/^https?:\/\/(www\.)?olympiadiq\.in/i, "");
    const cand = byUrl.get(url);
    if (!cand) { dropped.push(`${d.url}: not an existing page`); continue; }
    if (linked.has(url) || seen.has(url)) { dropped.push(`${url}: already linked`); continue; }
    const words = d.anchorText.trim().split(/\s+/).length;
    if (words < 2 || words > 8) { dropped.push(`${url}: anchor "${d.anchorText}" should be 2–8 words`); continue; }
    if (!body.includes(d.anchorText.toLowerCase())) { dropped.push(`${url}: anchor "${d.anchorText}" isn't in the article's text (headings can't be links)`); continue; }
    seen.add(url);
    links.push({ url, anchorText: d.anchorText, reason: d.reason, targetType: cand.kind === "BLOG_POST" ? "ARTICLE" : "FEATURE_PAGE" });
  }
  return { links, dropped };
}

export async function suggestInternalLinks(
  ai: AIProvider,
  input: { title: string; primaryKeyword: string; bodyText: string; alreadyLinked: string[]; candidates: LinkCandidate[] },
): Promise<{ links: LinkSuggestion[]; dropped: string[] }> {
  const { system, prompt } = internalLinkingPrompt({
    article: { title: input.title, primaryKeyword: input.primaryKeyword, body: input.bodyText },
    alreadyLinked: input.alreadyLinked,
    candidates: input.candidates,
  });
  const { data } = await ai.generateStructuredOutput({
    system, prompt, schema: linkSuggestionsSchema, schemaName: "LinkSuggestions", maxOutputTokens: 8_000, effort: "low",
  });
  return validateLinkSuggestions(data.links, input);
}
