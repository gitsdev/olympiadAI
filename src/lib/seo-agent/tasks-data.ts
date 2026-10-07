import "server-only";

import { seoDb, throwIfDbError } from "./db";
import { escapeLike } from "./keywords-data";
import { zonedDateString, zonedDayRange, zonedMonthRange } from "./datetime";
import { summarizeUsage, type UsageRow, type UsageSummary } from "./usage";

export const TASKS_PAGE_SIZE = 25;

export interface AgentTaskRow {
  id: string;
  agent_type: string;
  task_type: string;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  triggered_by: string;
  input_summary: string | null;
  output_summary: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: string | number | null;
  created_at: string;
}

export async function listAgentTasks(f: { status?: string; agent?: string; page: number }): Promise<{ rows: AgentTaskRow[]; count: number; agents: string[] }> {
  const db = await seoDb();
  let q = db.from("seo_agent_tasks").select("*", { count: "exact" });
  if (f.status) q = q.eq("status", f.status);
  if (f.agent) q = q.ilike("agent_type", escapeLike(f.agent));
  const from = (f.page - 1) * TASKS_PAGE_SIZE;

  const [list, agentRows] = await Promise.all([
    q.order("created_at", { ascending: false }).range(from, from + TASKS_PAGE_SIZE - 1),
    db.from("seo_agent_tasks").select("agent_type").order("created_at", { ascending: false }).limit(500),
  ]);
  throwIfDbError(list.error, "Loading agent tasks");
  throwIfDbError(agentRows.error, "Loading agent types");
  const agents = [...new Set(((agentRows.data ?? []) as { agent_type: string }[]).map((r) => r.agent_type))].sort();
  return { rows: (list.data ?? []) as AgentTaskRow[], count: list.count ?? 0, agents };
}

export interface UsageReport {
  today: UsageSummary;
  month: UsageSummary;
  byModel: { model: string; calls: number; tokens: number; cost: number; unpriced: number }[];
  daily: { date: string; calls: number; tokens: number; cost: number; unpriced: number }[];
}

const USAGE_DAYS = 30;

/** Usage for the last 30 days + the current month, bucketed in `tz`. */
export async function getUsageReport(tz: string, now = new Date()): Promise<UsageReport> {
  const db = await seoDb();
  const month = zonedMonthRange(now, tz);
  const windowStart = zonedDayRange(now, tz, -(USAGE_DAYS - 1)).start;
  const since = windowStart < month.start ? windowStart : month.start;

  const { data, error } = await db
    .from("seo_ai_usage")
    .select("created_at, model, category, input_tokens, output_tokens, estimated_cost")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(20_000);
  throwIfDbError(error, "Loading AI usage");
  const rows = (data ?? []) as (UsageRow & { created_at: string; model: string })[];

  const today = zonedDayRange(now, tz, 0);
  const inRange = (r: { created_at: string }, s: Date, e: Date) => {
    const t = new Date(r.created_at).getTime();
    return t >= s.getTime() && t < e.getTime();
  };
  const monthRows = rows.filter((r) => inRange(r, month.start, month.end));

  const byModel = new Map<string, { model: string; calls: number; tokens: number; cost: number; unpriced: number }>();
  for (const r of monthRows) {
    const m = byModel.get(r.model) ?? { model: r.model, calls: 0, tokens: 0, cost: 0, unpriced: 0 };
    m.calls++;
    m.tokens += r.input_tokens + r.output_tokens;
    if (r.estimated_cost === null) m.unpriced++; else m.cost += Number(r.estimated_cost);
    byModel.set(r.model, m);
  }

  const daily = new Map<string, { date: string; calls: number; tokens: number; cost: number; unpriced: number }>();
  for (let i = 0; i < USAGE_DAYS; i++) {
    const d = zonedDayRange(now, tz, -i).date;
    daily.set(d, { date: d, calls: 0, tokens: 0, cost: 0, unpriced: 0 });
  }
  for (const r of rows) {
    const bucket = daily.get(zonedDateString(new Date(r.created_at), tz));
    if (!bucket) continue;
    bucket.calls++;
    bucket.tokens += r.input_tokens + r.output_tokens;
    if (r.estimated_cost === null) bucket.unpriced++; else bucket.cost += Number(r.estimated_cost);
  }

  return {
    today: summarizeUsage(rows.filter((r) => inRange(r, today.start, today.end))),
    month: summarizeUsage(monthRows),
    byModel: [...byModel.values()].sort((a, b) => b.calls - a.calls),
    daily: [...daily.values()],
  };
}
