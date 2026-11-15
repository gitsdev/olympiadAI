// POST /api/credits/purchase/verify — called by the Checkout success handler.
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }.
// The signature is verified and the payment re-fetched from Razorpay before
// anything is credited; the webhook fulfils the same purchase independently.

import { z } from "zod";
import { handle, json, parseBody, requireUser } from "@/lib/credits/api";
import { requirePurchaseDeps, verifyCheckoutPayment } from "@/lib/credits/purchase";

export const dynamic = "force-dynamic";

const schema = z.object({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
  razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/i),
});

export async function POST(request: Request) {
  return handle("verify", async () => {
    const { user } = await requireUser();
    const body = await parseBody(request, schema, "We couldn't verify this payment.");
    const deps = await requirePurchaseDeps();
    const result = await verifyCheckoutPayment(deps, {
      userId: user.id,
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    return json(result);
  });
}
