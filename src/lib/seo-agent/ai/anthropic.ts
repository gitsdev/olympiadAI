// Claude implementation of AIProvider, via the official Anthropic SDK.
// The only file in the SEO Agent that knows Anthropic's request/response shape.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { BaseAIProvider } from "./provider";
import { AIProviderError, type GenerateTextRequest, type GenerateTextResult } from "./types";

// Leaves room for adaptive thinking plus the JSON answer. Requests are
// streamed (and collected with finalMessage()), so long outputs such as full
// articles don't run into HTTP timeouts.
const DEFAULT_MAX_TOKENS = 16_000;

export class AnthropicProvider extends BaseAIProvider {
  readonly id = "anthropic";
  override readonly nativeStructuredOutput = true;
  private readonly client: Anthropic;

  constructor(apiKey: string, readonly model: string, client?: Anthropic) {
    super();
    if (!client && !apiKey) throw new AIProviderError("ANTHROPIC_API_KEY is not set.", "anthropic");
    this.client = client ?? new Anthropic({ apiKey, maxRetries: 2, timeout: 180_000 });
  }

  async generateText(req: GenerateTextRequest): Promise<GenerateTextResult> {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await this.client.beta.messages.stream({
        model: this.model,
        max_tokens: req.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
        output_config: {
          // Opus 5.5 defaults to "medium"; set it explicitly so behaviour
          // doesn't shift if the model default changes.
          effort: req.effort ?? "medium",
          // Native structured outputs: the response is constrained to the
          // schema's shape. Length/range limits the API can't enforce are
          // still checked by Zod in BaseAIProvider.
          ...(req.outputSchema ? { format: zodOutputFormat(req.outputSchema) } : {}),
        },
        // If a safety classifier declines, Anthropic re-runs the request on
        // its recommended fallback model instead of returning a refusal.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      }).finalMessage();
    } catch (err) {
      throw toProviderError(err);
    }

    if (res.stop_reason === "refusal") {
      throw new AIProviderError("Claude declined this request (and the fallback model did too).", "anthropic");
    }
    if (res.stop_reason === "max_tokens") {
      throw new AIProviderError("Claude's reply hit the output token limit and was cut off.", "anthropic");
    }

    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!text) throw new AIProviderError(`Claude returned no text (stop_reason: ${res.stop_reason ?? "unknown"}).`, "anthropic");

    return {
      text,
      model: res.model,
      usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
    };
  }
}

/** Maps SDK errors to AIProviderError, keeping status and retryability. */
function toProviderError(err: unknown): AIProviderError {
  // APIConnectionError extends APIError in the TS SDK, so check it first.
  if (err instanceof Anthropic.APIConnectionError) {
    return new AIProviderError(`Could not reach the Claude API: ${err.message}`, "anthropic", undefined, true);
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new AIProviderError("Claude API key is invalid (check ANTHROPIC_API_KEY).", "anthropic", 401, false);
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    const retryable = status === 429 || (status !== undefined && status >= 500);
    return new AIProviderError(`Claude API error ${status ?? ""}: ${err.message}`.trim(), "anthropic", status, retryable);
  }
  return new AIProviderError(`Claude request failed: ${(err as Error)?.message ?? String(err)}`, "anthropic");
}
