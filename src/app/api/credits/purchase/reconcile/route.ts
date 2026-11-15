// POST /api/credits/purchase/reconcile — re-checks the caller's own unsettled
// purchases with Razorpay (e.g. they paid, then closed the tab before the
// webhook landed). Called when My Credits loads. Safe to repeat.

import { handle, json, requireUser } from "@/lib/credits/api";
import { purchaseDeps, reconcilePurchases } from "@/lib/credits/purchase";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle("reconcile", async () => {
    const { user } = await requireUser();
    const deps = await purchaseDeps();
    if (!deps) return json({ checked: 0, fulfilled: 0 });
    const summary = await reconcilePurchases(deps, { userId: user.id, minAgeSeconds: 20, limit: 10 });
    return json({ checked: summary.checked, fulfilled: summary.fulfilled });
  });
}
