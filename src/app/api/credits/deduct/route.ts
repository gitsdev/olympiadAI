// POST /api/credits/deduct — charge the caller for one start of a feature.
// Body: { featureKey, idempotencyKey, referenceId? }
//
// Prefer calling chargeFeatureStart() from the feature's own server code
// (see docs/credits/feature-integration.md). This endpoint is for features
// whose "start" happens in the browser (e.g. Brain Booster games). It can
// only ever charge the signed-in student's own wallet.
//
// 200 { status: "charged" | "duplicate" | "free", cost, balance, transactionId }
// 402 { code: "INSUFFICIENT_CREDITS", required, balance, shortfall, buyUrl }

import { z } from "zod";
import { handle, json, parseBody, requireStudent } from "@/lib/credits/api";
import { creditDb } from "@/lib/credits/db";
import { deductCredits, deductErrorResponse } from "@/lib/credits/deduct";

export const dynamic = "force-dynamic";

const schema = z.object({
  featureKey: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_.:-]{8,120}$/),
  referenceId: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  return handle("deduct", async () => {
    const { user } = await requireStudent();
    const body = await parseBody(request, schema);
    const result = await deductCredits(creditDb(), {
      userId: user.id,
      featureKey: body.featureKey,
      idempotencyKey: body.idempotencyKey,
      referenceId: body.referenceId ?? null,
      metadata: { via: "api" },
    });
    if (!result.ok) {
      const { status, body: err } = deductErrorResponse(result);
      return json(err, status);
    }
    return json({ status: result.status, cost: result.cost, balance: result.balance, transactionId: result.transactionId });
  });
}
