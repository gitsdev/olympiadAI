// Content Writer Agent (spec §10): content plan → full article draft.
// The AI writes Markdown; postProcessArticle() converts it to sanitized
// HTML, places the CTA block, enforces the internal-link allowlist and
// records anything that needs human review.

import { z } from "zod";
import type { AIProvider } from "../ai/types";
import { articleWritingPrompt, type ArticleWritingPromptInput } from "../ai/prompts/article-writing";
import { CTA_TYPES, type CtaType } from "../constants";
import { ctaBlockHtml, markdownToArticleHtml, wordCount } from "../article-html";
import { slugify } from "@/lib/slug";

export const articleDraftSchema = z.object({
  title: z.string().trim().min(10).max(120),
  slug: z.string().trim().min(3).max(100),
  metaTitle: z.string().trim().min(10).max(80),
  metaDescription: z.string().trim().min(50).max(200),
  excerpt: z.string().trim().min(30).max(400),
  bodyMarkdown: z.string().trim().min(1500).max(80_000),
  ctaType: z.enum(CTA_TYPES),
  featuredImagePrompt: z.string().trim().min(20).max(800),
  featuredImageAlt: z.string().trim().min(5).max(200),
  needsVerification: z.array(z.string().trim().min(3).max(400)).max(20),
});
export type ArticleDraft = z.infer<typeof articleDraftSchema>;

export interface QualityFlag {
  kind: "VERIFY_CLAIM" | "EXTERNAL_LINK" | "REMOVED_LINK" | "CTA_ADDED";
  message: string;
}

export interface ProcessedArticle {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  contentHtml: string;
  ctaType: CtaType;
  featuredImagePrompt: string;
  featuredImageAlt: string;
  qualityFlags: QualityFlag[];
  wordCount: number;
}

export function postProcessArticle(draft: ArticleDraft, allowedInternal: string[]): ProcessedArticle {
  const conv = markdownToArticleHtml(draft.bodyMarkdown, draft.ctaType, { allowedInternal: new Set(allowedInternal) });
  const flags: QualityFlag[] = [
    ...draft.needsVerification.map((m) => ({ kind: "VERIFY_CLAIM" as const, message: m })),
    ...conv.links.external.map((h) => ({ kind: "EXTERNAL_LINK" as const, message: `External link to ${h}: check it is an official, working source.` })),
    ...conv.links.removedInternal.map((h) => ({ kind: "REMOVED_LINK" as const, message: `Removed link to ${h}: not an existing OlympiadIQ page.` })),
  ];

  let html = conv.html;
  if (!conv.ctaPlaced) {
    html = `${html}\n${ctaBlockHtml(draft.ctaType)}`;
    flags.push({ kind: "CTA_ADDED", message: "The writer didn't place the CTA, so it was added at the end. Move it if a better spot exists." });
  }

  return {
    title: draft.title,
    slug: slugify(draft.slug) || slugify(draft.title),
    metaTitle: draft.metaTitle,
    metaDescription: draft.metaDescription,
    excerpt: draft.excerpt,
    contentHtml: html,
    ctaType: draft.ctaType,
    featuredImagePrompt: draft.featuredImagePrompt,
    featuredImageAlt: draft.featuredImageAlt,
    qualityFlags: flags,
    wordCount: wordCount(html),
  };
}

export async function writeArticle(ai: AIProvider, input: ArticleWritingPromptInput): Promise<ProcessedArticle> {
  const { system, prompt } = articleWritingPrompt(input);
  const { data } = await ai.generateStructuredOutput({
    system, prompt, schema: articleDraftSchema, schemaName: "ArticleDraft", maxOutputTokens: 32_000, effort: "medium",
  });
  return postProcessArticle(data, input.internalLinks.map((l) => l.url));
}
