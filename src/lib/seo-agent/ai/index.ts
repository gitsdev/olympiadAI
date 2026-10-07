import "server-only";

import type { SeoSettings } from "../settings-schema";
import { AnthropicProvider } from "./anthropic";
import type { AIProvider } from "./types";

/**
 * Builds the provider chosen in Settings. API keys are read here, on the
 * server, and never leave it. Add new providers as another case; agents
 * don't change.
 */
export function createAIProvider(settings: Pick<SeoSettings, "aiProvider" | "aiModel">): AIProvider {
  switch (settings.aiProvider) {
    case "anthropic":
      return new AnthropicProvider(process.env.ANTHROPIC_API_KEY ?? "", settings.aiModel);
  }
}

export type { AIProvider } from "./types";
