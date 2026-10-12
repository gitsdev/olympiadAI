// Outreach drafting (spec §28). Produces a draft only; nothing is ever sent.

import { z } from "zod";
import type { AIProvider } from "../ai/types";
import { outreachPrompt, type OutreachPromptInput } from "../ai/prompts/outreach";

/** Built per request so the resource URL can only be one we offered. */
export function outreachSchema(resourceUrls: [string, ...string[]]) {
  return z.object({
    subject: z.string().trim().min(5).max(90),
    opening: z.string().trim().min(5).max(500),
    reason: z.string().trim().min(5).max(600),
    contribution: z.string().trim().min(5).max(700),
    resource: z.object({ url: z.enum(resourceUrls), why: z.string().trim().min(5).max(300) }),
    callToAction: z.string().trim().min(5).max(300),
  });
}
export type OutreachDraft = z.infer<ReturnType<typeof outreachSchema>>;

/** Phrases that suggest a link scheme; flagged for the admin, never silently sent. */
const LINK_SCHEME = /\b(link exchange|exchange links|dofollow|do-follow|paid (post|link)|sponsored (post|link)|we('| wi)ll pay|payment|backlink in return|guest post fee)\b/i;

export interface OutreachMessage {
  subject: string;
  body: string;
  parts: OutreachDraft;
  warnings: string[];
}

/** Removes a trailing sign-off the model may add despite instructions (we append our own). */
export function stripSignOff(text: string): string {
  return text.replace(/\s*(warm|kind|best)?\s*(regards|wishes)[,.!]?\s*(the\s+)?(olympiadiq\s+team)?\.?\s*$/i, "").trim();
}

export function assembleOutreach(draft: OutreachDraft, resourceTitle: string, siteUrl: string): OutreachMessage {
  draft = { ...draft, callToAction: stripSignOff(draft.callToAction), contribution: stripSignOff(draft.contribution) };
  const base = siteUrl.replace(/\/$/, "");
  const link = draft.resource.url.startsWith("http") ? draft.resource.url : `${base}${draft.resource.url}`;
  const body = [
    draft.opening,
    draft.reason,
    draft.contribution,
    `${resourceTitle}: ${link}\n${draft.resource.why}`,
    draft.callToAction,
    `Warm regards,\nThe OlympiadIQ Team\n${base}`,
  ].join("\n\n");
  const warnings = LINK_SCHEME.test(`${draft.subject}\n${body}`)
    ? ["The draft mentions something that looks like a link scheme (payment, link exchange or dofollow). Edit it out before approving."]
    : [];
  return { subject: draft.subject, body, parts: draft, warnings };
}

export async function writeOutreach(ai: AIProvider, input: OutreachPromptInput): Promise<OutreachMessage> {
  if (input.resources.length === 0) throw new Error("No OlympiadIQ pages are available to offer.");
  const urls = input.resources.map((r) => r.url) as [string, ...string[]];
  const { system, prompt } = outreachPrompt(input);
  const { data } = await ai.generateStructuredOutput({
    system, prompt, schema: outreachSchema(urls), schemaName: "OutreachEmail", maxOutputTokens: 6_000, effort: "low",
  });
  const title = input.resources.find((r) => r.url === data.resource.url)?.title ?? "OlympiadIQ";
  return assembleOutreach(data, title, input.brand.website);
}
