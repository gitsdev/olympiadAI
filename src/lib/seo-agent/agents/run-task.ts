// Runs one agent operation with full bookkeeping (spec §30, §31, §40):
//   * creates a seo_agent_tasks row (RUNNING) before any AI call
//   * records every AI call — including failed/retried attempts — in seo_ai_usage
//   * COMPLETED only when the work really succeeded; otherwise FAILED + error
// Storage is behind TaskStore so this is unit-testable without a database.

import { BaseAIProvider } from "../ai/provider";
import type { AIProvider, AIUsage, GenerateTextRequest, GenerateTextResult } from "../ai/types";
import type { AiUsageCategory } from "../constants";
import { estimateCost, type AiPricing } from "../settings-schema";
import { errorMessage, seoLog } from "../logger";

export interface NewTask {
  agent_type: string;
  task_type: string;
  entity_type: string | null;
  entity_id: string | null;
  status: "RUNNING";
  triggered_by: "USER" | "CRON" | "SYSTEM";
  input_summary: string | null;
  started_at: string;
  model: string;
  created_by: string | null;
}

export interface TaskPatch {
  status: "COMPLETED" | "FAILED" | "WAITING_APPROVAL";
  completed_at: string;
  output_summary?: string | null;
  error?: string | null;
  entity_id?: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number | null;
}

export interface UsageRecord {
  agent_task_id: string;
  provider: string;
  model: string;
  category: AiUsageCategory;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number | null;
  /** Set when the call counts toward a daily budget (the autopilot's). */
  budget_scope?: "AUTOPILOT" | null;
}

export interface TaskStore {
  createTask(task: NewTask): Promise<string>;
  finishTask(id: string, patch: TaskPatch): Promise<void>;
  recordUsage(usage: UsageRecord): Promise<void>;
}

export interface AgentTaskOptions {
  agentType: string;
  taskType: string;
  category: AiUsageCategory;
  entityType?: string;
  entityId?: string;
  inputSummary?: string;
  triggeredBy?: "USER" | "CRON" | "SYSTEM";
  createdBy?: string | null;
}

/**
 * A hard daily spending cap. Checked before every AI call (retries
 * included) against the worst case: the prompt plus the full output
 * allowance. A call that could push spend over the limit isn't made.
 */
export interface AiBudget {
  scope: "AUTOPILOT";
  limitUsd: number;
  /** Spend already recorded today in this scope, USD. */
  spentUsd(): Promise<number>;
}

/** The call was refused because it could exceed the daily budget. */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export interface AgentTaskDeps {
  store: TaskStore;
  provider: AIProvider;
  pricing: AiPricing;
  budget?: AiBudget;
  now?: () => Date;
}

/** Our ~4 chars/token estimate can undercount on newer tokenizers; pad it. */
const INPUT_ESTIMATE_PADDING = 1.5;
const DEFAULT_OUTPUT_ALLOWANCE = 16_000;

/** Worst-case cost of one call (prompt + full output allowance), or null if the model has no price. */
export function worstCaseCost(
  pricing: AiPricing, model: string, req: Pick<GenerateTextRequest, "system" | "prompt" | "maxOutputTokens">, estimateTokens: (t: string) => number,
): number | null {
  const input = Math.ceil(estimateTokens(req.system + req.prompt) * INPUT_ESTIMATE_PADDING);
  return estimateCost(pricing, model, input, req.maxOutputTokens ?? DEFAULT_OUTPUT_ALLOWANCE);
}

async function checkBudget(budget: AiBudget, pricing: AiPricing, provider: AIProvider, req: GenerateTextRequest): Promise<void> {
  const worst = worstCaseCost(pricing, provider.model, req, (t) => provider.estimateUsage(t));
  if (worst === null) {
    throw new BudgetExceededError(`No price is set for ${provider.model}, so the daily budget can't be enforced. Add its price in Settings → AI pricing.`);
  }
  const spent = await budget.spentUsd();
  if (spent + worst > budget.limitUsd) {
    throw new BudgetExceededError(
      `Daily AI budget reached: $${spent.toFixed(4)} spent of $${budget.limitUsd.toFixed(2)}, and this step could cost up to $${worst.toFixed(4)}. It will run again tomorrow.`,
    );
  }
}

export interface AgentContext {
  /** Use this — not the raw provider — so every call is metered. */
  ai: AIProvider;
  taskId: string;
}

export interface AgentWorkResult<R> {
  result: R;
  outputSummary: string;
  /** Set when the work created the entity (e.g. the new cluster's id). */
  entityId?: string;
}

const clip = (s: string | undefined | null, n = 500) => (s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null);

/** Wraps a provider so each generateText call is reported to `onUsage`. */
class MeteredProvider extends BaseAIProvider {
  readonly id: string;
  readonly model: string;
  override readonly nativeStructuredOutput: boolean;

  constructor(
    private readonly inner: AIProvider,
    private readonly onUsage: (model: string, usage: AIUsage) => Promise<void>,
    private readonly beforeCall?: (req: GenerateTextRequest) => Promise<void>,
  ) {
    super();
    this.id = inner.id;
    this.model = inner.model;
    this.nativeStructuredOutput = inner.nativeStructuredOutput;
  }

