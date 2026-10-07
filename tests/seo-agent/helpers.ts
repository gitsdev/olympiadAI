import { BaseAIProvider } from "@/lib/seo-agent/ai/provider";
import type { AIUsage, GenerateTextRequest, GenerateTextResult } from "@/lib/seo-agent/ai/types";

/** Provider that replays scripted replies and records every request. */
export class FakeProvider extends BaseAIProvider {
  readonly id = "fake";
  readonly requests: GenerateTextRequest[] = [];

  constructor(
    private readonly replies: (string | Error)[],
    readonly model = "fake-model",
    private readonly usage: AIUsage = { inputTokens: 100, outputTokens: 50 },
  ) {
    super();
  }

  async generateText(req: GenerateTextRequest): Promise<GenerateTextResult> {
    this.requests.push(req);
    const next = this.replies.shift();
    if (next === undefined) throw new Error("FakeProvider: no scripted reply left");
    if (next instanceof Error) throw next;
    return { text: next, model: this.model, usage: this.usage };
  }
}
