// Provider-neutral AI types. Agents depend on these only — never on a
// specific vendor SDK or response shape.

import type { ZodType } from "zod";

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateTextRequest {
  system: string;
  prompt: string;
  /** "json" asks the model for a single JSON object. */
  responseFormat?: "text" | "json";
  maxOutputTokens?: number;
  /** Omitted by default: some models only accept their default temperature. */
  temperature?: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  usage: AIUsage;
}

export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  schema: ZodType<T>;
  /** Short name used in prompts and errors, e.g. "KeywordAnalysis". */
  schemaName: string;
  maxOutputTokens?: number;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  /** Summed over every attempt, including a failed first one. */
  usage: AIUsage;
  attempts: number;
}

export interface AIProvider {
  readonly id: string;
  readonly model: string;
  generateText(req: GenerateTextRequest): Promise<GenerateTextResult>;
  /** JSON output validated against `schema`; retries once on invalid output. */
  generateStructuredOutput<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
  /** Alias of generateStructuredOutput for analysis-style agents. */
  analyze<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
  /** Rough pre-call token estimate (~4 chars/token). An estimate, not billing data. */
  estimateUsage(text: string): number;
}

/** Transport or API failure (network, auth, rate limit, server error). */
export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
    /** True for 429/5xx/network errors that may succeed later. */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

/** The model's output failed JSON parsing or schema validation twice. */
export class StructuredOutputError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
    readonly usage: AIUsage,
    readonly model: string,
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}