  async generateText(req: GenerateTextRequest): Promise<GenerateTextResult> {
    await this.beforeCall?.(req);
    const res = await this.inner.generateText(req);
    await this.onUsage(res.model, res.usage);
    return res;
  }
}

export async function runAgentTask<R>(
  opts: AgentTaskOptions,
  deps: AgentTaskDeps,
  work: (ctx: AgentContext) => Promise<AgentWorkResult<R>>,
): Promise<R> {
  const now = deps.now ?? (() => new Date());
  const taskId = await deps.store.createTask({
    agent_type: opts.agentType,
    task_type: opts.taskType,
    entity_type: opts.entityType ?? null,
    entity_id: opts.entityId ?? null,
    status: "RUNNING",
    triggered_by: opts.triggeredBy ?? "USER",
    input_summary: clip(opts.inputSummary),
    started_at: now().toISOString(),
    model: deps.provider.model,
    created_by: opts.createdBy ?? null,
  });

  const totals = { inputTokens: 0, outputTokens: 0, model: deps.provider.model };

  const ai = new MeteredProvider(deps.provider, async (model, usage) => {
    totals.inputTokens += usage.inputTokens;
    totals.outputTokens += usage.outputTokens;
    totals.model = model;
    try {
      await deps.store.recordUsage({
        agent_task_id: taskId,
        provider: deps.provider.id,
        model,
        category: opts.category,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        // Priced by the configured model name (the API may report a dated variant).
        estimated_cost: estimateCost(deps.pricing, deps.provider.model, usage.inputTokens, usage.outputTokens),
        ...(deps.budget ? { budget_scope: deps.budget.scope } : {}),
      });
    } catch (err) {
      // Metering must not destroy finished AI work; surface it in logs.
      seoLog.error("ai_usage.record_failed", { taskId, error: errorMessage(err) });
    }
  }, deps.budget ? (req) => checkBudget(deps.budget!, deps.pricing, deps.provider, req) : undefined);

  const summary = () => ({
    model: totals.model,
    input_tokens: totals.inputTokens,
    output_tokens: totals.outputTokens,
    estimated_cost: estimateCost(deps.pricing, deps.provider.model, totals.inputTokens, totals.outputTokens),
  });

  try {
    const out = await work({ ai, taskId });
    await deps.store.finishTask(taskId, {
      status: "COMPLETED",
      completed_at: now().toISOString(),
      output_summary: clip(out.outputSummary),
      error: null,
      ...(out.entityId ? { entity_id: out.entityId } : {}),
      ...summary(),
    });
    seoLog.info("agent_task.completed", { taskId, agent: opts.agentType, task: opts.taskType, ...summary() });
    return out.result;
  } catch (err) {
    const message = errorMessage(err);
    seoLog.error("agent_task.failed", { taskId, agent: opts.agentType, task: opts.taskType, error: message });
    try {
      await deps.store.finishTask(taskId, {
        status: "FAILED",
        completed_at: now().toISOString(),
        error: clip(message, 2000),
        ...summary(),
      });
    } catch (finishErr) {
      seoLog.error("agent_task.mark_failed_failed", { taskId, error: errorMessage(finishErr) });
    }
    throw err;
  }
}

/**
 * Same bookkeeping as runAgentTask for work that uses no AI (e.g. the
 * Publisher). The work may return status "FAILED" with an error to record a
 * handled failure (such as validation blocking a publish) without throwing.
 */
export async function runPlainTask<R>(
  opts: Omit<AgentTaskOptions, "category">,
  deps: { store: TaskStore; now?: () => Date },
  work: (ctx: { taskId: string }) => Promise<AgentWorkResult<R> & { failed?: string }>,
): Promise<R> {
  const now = deps.now ?? (() => new Date());
  const taskId = await deps.store.createTask({
    agent_type: opts.agentType,
    task_type: opts.taskType,
    entity_type: opts.entityType ?? null,
    entity_id: opts.entityId ?? null,
    status: "RUNNING",
    triggered_by: opts.triggeredBy ?? "USER",
    input_summary: clip(opts.inputSummary),
    started_at: now().toISOString(),
    model: "none",
    created_by: opts.createdBy ?? null,
  });
  const none = { model: "none", input_tokens: 0, output_tokens: 0, estimated_cost: null };
  try {
    const out = await work({ taskId });
    await deps.store.finishTask(taskId, {
      status: out.failed ? "FAILED" : "COMPLETED",
      completed_at: now().toISOString(),
      output_summary: clip(out.outputSummary),
      error: out.failed ? clip(out.failed, 2000) : null,
      ...(out.entityId ? { entity_id: out.entityId } : {}),
      ...none,
    });
    return out.result;
  } catch (err) {
    const message = errorMessage(err);
    seoLog.error("task.failed", { taskId, agent: opts.agentType, task: opts.taskType, error: message });
    try {
      await deps.store.finishTask(taskId, { status: "FAILED", completed_at: now().toISOString(), error: clip(message, 2000), ...none });
    } catch (finishErr) {
      seoLog.error("task.mark_failed_failed", { taskId, error: errorMessage(finishErr) });
    }
    throw err;
  }
}
