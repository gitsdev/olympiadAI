// Autopilot: the daily keyword → cluster → plan → article → publish run,
// on a cheaper model with a hard daily spending cap (migration 026).

import type { SupabaseClient } from "@supabase/supabase-js";
import { throwIfDbError } from "./db";
import { zonedDayRange } from "./datetime";
import type { AiBudget } from "./agents/run-task";
import type { SeoSettings } from "./settings-schema";

/** Autopilot AI spend so far today (in `tz`), USD. Unpriced calls can't happen: the guard refuses them. */
export async function autopilotSpentToday(db: SupabaseClient, tz: string, now = new Date()): Promise<number> {
  const day = zonedDayRange(now, tz, 0);
  const { data, error } = await db.from("seo_ai_usage").select("estimated_cost")
    .eq("budget_scope", "AUTOPILOT").gte("created_at", day.start.toISOString()).lt("created_at", day.end.toISOString());
  throwIfDbError(error, "Loading autopilot spend");
  return ((data ?? []) as { estimated_cost: number | string | null }[]).reduce((sum, r) => sum + Number(r.estimated_cost ?? 0), 0);
}

/** The budget every autopilot AI call is checked against. */
export function autopilotBudget(db: SupabaseClient, settings: Pick<SeoSettings, "timezone" | "automationDailyBudgetUsd">, now = new Date()): AiBudget {
  return {
    scope: "AUTOPILOT",
    limitUsd: settings.automationDailyBudgetUsd,
    spentUsd: () => autopilotSpentToday(db, settings.timezone, now),
  };
}

/** Settings the autopilot's AI steps run with: same everything, its own model. */
export function autopilotAiSettings(settings: SeoSettings): SeoSettings {
  return { ...settings, aiModel: settings.automationModel };
}
