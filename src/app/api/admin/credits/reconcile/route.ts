// POST /api/admin/credits/reconcile — asks Razorpay about every unsettled
// purchase from the last 72 hours and fulfils any that were actually paid.

import { handle, json } from "@/lib/credits/api";
import { requireCreditAdmin } from "@/lib/credits/admin";
import { reconcilePurchases, requirePurchaseDeps } from "@/lib/credits/purchase";
import { logAdminAction } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  return handle("admin.reconcile", async () => {
    const admin = await requireCreditAdmin("admin");
    const summary = await reconcilePurchases(await requirePurchaseDeps(), { minAgeSeconds: 60, limit: 100 });
    await logAdminAction(admin.id, "credit_reconcile_run", "credit_purchases", null, { ...summary });
    return json(summary);
  });
}
