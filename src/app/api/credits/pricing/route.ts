// GET /api/credits/pricing — features that currently consume credits, and their cost.

import { createClient } from "@/lib/supabase/server";
import { handle, json, requireUser } from "@/lib/credits/api";
import { listFeaturePricing } from "@/lib/credits/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle("pricing", async () => {
    await requireUser();
    const features = await listFeaturePricing(await createClient(), { chargedOnly: true });
    return json({
      features: features.map((f) => ({ featureKey: f.feature_key, featureName: f.feature_name, creditCost: f.credit_cost })),
    });
  });
}
