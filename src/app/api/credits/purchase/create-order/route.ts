// POST /api/credits/purchase/create-order — body { credits }.
// Validates the quantity, computes the amount server-side (1 credit = ₹1),
// creates a Razorpay order and a pending purchase. Returns what Checkout needs.

import { z } from "zod";
import { handle, json, parseBody, requireStudent } from "@/lib/credits/api";
import { createPurchaseOrder, requirePurchaseDeps } from "@/lib/credits/purchase";

export const dynamic = "force-dynamic";

const schema = z.object({ credits: z.number() });

export async function POST(request: Request) {
  return handle("create-order", async () => {
    const caller = await requireStudent();
    const { credits } = await parseBody(request, schema, "Enter the number of credits to buy.");
    const deps = await requirePurchaseDeps();
    const order = await createPurchaseOrder(deps, { userId: caller.user.id, credits });
    return json({ ...order, prefill: { name: caller.fullName ?? "", email: caller.email } });
  });
}
