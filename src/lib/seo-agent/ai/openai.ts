// OpenAI implementation of AIProvider (Chat Completions over fetch; no SDK).
// The only file in the SEO Agent that knows OpenAI's request/response shape.

import { BaseAIProvider } from "./provider";
import { AIProviderError, type GenerateTextRequest, type GenerateTextResult } from "./types";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 120_000;

interface ChatCompletionResponse {
  model?: string;
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export class OpenAIProvider extends BaseAIProvider {
  readonly id = "openai";

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    super();
    if (!apiKey) throw new AIProviderError("OPENAI_API_KEY is not set.", "openai");
  }

  async generateText(req: GenerateTextRequest): Promise<GenerateTextResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
    };
    if (req.responseFormat === "json") body.response_format = { type: "json_object" };
    if (req.maxOutputTokens) body.max_completion_tokens = req.maxOutputTokens;
    if (req.temperature !== undefined) body.temperature = req.temperature;

    let res: Response;
    try {
      res = await this.fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new AIProviderError(`OpenAI request failed: ${(err as Error).message}`, "openai", undefined, true);
    }

    let json: ChatCompletionResponse;
    try {
      json = (await res.json()) as ChatCompletionResponse;
    } catch {
      throw new AIProviderError(`OpenAI returned a non-JSON response (HTTP ${res.status}).`, "openai", res.status, res.status >= 500);
    }

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new AIProviderError(`OpenAI error ${res.status}: ${json.error?.message ?? "unknown error"}`, "openai", res.status, retryable);
    }

    const choice = json.choices?.[0];
    if (choice?.message?.refusal) {
      throw new AIProviderError(`OpenAI refused the request: ${choice.message.refusal}`, "openai", res.status);
    }
    const text = choice?.message?.content;
    if (!text) {
      throw new AIProviderError(`OpenAI returned no content (finish_reason: ${choice?.finish_reason ?? "unknown"}).`, "openai", res.status);
    }

    return {
      text,
      model: json.model ?? this.model,
      usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 },
    };
  }
}
