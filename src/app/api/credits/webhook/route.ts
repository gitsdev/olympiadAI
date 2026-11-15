// POST /api/credits/webhook — Razorpay webhooks (server-to-server).
// Signature-verified against the RAW body; deduplicated by event id, so
// retries and replays are harmless. Completes purchases even when the
// student closed the browser after paying.
//
// Status codes: 200 processed/duplicate/ignored · 401 bad signature ·
// 500 transient failure (Razorpay retries).

import { handle, json } from "@/lib/credits/api";
import { processWebhook, requirePurchaseDeps } from "@/lib/credits/purchase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle("webhook", async () => {
    const rawBody = await request.text();
    const deps = await requirePurchaseDeps();
    const result = await processWebhook(deps, {
      rawBody,
      signature: request.headers.get("x-razorpay-signature"),
      eventId: request.headers.get("x-razorpay-event-id"),
    });
    return json({ ok: true, ...result });
  });
}
