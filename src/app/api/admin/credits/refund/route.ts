// POST /api/admin/credits/refund — two kinds of refund, both as reversal
// ledger entries (history is never edited):
//
//   { purchaseId, credits?, reason, allowShortfall? }
//     Refunds money through Razorpay (full by default, or `credits` worth)
//     and removes those credits. Requires credit role "super_admin".
//
//   { usageTransactionId, reason }
//     Gives back a feature charge (e.g. a session that broke on our side).
//     No money moves. Requires credit role "admin" or above.

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { HttpError, handle, json, parseBody } from "@/lib/credits/api";
import { getPurchase, requireCreditAdmin } from "@/lib/credits/admin";
import { creditDb } from "@/lib/credits/db";
import { requirePurchaseDeps } from "@/lib/credits/purchase";
import { refundPurchase, reverseUsage } from "@/lib/credits/refund";
import { getWalletSummary } from "@/lib/credits/wallet";
import { logAdminAction } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.union([
  z.object({
    purchaseId: z.string().regex(UUID_RE),
    credits: z.number().int().positive().optional(),
    reason: z.string().trim().min(3).max(500),
    allowShortfall: z.boolean().optional(),
  }),
  z.object({
    usageTransactionId: z.string().regex(UUID_RE),
    reason: z.string().trim().min(3).max(500),
  }),
]);

/** Admins may reverse a feature charge up to 90 days old. */
const ADMIN_USAGE_REVERSAL_MINUTES = 90 * 24 * 60;

export async function POST(request: Request) {
  return handle("admin.refund", async () => {
    await requireCreditAdmin("viewer"); // reject non-admins before reading the body
    const body = await parseBody(request, schema, "Choose what to refund and enter a reason (at least 3 characters).");
    const service = createServiceClient();

    if ("usageTransactionId" in body) {
      const admin = await requireCreditAdmin("admin");
      const { data: tx } = await service.from("credit_transactions").select("user_id")
        .eq("id", body.usageTransactionId).eq("transaction_type", "usage").maybeSingle();
      const userId = (tx as { user_id?: string } | null)?.user_id;
      if (!userId) throw new HttpError(404, "Charge not found.", "NOT_FOUND");
      const result = await reverseUsage(creditDb(), {
        userId, usageTransactionId: body.usageTransactionId,
        reason: `Admin: ${body.reason}`, maxAgeMinutes: ADMIN_USAGE_REVERSAL_MINUTES,
      });
      if (!result.ok) throw new HttpError(409, "This charge can no longer be refunded.", result.error);
      if (result.status === "reversed") {
        await logAdminAction(admin.id, "credit_usage_refunded", "credit_transaction", body.usageTransactionId, {
          reason: body.reason, refund_transaction_id: result.transactionId,
        });
      }
      return json(result);
    }

    const admin = await requireCreditAdmin("super_admin");
    const purchase = await getPurchase(service, body.purchaseId);
    if (!purchase || !purchase.user_id) throw new HttpError(404, "Purchase not found.", "NOT_FOUND");
    const deps = await requirePurchaseDeps();
    const { balance } = await getWalletSummary(deps.db, purchase.user_id);
    const result = await refundPurchase(deps, {
      purchase,
      credits: body.credits ?? purchase.credits - purchase.refunded_credits,
      currentBalance: balance,
      adminId: admin.id,
      reason: body.reason,
      allowShortfall: body.allowShortfall,
    });
    await logAdminAction(admin.id, "credit_purchase_refunded", "credit_purchase", purchase.id, {
      reason: body.reason, refund_id: result.refundId, credits: result.credits,
      amount_paise: result.amountPaise, shortfall: result.shortfall,
    });
    return json(result);
  });
}
