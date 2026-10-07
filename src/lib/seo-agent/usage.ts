// AI usage aggregation. Pure + client-safe.

import { AI_USAGE_CATEGORIES, type AiUsageCategory } from "./constants";

export interface UsageRow {
  category: string;
  estimated_cost: number | string | null; // numeric arrives as string from PostgREST
  input_tokens: number;
  output_tokens: number;
}

export interface UsageSummary {
  /** Sum of priced calls only, in USD. */
  cost: number;
  calls: number;
  /** Calls whose model had no configured pricing — cost shown as unknown. */
  unpricedCalls: number;
  tokens: number;
  byCategory: Record<AiUsageCategory, number>;
}

export function summarizeUsage(rows: UsageRow[]): UsageSummary {
  const byCategory = Object.fromEntries(AI_USAGE_CATEGORIES.map((c) => [c, 0])) as Record<AiUsageCategory, number>;
  let cost = 0;
  let unpricedCalls = 0;
  let tokens = 0;
  for (const r of rows) {
    tokens += (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
    if (r.estimated_cost === null || r.estimated_cost === undefined) {
      unpricedCalls++;
      continue;
    }
    const c = Number(r.estimated_cost);
    cost += c;
    const cat = (AI_USAGE_CATEGORIES as readonly string[]).includes(r.category) ? (r.category as AiUsageCategory) : "OTHER";
    byCategory[cat] += c;
  }
  return { cost, calls: rows.length, unpricedCalls, tokens, byCategory };
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(amount > 0 && amount < 0.01 ? 4 : 2)}`;
}
