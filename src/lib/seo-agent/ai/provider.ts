// Base class shared by every AI provider. Providers implement generateText();
// structured output (JSON → Zod validation → one corrective retry) lives here
// so it behaves identically regardless of vendor.

import { z, type ZodType } from "zod";
import {
  StructuredOutputError,
  type AIProvider, type AIUsage, type GenerateTextRequest, type GenerateTextResult,
  type StructuredRequest, type StructuredResult,
} from "./types";

/** Pulls the JSON object out of a reply, tolerating ```json fences. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

/** Human-readable validation problems, capped so retry prompts stay small. */
export function describeIssues(err: z.ZodError): string[] {
  return err.issues.slice(0, 15).map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`);
}

function schemaInstructions<T>(schema: ZodType<T>, name: string, native: boolean): string {
  let jsonSchema = "";
  // Providers that enforce the schema natively don't need it repeated in the prompt.
  if (!native) try {
    jsonSchema = JSON.stringify(z.toJSONSchema(schema), null, 1);
  } catch {
    // Some Zod features (transforms) have no JSON Schema form; the prompt's
    // own description of the shape still applies.
  }
  return [
    `Respond with a single JSON object named ${name} and nothing else: no prose, no markdown fences.`,
    jsonSchema && `It must validate against this JSON Schema:\n${jsonSchema}`,
  ].filter(Boolean).join("\n");
}

function addUsage(a: AIUsage, b: AIUsage): AIUsage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
}

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly id: string;
  abstract readonly model: string;
  readonly nativeStructuredOutput: boolean = false;
  abstract generateText(req: GenerateTextRequest): Promise<GenerateTextResult>;

  async generateStructuredOutput<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const system = `${req.system}\n\n${schemaInstructions(req.schema, req.schemaName, this.nativeStructuredOutput)}`;
    let usage: AIUsage = { inputTokens: 0, outputTokens: 0 };
    let model = this.model;
    let prompt = req.prompt;
    let issues: string[] = [];

    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await this.generateText({
        system, prompt, responseFormat: "json", outputSchema: req.schema,
        maxOutputTokens: req.maxOutputTokens, effort: req.effort,
      });
      usage = addUsage(usage, res.usage);
      model = res.model;

      let candidate: unknown;
      try {
        candidate = extractJson(res.text);
      } catch (e) {
        issues = [`Output was not valid JSON (${(e as Error).message}).`];
      }
      if (candidate !== undefined) {
        const parsed = req.schema.safeParse(candidate);
        if (parsed.success) return { data: parsed.data, model, usage, attempts: attempt };
        issues = describeIssues(parsed.error);
      }

      // One corrective retry: show the model exactly what was wrong.
      prompt = `${req.prompt}\n\nYour previous reply was rejected:\n- ${issues.join("\n- ")}\n\nReturn a corrected ${req.schemaName} JSON object that fixes every problem listed.`;
    }

    throw new StructuredOutputError(
      `${req.schemaName}: AI output failed validation after 2 attempts — ${issues.slice(0, 3).join("; ")}`,
      issues, usage, model,
    );
  }

  analyze<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    return this.generateStructuredOutput(req);
  }

  estimateUsage(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
