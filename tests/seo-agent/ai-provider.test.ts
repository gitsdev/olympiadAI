import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicProvider } from "@/lib/seo-agent/ai/anthropic";
import { extractJson } from "@/lib/seo-agent/ai/provider";
import { AIProviderError, StructuredOutputError } from "@/lib/seo-agent/ai/types";
import { FakeProvider } from "./helpers";

type CreateParams = Record<string, unknown> & { output_config?: { effort?: string; format?: { type: string } } };

/** A stand-in for the Anthropic SDK client: no network in tests. */
function fakeClient(reply: (params: CreateParams) => unknown) {
  const create = vi.fn(async (params: CreateParams) => reply(params));
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

const okMessage = {
  model: "claude-opus-5-5",
  stop_reason: "end_turn",
  content: [
    { type: "thinking", thinking: "", signature: "x" },
    { type: "text", text: '{"a":' },
    { type: "text", text: "1}" },
  ],
  usage: { input_tokens: 120, output_tokens: 30 },
};

describe("AnthropicProvider", () => {
  it("calls Claude with structured output, explicit effort and server-side fallback", async () => {
    const { client, create } = fakeClient(() => okMessage);
    const p = new AnthropicProvider("", "claude-opus-5-5", client);
    const res = await p.generateText({ system: "sys", prompt: "hi", outputSchema: z.object({ a: z.number() }), maxOutputTokens: 500 });

    // Thinking blocks are skipped; text blocks are joined.
    expect(res).toEqual({ text: '{"a":1}', model: "claude-opus-5-5", usage: { inputTokens: 120, outputTokens: 30 } });
    const params = create.mock.calls[0][0];
    expect(params).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 500,
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    expect(params.output_config?.effort).toBe("medium");
    expect(params.output_config?.format?.type).toBe("json_schema");
    // Opus 5.5 rejects sampling params and disabled thinking.
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("thinking");
  });

  it("sends no output format for plain text and honours a requested effort", async () => {
    const { client, create } = fakeClient(() => okMessage);
    await new AnthropicProvider("", "claude-opus-5-5", client).generateText({ system: "s", prompt: "p", effort: "high" });
    expect(create.mock.calls[0][0].output_config).toEqual({ effort: "high" });
    expect(create.mock.calls[0][0].max_tokens).toBe(16000);
  });

  it("refuses to construct without an API key", () => {
    expect(() => new AnthropicProvider("", "claude-opus-5-5")).toThrow(/ANTHROPIC_API_KEY/);
  });

  it.each([
    [401, false],
    [400, false],
    [429, true],
    [529, true],
  ])("maps HTTP %i to AIProviderError (retryable=%s)", async (status, retryable) => {
    const { client } = fakeClient(() => {
      throw Anthropic.APIError.generate(status, { error: { message: "nope" } }, "nope", new Headers());
    });
    const err = (await new AnthropicProvider("", "m", client).generateText({ system: "s", prompt: "p" }).catch((e: unknown) => e)) as AIProviderError;
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.status).toBe(status);
    expect(err.retryable).toBe(retryable);
  });

  it("treats connection failures as retryable", async () => {
    const { client } = fakeClient(() => { throw new Anthropic.APIConnectionError({ message: "socket hang up" }); });
    const err = (await new AnthropicProvider("", "m", client).generateText({ system: "s", prompt: "p" }).catch((e: unknown) => e)) as AIProviderError;
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.retryable).toBe(true);
  });

  it("surfaces refusals, truncation and empty replies as errors", async () => {
    const run = (msg: unknown) => new AnthropicProvider("", "m", fakeClient(() => msg).client).generateText({ system: "s", prompt: "p" });
    await expect(run({ ...okMessage, stop_reason: "refusal", content: [] })).rejects.toThrow(/declined/);
    await expect(run({ ...okMessage, stop_reason: "max_tokens" })).rejects.toThrow(/cut off/);
    await expect(run({ ...okMessage, content: [{ type: "thinking", thinking: "", signature: "x" }] })).rejects.toThrow(/no text/);
  });

  it("does not repeat the JSON schema in the prompt (the API enforces it)", async () => {
    const { client, create } = fakeClient(() => ({ ...okMessage, content: [{ type: "text", text: '{"title":"Hello","score":5}' }] }));
    await new AnthropicProvider("", "m", client).generateStructuredOutput({
      system: "sys", prompt: "p", schemaName: "Thing", schema: z.object({ title: z.string(), score: z.number() }),
    });
    expect(create.mock.calls[0][0].system).not.toContain("JSON Schema");
  });
});

describe("structured output (§36)", () => {
  const schema = z.object({ title: z.string().min(3), score: z.number().int().min(0).max(100) });
  const req = { system: "You are a test.", prompt: "Make it.", schema, schemaName: "Thing" };

  it("returns validated data on the first valid reply", async () => {
    const p = new FakeProvider(['{"title":"Hello","score":90}']);
    const res = await p.generateStructuredOutput(req);
    expect(res).toMatchObject({ data: { title: "Hello", score: 90 }, attempts: 1, usage: { inputTokens: 100, outputTokens: 50 } });
    expect(p.requests[0].responseFormat).toBe("json");
    expect(p.requests[0].system).toContain("JSON Schema");
  });

  it("retries once with the validation errors, then succeeds", async () => {
    const p = new FakeProvider(['{"title":"Hi","score":150}', '{"title":"Hello","score":91}']);
    const res = await p.generateStructuredOutput(req);
    expect(res.attempts).toBe(2);
    expect(res.data.score).toBe(91);
    expect(res.usage).toEqual({ inputTokens: 200, outputTokens: 100 });
    expect(p.requests[1].prompt).toContain("previous reply was rejected");
    expect(p.requests[1].prompt).toMatch(/score/);
    expect(p.requests[1].prompt).toMatch(/title/);
  });

  it("retries after non-JSON output", async () => {
    const p = new FakeProvider(["Sure! Here you go", '{"title":"Hello","score":1}']);
    const res = await p.generateStructuredOutput(req);
    expect(res.attempts).toBe(2);
    expect(p.requests[1].prompt).toContain("not valid JSON");
  });

  it("fails after two invalid replies — never accepts malformed output", async () => {
    const p = new FakeProvider(['{"title":1}', '{"score":"x"}']);
    const err = await p.generateStructuredOutput(req).catch((e) => e);
    expect(err).toBeInstanceOf(StructuredOutputError);
    expect(err.usage).toEqual({ inputTokens: 200, outputTokens: 100 });
    expect(err.issues.length).toBeGreaterThan(0);
    expect(p.requests).toHaveLength(2);
  });

  it("does not retry transport errors (those are the caller's to handle)", async () => {
    const p = new FakeProvider([new AIProviderError("down", "fake", 503, true)]);
    await expect(p.generateStructuredOutput(req)).rejects.toBeInstanceOf(AIProviderError);
    expect(p.requests).toHaveLength(1);
  });

  it("accepts JSON wrapped in a markdown fence", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson(' {"a":2} ')).toEqual({ a: 2 });
  });

  it("estimates tokens roughly (≈4 chars/token)", () => {
    expect(new FakeProvider([]).estimateUsage("x".repeat(400))).toBe(100);
  });
});
