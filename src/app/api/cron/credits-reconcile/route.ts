// GET /api/cron/credits-reconcile — daily safety net for credit purchases.
// Called by Vercel Cron with Authorization: Bearer $CRON_SECRET. Settles any
// purchase that was paid but never fulfilled (missed/delayed webhook),
// closes unpaid orders older than a day as failed, and refunds Practice /
// Mock Test charges whose questions were never delivered.

import { verifyBearer } from "@/lib/seo-agent/publishing/auth";
import { purchaseDeps, reconcilePurchases } from "@/lib/credits/purchase";
import { refundUndeliveredSessions } from "@/lib/credits/feature";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  // Independent of Razorpay, so it runs first and even when payments aren't set up.
  const undelivered = await refundUndeliveredSessions({ maxAgeHours: 72, limit: 1000 });
  const deps = await purchaseDeps();
  if (!deps) return Response.json({ ok: true, skipped: "razorpay not configured", undelivered });
  const summary = await reconcilePurchases(deps, { minAgeSeconds: 300, maxAgeHours: 72, limit: 500 });
  console.log(JSON.stringify({ scope: "credits.reconcile", event: "cron.done", ...summary, undelivered }));
  return Response.json({ ok: true, ...summary, undelivered });
}
