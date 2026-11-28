import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import {
  BudgetExceededError, runAgentTask, worstCaseCost, type AiBudget, type TaskStore, type UsageRecord,
} from "@/lib/seo-agent/agents/run-task";
import { AnthropicProvider, supportsServerFallback } from "@/lib/seo-agent/ai/anthropic";
import { adminSeoKeywordRows, adminSeoKeywordToRow } from "@/lib/seo-agent/keyword-sync";
import { SEO_KEYWORDS } from "@/lib/admin/seo-data";
import { DEFAULT_SEO_SETTINGS, settingsFromRow, settingsToRow, seoSettingsSchema, type SeoSettingsRow } from "@/lib/seo-agent/settings-schema";
import { autopilotAiSettings } from "@/lib/seo-agent/autopilot";
import { coverAltText, coverChips, coverTitle, coverTitleSize } from "@/lib/seo-agent/cover-image";
import { FakeProvider } from "./helpers";

describe("keyword sync from /admin/seo", () => {
  it("maps priority, intent, class and subject, and marks the source", () => {
    const row = adminSeoKeywordToRow({
      keyword: "  IMO Mock Test   class 5 ", cluster: "Mock tests & papers", intent: "transactional",
      volume: "1K–10K", difficulty: "medium", priority: "P1", targetPage: "/start",
    });
    expect(row).toMatchObject({
      keyword: "IMO Mock Test class 5", search_intent: "TRANSACTIONAL", priority: "HIGH",
      target_class: 5, subject: "Mathematics", status: "ACTIVE", source: "ADMIN_SEO",
    });
    expect(row.notes).toMatch(/estimates/);
    expect(row.notes).toContain("/start");
  });

  it("covers every /admin/seo keyword once, with valid values for the table's checks", () => {
    const rows = adminSeoKeywordRows();
    const unique = new Set(SEO_KEYWORDS.map((k) => k.keyword.trim().toLowerCase().replace(/\s+/g, " ")));
    expect(rows).toHaveLength(unique.size);
    for (const r of rows) {
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(r.priority);
      expect(["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "TRANSACTIONAL"]).toContain(r.search_intent);
      expect(r.keyword.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("drops duplicates (first one wins)", () => {
    const k = { cluster: "Preparation" as const, intent: "informational" as const, volume: "<1K" as const, difficulty: "low" as const, targetPage: "/" };
    const rows = adminSeoKeywordRows([{ ...k, keyword: "Olympiad tips", priority: "P1" }, { ...k, keyword: "olympiad  TIPS", priority: "P3" }]);
    expect(rows).toEqual([expect.objectContaining({ keyword: "Olympiad tips", priority: "HIGH" })]);
  });
});

function memoryStore() {
  const usage: UsageRecord[] = [];
  const store: TaskStore = {
    async createTask() { return "task-1"; },
    async finishTask() {},
    async recordUsage(u) { usage.push(u); },
  };
  return { store, usage };
}

const opts = { agentType: "ContentWriter", taskType: "write", category: "CONTENT" as const };
const schema = z.object({ ok: z.boolean() });
const pricing = { "claude-haiku-5-5": { input: 0.1, output: 0.5 } };

function budget(spent: number, limitUsd = 0.1): AiBudget & { calls: number } {
  const b = { scope: "AUTOPILOT" as const, limitUsd, calls: 0, async spentUsd() { b.calls++; return spent; } };
  return b;
}

describe("daily budget guard", () => {
  it("worst case = padded prompt estimate + the whole output allowance", () => {
    const cost = worstCaseCost(pricing, "claude-haiku-5-5", { system: "x".repeat(400), prompt: "", maxOutputTokens: 32_000 }, (t) => Math.ceil(t.length / 4));
    // 100 tokens × 1.5 padding = 150 input; 32k output. (150×0.1 + 32000×0.5) / 1M
    expect(cost).toBeCloseTo((150 * 0.1 + 32_000 * 0.5) / 1_000_000, 10);
    expect(worstCaseCost(pricing, "unpriced", { system: "", prompt: "" }, () => 0)).toBeNull();
  });

  it("lets a call through under the budget and tags its usage AUTOPILOT", async () => {
    const { store, usage } = memoryStore();
    const provider = new FakeProvider([JSON.stringify({ ok: true })], "claude-haiku-5-5");
    const b = budget(0.02);
    await runAgentTask(opts, { store, provider, pricing, budget: b }, async ({ ai }) => {
      const { data } = await ai.generateStructuredOutput({ system: "s", prompt: "p", schema, schemaName: "X", maxOutputTokens: 32_000 });
      return { result: data, outputSummary: "ok" };
    });
    expect(b.calls).toBe(1);
    expect(usage).toEqual([expect.objectContaining({ budget_scope: "AUTOPILOT", model: "claude-haiku-5-5" })]);
  });

  it("refuses a call that could go over the budget, before calling the model", async () => {
    const { store } = memoryStore();
    const provider = new FakeProvider([JSON.stringify({ ok: true })], "claude-haiku-5-5");
    const run = runAgentTask(opts, { store, provider, pricing, budget: budget(0.09) }, async ({ ai }) => {
      await ai.generateStructuredOutput({ system: "s", prompt: "p", schema, schemaName: "X", maxOutputTokens: 32_000 }); // up to ~$0.016
      return { result: null, outputSummary: "x" };
    });
    await expect(run).rejects.toBeInstanceOf(BudgetExceededError);
    expect(provider.requests).toHaveLength(0);
  });

  it("fails closed when the model has no price", async () => {
    const { store } = memoryStore();
    const provider = new FakeProvider([JSON.stringify({ ok: true })], "mystery-model");
    const run = runAgentTask(opts, { store, provider, pricing, budget: budget(0) }, async ({ ai }) => {
      await ai.generateText({ system: "s", prompt: "p" });
      return { result: null, outputSummary: "x" };
    });
    await expect(run).rejects.toThrow(/No price is set for mystery-model/);
    expect(provider.requests).toHaveLength(0);
  });

  it("leaves manual runs (no budget) untouched", async () => {
    const { store, usage } = memoryStore();
    const provider = new FakeProvider(["hi"], "claude-opus-5-5");
    await runAgentTask(opts, { store, provider, pricing: {} }, async ({ ai }) => {
      await ai.generateText({ system: "s", prompt: "p" });
      return { result: null, outputSummary: "x" };
    });
    expect(usage[0].budget_scope).toBeUndefined();
  });

  it("the default autopilot day (analysis + plan + write + SEO review) fits the default budget even in the worst case", () => {
    // Output allowances used by the agents; prompts are padded generously (40k chars ≈ 10k tokens each).
    const big = "x".repeat(40_000);
    const steps = [16_000, 16_000, 32_000, 16_000];
    const est = (t: string) => Math.ceil(t.length / 4);
    const total = steps.reduce((s, max) => s + worstCaseCost(DEFAULT_SEO_SETTINGS.aiPricing, "claude-haiku-5-5", { system: big, prompt: big, maxOutputTokens: max }, est)!, 0);
    expect(total).toBeLessThan(DEFAULT_SEO_SETTINGS.automationDailyBudgetUsd);
  });
});

describe("Haiku requests", () => {
  const okMessage = { model: "claude-haiku-5-5", stop_reason: "end_turn", content: [{ type: "text", text: "hi" }], usage: { input_tokens: 1, output_tokens: 1 } };
  function fakeClient() {
    const create = vi.fn(async (params: Record<string, unknown>) => { void params; return okMessage; });
    const stream = (params: Record<string, unknown>) => ({ finalMessage: () => create(params) });
    return { client: { beta: { messages: { stream } } } as unknown as Anthropic, create };
  }

  it("don't send the server-side fallback (Haiku has none); Opus still does", async () => {
    expect(supportsServerFallback("claude-haiku-5-5")).toBe(false);
    expect(supportsServerFallback("claude-opus-5-5")).toBe(true);

    const haiku = fakeClient();
    await new AnthropicProvider("", "claude-haiku-5-5", haiku.client).generateText({ system: "s", prompt: "p", effort: "low" });
    const sent = haiku.create.mock.calls[0][0];
    expect(sent).not.toHaveProperty("fallbacks");
    expect(sent).not.toHaveProperty("betas");
    expect(sent).toMatchObject({ model: "claude-haiku-5-5", output_config: { effort: "low" } });

    const opus = fakeClient();
    await new AnthropicProvider("", "claude-opus-5-5", opus.client).generateText({ system: "s", prompt: "p" });
    expect(opus.create.mock.calls[0][0]).toMatchObject({ fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
  });
});

describe("autopilot settings", () => {
  const baseRow = { ...settingsToRow(DEFAULT_SEO_SETTINGS), default_publish_time: "10:00:00" } as SeoSettingsRow;

  it("defaults to off, Haiku 5.5 and $0.10/day, also on a database without migration 026", () => {
    const { automation_model: _m, automation_daily_budget_usd: _b, ...old } = baseRow;
    void _m; void _b;
    expect(settingsFromRow(old as SeoSettingsRow)).toMatchObject({ automationEnabled: false, automationModel: "claude-haiku-5-5", automationDailyBudgetUsd: 0.1 });
  });

  it("reads the numeric budget PostgREST sends as a string", () => {
    expect(settingsFromRow({ ...baseRow, automation_enabled: true, automation_daily_budget_usd: "0.0500" }).automationDailyBudgetUsd).toBe(0.05);
  });

  it("the Settings form never writes the on/off switch", () => {
    expect(settingsToRow({ ...DEFAULT_SEO_SETTINGS, automationEnabled: true })).not.toHaveProperty("automation_enabled");
  });

  it("rejects a zero, negative or huge budget", () => {
    for (const v of [0, -1, 10, Number.NaN]) {
      expect(seoSettingsSchema.safeParse({ ...DEFAULT_SEO_SETTINGS, searchConsoleSiteUrl: "", automationDailyBudgetUsd: v }).success).toBe(false);
    }
  });

  it("swaps in the autopilot model and keeps everything else", () => {
    const s = autopilotAiSettings({ ...DEFAULT_SEO_SETTINGS, aiModel: "claude-opus-5-5", automationModel: "claude-haiku-5-5" });
    expect(s.aiModel).toBe("claude-haiku-5-5");
    expect(s.brand).toEqual(DEFAULT_SEO_SETTINGS.brand);
  });

  it("ships a price for the default autopilot model (the guard refuses unpriced models)", () => {
    expect(DEFAULT_SEO_SETTINGS.aiPricing[DEFAULT_SEO_SETTINGS.automationModel]).toEqual({ input: 0.1, output: 0.5 });
  });
});

describe("cover image text", () => {
  it("shrinks long titles and truncates very long ones", () => {
    expect(coverTitleSize("Short title")).toBeGreaterThan(coverTitleSize("A".repeat(80)));
    expect(coverTitle("x ".repeat(100)).length).toBeLessThanOrEqual(110);
    expect(coverTitle("  Many   spaces ")).toBe("Many spaces");
  });

  it("renders a 1200×630 PNG", async () => {
    const { renderCoverImage } = await import("@/lib/seo-agent/cover-image");
    const png = await renderCoverImage({ title: "How to Prepare for the IMO in Class 5", category: "Olympiad Prep", targetClass: 5, subject: "Mathematics" });
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const view = new DataView(png.buffer, png.byteOffset);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]); // IHDR width, height
    expect(png.byteLength).toBeLessThan(5 * 1024 * 1024); // fits the blog-images bucket limit
  }, 30_000);

  it("shows class and subject when known, and has descriptive alt text", () => {
    expect(coverChips({ title: "t", category: null, targetClass: 5, subject: "Mathematics" })).toEqual(["Class 5", "Mathematics"]);
    expect(coverChips({ title: "t", category: null, targetClass: null, subject: null })).toEqual([]);
    expect(coverAltText({ title: "IMO tips for Class 5" })).toBe("IMO tips for Class 5: OlympiadIQ blog cover");
  });
});
