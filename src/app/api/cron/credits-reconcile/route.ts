// GET /api/cron/credits-reconcile — daily safety net for credit purchases.
// Called by Vercel Cron with Authorization: Bearer $CRON_SECRET. Settles any
// purchase that was paid but never fulfilled (missed/delayed webhook) and
// closes unpaid orders older than a day as failed.

import { verifyBearer } from "@/lib/seo-agent/publishing/auth";
import { purchaseDeps, reconcilePurchases } from "@/lib/credits/purchase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const deps = await purchaseDeps();
  if (!deps) return Response.json({ ok: true, skipped: "razorpay not configured" });
  const summary = await reconcilePurchases(deps, { minAgeSeconds: 300, maxAgeHours: 72, limit: 500 });
  console.log(JSON.stringify({ scope: "credits.reconcile", event: "cron.done", ...summary }));
  return Response.json({ ok: true, ...summary });
}
