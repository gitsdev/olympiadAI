import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { num } from "./db";
import { HttpError } from "./errors";
import type { FeaturePricing } from "./types";

function toPricing(r: Record<string, unknown>): FeaturePricing {
  return {
    id: String(r.id),
    feature_key: String(r.feature_key),
    feature_name: String(r.feature_name),
    credit_cost: r.credit_cost === null || r.credit_cost === undefined ? null : num(r.credit_cost),
    is_enabled: r.is_enabled === true,
    updated_at: String(r.updated_at),
    updated_by: (r.updated_by as string | null) ?? null,
  };
}

/** True when starting this feature consumes credits right now. */
export function isCharged(p: Pick<FeaturePricing, "is_enabled" | "credit_cost">): boolean {
  return p.is_enabled && (p.credit_cost ?? 0) > 0;
}

export async function listFeaturePricing(client: SupabaseClient, opts: { chargedOnly?: boolean } = {}): Promise<FeaturePricing[]> {
  let q = client.from("feature_credit_costs")
    .select("id, feature_key, feature_name, credit_cost, is_enabled, updated_at, updated_by")
    .order("feature_name");
  if (opts.chargedOnly) q = q.eq("is_enabled", true).gt("credit_cost", 0);
  const { data, error } = await q;
  if (error) throw new Error(`feature pricing: ${error.message}`);
  return (data ?? []).map((r) => toPricing(r as Record<string, unknown>));
}

export const pricingUpdateSchema = z.object({
  featureKey: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
  featureName: z.string().trim().min(1).max(80),
  creditCost: z.number().int().min(0).max(100_000).nullable(),
  isEnabled: z.boolean(),
});
export type PricingUpdate = z.infer<typeof pricingUpdateSchema>;

/** Updates one feature's price/name/charging state. Service-role client; caller must be a credit admin. */
export async function updateFeaturePricing(service: SupabaseClient, adminId: string, input: PricingUpdate): Promise<{
  before: FeaturePricing; after: FeaturePricing;
}> {
  if (input.isEnabled && !(input.creditCost && input.creditCost > 0)) {
    throw new HttpError(400, "Set a credit cost above 0 before enabling charges.", "COST_REQUIRED");
  }
  const { data: existing } = await service.from("feature_credit_costs").select("*").eq("feature_key", input.featureKey).maybeSingle();
  if (!existing) throw new HttpError(404, "Unknown feature.", "FEATURE_NOT_FOUND");

  const { data, error } = await service.from("feature_credit_costs")
    .update({
      feature_name: input.featureName,
      credit_cost: input.creditCost,
      is_enabled: input.isEnabled,
      updated_by: adminId,
    })
    .eq("feature_key", input.featureKey)
    .select("*")
    .single();
  if (error) throw new Error(`feature pricing update: ${error.message}`);
  return { before: toPricing(existing as Record<string, unknown>), after: toPricing(data as Record<string, unknown>) };
}
