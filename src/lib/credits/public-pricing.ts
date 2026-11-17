import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { num } from "./db";

export interface PublicFeaturePrice {
  key: string;
  name: string;
  /** Credits per use when charged; null when the feature is free right now. */
  cost: number | null;
}

/**
 * Feature prices for public pages (landing page). Read-only and server-side;
 * returns null if the table can't be read, so pages can fall back gracefully.
 */
export async function getPublicFeaturePricing(): Promise<PublicFeaturePrice[] | null> {
  try {
    const { data, error } = await createServiceClient()
      .from("feature_credit_costs")
      .select("feature_key, feature_name, credit_cost, is_enabled")
      .order("feature_name");
    if (error || !data) return null;
    return data.map((r) => {
      const cost = r.credit_cost === null ? 0 : num(r.credit_cost);
      return {
        key: String(r.feature_key),
        name: String(r.feature_name),
        cost: r.is_enabled === true && cost > 0 ? cost : null,
      };
    });
  } catch {
    return null;
  }
}
