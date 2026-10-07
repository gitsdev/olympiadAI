import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runAgentTask, type NewTask, type TaskPatch, type TaskStore, type UsageRecord } from "@/lib/seo-agent/agents/run-task";
import { FakeProvider } from "./helpers";

function memoryStore() {
  type StoredTask = Omit<NewTask, "status"> & Partial<Omit<TaskPatch, "status">> & { status: NewTask["status"] | TaskPatch["status"] };
  const tasks = new Map<string, StoredTask>();
  const usage: UsageRecord[] = [];
  const store: TaskStore = {
    async createTask(t) { const id = `task-${tasks.size + 1}`; tasks.set(id, { ...t }); return id; },
    async finishTask(id, patch) { tasks.set(id, { ...tasks.get(id)!, ...patch }); },
    async recordUsage(u) { usage.push(u); },
  };
  return { store, tasks, usage };
}

const opts = { agentType: "KeywordAgent", taskType: "analyze_keywords", category: "KEYWORD_ANALYSIS" as const, inputSummary: "1 keyword" };
const schema = z.object({ ok: z.boolean() });
const pricing = { "fake-model": { input: 1, output: 2 } }; // $ per 1M tokens

describe("runAgentTask", () => {
  it("logs a COMPLETED task with tokens, cost and per-call usage", async () => {
    const { store, tasks, usage } = memoryStore();
    const provider = new FakeProvider(['{"ok":1}', '{"ok":true}']); // first reply invalid → retry
    const result = await runAgentTask(opts, { store, provider, pricing }, async ({ ai }) => {
      const { data } = await ai.generateStructuredOutput({ system: "s", prompt: "p", schema, schemaName: "X" });
      return { result: data.ok, outputSummary: "done", entityId: "11111111-1111-1111-1111-111111111111" };
    });

    expect(result).toBe(true);
    const task = tasks.get("task-1")!;
    expect(task).toMatchObject({
      status: "COMPLETED", agent_type: "KeywordAgent", output_summary: "done", error: null,
      input_tokens: 200, output_tokens: 100, entity_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(task.estimated_cost).toBeCloseTo((200 * 1 + 100 * 2) / 1e6);
    expect(task.completed_at).toBeTruthy();
    // Both attempts are metered, including the rejected one.
    expect(usage).toHaveLength(2);
    expect(usage.every((u) => u.category === "KEYWORD_ANALYSIS" && u.agent_task_id === "task-1")).toBe(true);
  });

  it("marks the task FAILED (never COMPLETED) and rethrows", async () => {
    const { store, tasks } = memoryStore();
    const provider = new FakeProvider(['{"nope":1}', '{"nope":2}']);
    await expect(runAgentTask(opts, { store, provider, pricing }, async ({ ai }) => {
      await ai.generateStructuredOutput({ system: "s", prompt: "p", schema, schemaName: "X" });
      return { result: null, outputSummary: "unreachable" };
    })).rejects.toThrow(/failed validation/);

    const task = tasks.get("task-1")!;
    expect(task.status).toBe("FAILED");
    expect(task.error).toMatch(/failed validation/);
    expect(task.output_summary).toBeUndefined();
    expect(task.input_tokens).toBe(200); // failed attempts still cost money
  });

  it("records cost as null (unknown) when the model has no pricing", async () => {
    const { store, tasks, usage } = memoryStore();
    await runAgentTask(opts, { store, provider: new FakeProvider(["hello"]), pricing: {} }, async ({ ai }) => {
      await ai.generateText({ system: "s", prompt: "p" });
      return { result: null, outputSummary: "ok" };
    });
    expect(tasks.get("task-1")!.estimated_cost).toBeNull();
    expect(usage[0].estimated_cost).toBeNull();
  });

  it("keeps the AI result if metering fails", async () => {
    const { store, tasks } = memoryStore();
    store.recordUsage = async () => { throw new Error("db down"); };
    const r = await runAgentTask(opts, { store, provider: new FakeProvider(["x"]), pricing }, async ({ ai }) => {
      const res = await ai.generateText({ system: "s", prompt: "p" });
      return { result: res.text, outputSummary: "ok" };
    });
    expect(r).toBe("x");
    expect(tasks.get("task-1")!.status).toBe("COMPLETED");
  });

  it("creates the task before doing any work", async () => {
    const { store, tasks } = memoryStore();
    await runAgentTask(opts, { store, provider: new FakeProvider([]), pricing }, async () => {
      expect(tasks.get("task-1")?.status).toBe("RUNNING");
      return { result: null, outputSummary: "ok" };
    });
  });
});
