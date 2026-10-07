import "server-only";

import type { SeoSettings } from "../settings-schema";
import { OpenAIProvider } from "./openai";
import type { AIProvider } from "./types";

/**
 * Builds the provider chosen in Settings. API keys are read here, on the
 * server, and never leave it. Add new providers (Gemini, Anthropic …) as
 * another case — agents don't change.
 */
export function createAIProvider(settings: Pick<SeoSettings, "aiProvider" | "aiModel">): AIProvider {
  switch (settings.aiProvider) {
    case "openai":
      return new OpenAIProvider(process.env.OPENAI_API_KEY ?? "", settings.aiModel);
  }
}

export type { AIProvider } from "./types";
