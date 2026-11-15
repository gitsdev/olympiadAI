// GET  /api/admin/credits/pricing — every registered feature with its price.
// POST /api/admin/credits/pricing — { featureKey, featureName, creditCost, isEnabled }.
//      Requires credit role "admin" or "super_admin". Audit-logged.

import { createServiceClient } from "@/lib/supabase/service";
import { handle, json, parseBody } from "@/lib/credits/api";
import { profilesById, requireCreditAdmin } from "@/lib/credits/admin";
import { listFeaturePricing, pricingUpdateSchema, updateFeaturePricing } from "@/lib/credits/pricing";
import { logAdminAction } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle("admin.pricing", async () => {
    await requireCreditAdmin("viewer");
    const service = createServiceClient();
    const features = await listFeaturePricing(service);
    const names = await profilesById(service, features.map((f) => f.updated_by));
    return json({
      features: features.map((f) => ({ ...f, updated_by_name: f.updated_by ? names.get(f.updated_by)?.full_name ?? null : null })),
    });
  });
}

export async function POST(request: Request) {
  return handle("admin.pricing", async () => {
    const admin = await requireCreditAdmin("admin");
    const input = await parseBody(request, pricingUpdateSchema, "Please check the feature price and try again.");
    const { before, after } = await updateFeaturePricing(createServiceClient(), admin.id, input);
    await logAdminAction(admin.id, "credit_pricing_updated", "feature_credit_costs", after.id, {
      feature_key: after.feature_key,
      before: { name: before.feature_name, cost: before.credit_cost, enabled: before.is_enabled },
      after: { name: after.feature_name, cost: after.credit_cost, enabled: after.is_enabled },
    });
    return json({ feature: { ...after, updated_by_name: admin.name } });
  });
}
