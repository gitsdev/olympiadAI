import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { OpenAIProvider } from "@/lib/seo-agent/ai/openai";
import { extractJson } from "@/lib/seo-agent/ai/provider";
import { AIProviderError, StructuredOutputError } from "@/lib/seo-agent/ai/types";
import { FakeProvider } from "./helpers";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

const okBody = {
  model: "gpt-test-2026-01-01",
  choices: [{ message: { content: '{"a":1}' }, finish_reason: "stop" }],
  usage: { prompt_tokens: 120, completion_tokens: 30 },
};

describe("OpenAIProvider", () => {
  it("sends a chat completion with JSON mode and parses usage", async () => {
    const fetchImpl = mockFetch(200, okBody);
    const p = new OpenAIProvider("sk-test", "gpt-test", fetchImpl as unknown as typeof fetch);
    const res = await p.generateText({ system: "sys", prompt: "hi", responseFormat: "json", maxOutputTokens: 500 });

    expect(res).toEqual({ text: '{"a":1}', model: "gpt-test-2026-01-01", usage: { inputTokens: 120, outputTokens: 30 } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "gpt-test", response_format: { type: "json_object" }, max_completion_tokens: 500 });
    expect(body.messages).toEqual([{ role: "system", content: "sys" }, { role: "user", content: "hi" }]);
    expect(body).not.toHaveProperty("temperature");
  });

  it("refuses to construct without an API key", () => {
    expect(() => new OpenAIProvider("", "gpt-test")).toThrow(/OPENAI_API_KEY/);
  });

  it.each([
    [401, false],
    [400, false],
    [429, true],
    [503, true],
  ])("maps HTTP %i to AIProviderError (retryable=%s)", async (status, retryable) => {
    const p = new OpenAIProvider("sk", "m", mockFetch(status, { error: { message: "nope" } }) as unknown as typeof fetch);
    const err = await p.generateText({ system: "s", prompt: "p" }).catch((e) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.status).toBe(status);
    expect(err.retryable).toBe(retryable);
    expect(err.message).toContain("nope");
  });

  it("treats network failures as retryable", async () => {
    const p = new OpenAIProvider("sk", "m", (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch);
    const err = await p.generateText({ system: "s", prompt: "p" }).catch((e) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.retryable).toBe(true);
  });

  it("surfaces refusals and empty replies as errors", async () => {
    const refusal = { choices: [{ message: { content: null, refusal: "can't help" } }] };
    const empty = { choices: [{ message: { content: "" }, finish_reason: "length" }] };
    await expect(new OpenAIProvider("sk", "m", mockFetch(200, refusal) as unknown as typeof fetch).generateText({ system: "s", prompt: "p" })).rejects.toThrow(/refused/);
    await expect(new OpenAIProvider("sk", "m", mockFetch(200, empty) as unknown as typeof fetch).generateText({ system: "s", prompt: "p" })).rejects.toThrow(/finish_reason: length/);
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
