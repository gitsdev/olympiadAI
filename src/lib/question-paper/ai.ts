// Claude client for the Question Paper Solver. Follows the SEO Agent's
// AnthropicProvider (src/lib/seo-agent/ai/anthropic.ts) but accepts
// multimodal content (PDF pages, images), which that text-only interface
// doesn't. This is the only module here that knows Anthropic's API shape.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

export const QPS_MODEL = process.env.QPS_AI_MODEL || "claude-opus-5-5";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type ContentPart =
  | { kind: "text"; text: string }
  | { kind: "pdf"; data: Uint8Array; title?: string }
  | { kind: "image"; data: Uint8Array; mime: "image/png" | "image/jpeg" | "image/gif" | "image/webp" };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export class AIError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly status?: number) {
    super(message);
    this.name = "AIError";
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AIError("ANTHROPIC_API_KEY is not set.", false);
  // Each pipeline step must finish inside one 300 s function invocation; the
  // timeout leaves headroom for DB writes. The SDK retries 429/5xx itself.
  client ??= new Anthropic({ apiKey, maxRetries: 2, timeout: 240_000 });
  return client;
}

function toBlocks(parts: ContentPart[]): Anthropic.Beta.BetaContentBlockParam[] {
  return parts.map((p): Anthropic.Beta.BetaContentBlockParam => {
    if (p.kind === "text") return { type: "text", text: p.text };
    if (p.kind === "pdf") {
      return {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: Buffer.from(p.data).toString("base64") },
        ...(p.title ? { title: p.title } : {}),
      };
    }
    return { type: "image", source: { type: "base64", media_type: p.mime, data: Buffer.from(p.data).toString("base64") } };
  });
}

/**
 * One structured-output call. The reply is constrained to `schema` by the
 * API and validated again with Zod here. Streams (collected with
 * finalMessage) so long outputs don't hit HTTP timeouts.
 */
export async function callStructured<T>(opts: {
  system: string;
  content: ContentPart[];
  schema: ZodType<T>;
  effort: Effort;
  maxTokens?: number;
}): Promise<{ data: T; usage: Usage; model: string }> {
  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await getClient().beta.messages.stream({
      model: QPS_MODEL,
      max_tokens: opts.maxTokens ?? 32_000,
      // The system prompt is identical across a job's batches, so cache it.
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: toBlocks(opts.content) }],
      output_config: { effort: opts.effort, format: zodOutputFormat(opts.schema) },
      // If a safety classifier declines (e.g. a biology paper tripping a
      // filter), Anthropic re-runs on its recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    }).finalMessage();
  } catch (err) {
    throw toAIError(err);
  }

  const usage = { inputTokens: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0), outputTokens: res.usage.output_tokens };
  if (res.stop_reason === "refusal") throw new AIError("The AI declined to process this content.", false);
  if (res.stop_reason === "max_tokens") throw new AIError("The AI's reply was cut off (output limit).", true);

  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AIError("The AI returned malformed output.", true);
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new AIError(`The AI output failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`, true);
  return { data: parsed.data, usage, model: res.model };
}

function toAIError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  // APIConnectionError (incl. timeouts) extends APIError, so check it first.
  if (err instanceof Anthropic.APIConnectionError) return new AIError(`Could not reach the AI service: ${err.message}`, true);
  if (err instanceof Anthropic.AuthenticationError) return new AIError("AI API key is invalid (check ANTHROPIC_API_KEY).", false, 401);
  if (err instanceof Anthropic.BadRequestError) return new AIError(`AI request rejected: ${err.message}`, false, 400);
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    return new AIError(`AI service error ${status ?? ""}: ${err.message}`.trim(), status === 429 || (status !== undefined && status >= 500), status);
  }
  return new AIError(`AI request failed: ${(err as Error)?.message ?? String(err)}`, true);
}
