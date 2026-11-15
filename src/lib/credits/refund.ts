import "server-only";
import { asJson, callRpc, num, type CreditDb } from "./db";
import { HttpError } from "./errors";
import type { RazorpayClient } from "./razorpay";
import type { CreditPurchase } from "./types";

/** How long after a charge a feature may still reverse it (feature failed to start). */
export const USAGE_REVERSAL_WINDOW_MINUTES = 60;

export type ReverseResult =
  | { ok: true; status: "reversed" | "duplicate"; balance: number; transactionId: string }
  | { ok: false; error: "USAGE_NOT_FOUND" | "REVERSAL_WINDOW_CLOSED" };

/**
 * Gives back a usage charge when the feature failed BEFORE it started
 * (e.g. question generation errored). Idempotent: a second call returns
 * "duplicate" and changes nothing. Never call this for a session that
 * actually ran — completed sessions are not refunded.
 */
export async function reverseUsage(
  db: CreditDb,
  input: { userId: string; usageTransactionId: string; reason: string; maxAgeMinutes?: number },
): Promise<ReverseResult> {
  const r = asJson<Record<string, unknown>>(await callRpc(db, "credit_reverse_usage", {
    p_user_id: input.userId,
    p_usage_transaction_id: input.usageTransactionId,
    p_reason: input.reason,
    p_max_age_minutes: input.maxAgeMinutes ?? USAGE_REVERSAL_WINDOW_MINUTES,
  }));
  if (r.ok === true) {
    return { ok: true, status: r.status as "reversed" | "duplicate", balance: num(r.balance), transactionId: String(r.transaction_id) };
  }
  return { ok: false, error: r.error as "USAGE_NOT_FOUND" | "REVERSAL_WINDOW_CLOSED" };
}

export interface PurchaseRefundResult {
  status: "recorded" | "duplicate";
  refundId: string;
  credits: number;
  amountPaise: number;
  creditsRemoved: number;
  shortfall: number;
}

/**
 * Admin-initiated purchase refund: refunds the money through Razorpay, then
 * records a negative "refund" ledger entry. The webhook for the same refund
 * id is a no-op afterwards (idempotent on the Razorpay refund id).
 *
 * Refuses when the student has already spent the credits being refunded,
 * unless `allowShortfall` is set — the ledger then removes only what is
 * left, and the shortfall is recorded on the transaction.
 */
export async function refundPurchase(
  deps: { db: CreditDb; razorpay: RazorpayClient },
  input: {
    purchase: CreditPurchase;
    credits: number;
    currentBalance: number;
    adminId: string;
    reason: string;
    allowShortfall?: boolean;
  },
): Promise<PurchaseRefundResult> {
  const { purchase } = input;
  if (purchase.status !== "paid" && purchase.status !== "partially_refunded") {
    throw new HttpError(409, "Only paid purchases can be refunded.", "NOT_REFUNDABLE");
  }
  if (!purchase.razorpay_payment_id) throw new HttpError(409, "This purchase has no captured payment.", "NOT_REFUNDABLE");
  const refundable = purchase.credits - purchase.refunded_credits;
  if (!Number.isInteger(input.credits) || input.credits < 1 || input.credits > refundable) {
    throw new HttpError(400, `You can refund between 1 and ${refundable} credits for this purchase.`, "INVALID_AMOUNT");
  }
  if (input.credits > input.currentBalance && !input.allowShortfall) {
    throw new HttpError(409,
      `The student has only ${input.currentBalance} credits left; ${input.credits - input.currentBalance} of these credits were already spent.`,
      "CREDITS_ALREADY_SPENT", { balance: input.currentBalance });
  }

  const amountPaise = input.credits * 100;
  const refund = await deps.razorpay.refundPayment(purchase.razorpay_payment_id, amountPaise, {
    purpose: "credit_refund", purchase_id: purchase.id, admin_id: input.adminId, reason: input.reason.slice(0, 200),
  });

  const r = asJson<Record<string, unknown>>(await callRpc(deps.db, "credit_record_purchase_refund", {
    p_order_id: purchase.razorpay_order_id,
    p_refund_id: refund.id,
    p_refund_paise: refund.amount,
    p_admin_id: input.adminId,
    p_reason: input.reason,
  }));
  if (r.ok !== true) {
    // The money has moved; surface loudly so it can be reconciled by hand.
    console.error(JSON.stringify({ scope: "credits.refund", event: "record.failed", refund: refund.id, error: r.error }));
    throw new Error(`Refund ${refund.id} issued but not recorded: ${String(r.error)}`);
  }
  return {
    status: r.status === "duplicate" ? "duplicate" : "recorded",
    refundId: refund.id,
    credits: input.credits,
    amountPaise: refund.amount,
    creditsRemoved: num(r.credits_removed),
    shortfall: num(r.shortfall),
  };
}
