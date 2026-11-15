// Credit purchases through Razorpay Standard Checkout.
//
// Three independent paths can complete a payment, and all three converge on
// credit_fulfil_purchase(), which locks the purchase row and credits the
// wallet exactly once:
//   1. verifyCheckoutPayment — the browser's Checkout success handler
//      (signature verified, then the payment re-fetched from Razorpay; the
//      browser's claim of success is never trusted on its own)
//   2. processWebhook        — Razorpay's server-to-server webhook (works
//      when the student closed the browser right after paying)
//   3. reconcilePurchases    — asks Razorpay about still-unsettled orders
//      (covers delayed/missed webhooks; run on My Credits load + daily cron)

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { CURRENCY, creditsToPaise, validatePurchaseCredits } from "./constants";
import { asJson, callRpc, creditDb, num, type CreditDb } from "./db";
import { HttpError } from "./errors";
import {
  RazorpayClient, razorpayConfig, verifyCheckoutSignature, verifyWebhookSignature, type RazorpayConfig, type RazorpayPayment,
} from "./razorpay";

export interface PurchaseDeps {
  db: CreditDb;
  razorpay: RazorpayClient;
  config: RazorpayConfig;
}

/** Max unpaid orders a student may open per hour (stops order spam). */
export const MAX_PENDING_ORDERS_PER_HOUR = 10;

export interface CreatedOrder {
  purchaseId: string;
  orderId: string;
  keyId: string;
  credits: number;
  amountPaise: number;
  currency: string;
}

export async function createPurchaseOrder(
  deps: PurchaseDeps,
  input: { userId: string; credits: number },
): Promise<CreatedOrder> {
  const invalid = validatePurchaseCredits(input.credits);
  if (invalid) throw new HttpError(400, invalid, "INVALID_QUANTITY");

  const pending = num(await callRpc(deps.db, "credit_recent_pending_count", { p_user_id: input.userId, p_minutes: 60 }));
  if (pending >= MAX_PENDING_ORDERS_PER_HOUR) {
    throw new HttpError(429, "Too many unfinished payments. Please wait a little and try again.", "TOO_MANY_PENDING");
  }

  // The amount is always computed here, never taken from the client.
  const amountPaise = creditsToPaise(input.credits);
  const receipt = `cr_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const order = await deps.razorpay.createOrder({
    amountPaise,
    receipt,
    notes: { purpose: "credit_purchase", user_id: input.userId, credits: String(input.credits) },
  });
  if (order.amount !== amountPaise || order.currency !== CURRENCY) {
    throw new Error(`Razorpay order ${order.id} amount/currency mismatch`);
  }

  const purchaseId = await callRpc<string>(deps.db, "credit_create_purchase", {
    p_user_id: input.userId,
    p_credits: input.credits,
    p_amount_paise: amountPaise,
    p_order_id: order.id,
    p_metadata: { receipt },
  });

  return { purchaseId, orderId: order.id, keyId: deps.razorpay.keyId, credits: input.credits, amountPaise, currency: CURRENCY };
}

export type SettleOutcome =
  | { status: "paid" | "already_paid"; userId: string; credits: number; balance: number }
  | { status: "failed" | "processing" | "not_ours" | "amount_mismatch" };

/**
 * Settles one Razorpay payment against our purchase record. The payment
 * object must come from a trusted source: fetched from the Razorpay API,
 * or a signature-verified webhook payload.
 */
export async function settlePayment(
  deps: PurchaseDeps,
  payment: RazorpayPayment,
  source: "checkout" | "webhook" | "reconcile",
): Promise<SettleOutcome> {
  if (!payment.order_id) return { status: "not_ours" };

  let p = payment;
  if (p.status === "authorized") {
    // Only reached when auto-capture is off on the Razorpay account. If it
    // was captured meanwhile (auto-capture racing us), re-read its state.
    p = await deps.razorpay.capturePayment(p.id, p.amount)
      .catch(() => deps.razorpay.fetchPayment(payment.id));
  }
  if (p.status === "failed") {
    await callRpc(deps.db, "credit_mark_purchase_failed", {
      p_order_id: p.order_id, p_payment_id: p.id, p_reason: p.error_description ?? "payment failed",
    });
    return { status: "failed" };
  }
  if (p.status !== "captured" && p.status !== "refunded") return { status: "processing" };

  const r = asJson<Record<string, unknown>>(await callRpc(deps.db, "credit_fulfil_purchase", {
    p_order_id: p.order_id,
    p_payment_id: p.id,
    p_amount_paise: p.amount,
    p_currency: p.currency,
    p_source: source,
  }));

  if (r.ok === true) {
    return {
      status: r.status === "paid" ? "paid" : "already_paid",
      userId: String(r.user_id),
      credits: num(r.credits),
      balance: num(r.balance),
    };
  }
  if (r.error === "PURCHASE_NOT_FOUND") return { status: "not_ours" };
  if (r.error === "AMOUNT_MISMATCH") {
    console.error(JSON.stringify({ scope: "credits.purchase", event: "amount_mismatch", order: p.order_id, payment: p.id }));
    return { status: "amount_mismatch" };
  }
  throw new Error(`credit_fulfil_purchase: ${String(r.error)}`);
}

export interface VerifyInput {
  userId: string;
  orderId: string;
  paymentId: string;
  signature: string;
}

export async function verifyCheckoutPayment(deps: PurchaseDeps, input: VerifyInput): Promise<{
  status: "paid" | "processing" | "failed"; credits?: number; balance?: number;
}> {
  if (!verifyCheckoutSignature(input.orderId, input.paymentId, input.signature, deps.config.keySecret)) {
    throw new HttpError(400, "We couldn't verify this payment.", "INVALID_SIGNATURE");
  }
  // Never trust the browser's view of the payment — ask Razorpay.
  const payment = await deps.razorpay.fetchPayment(input.paymentId);
  if (payment.order_id !== input.orderId) {
    throw new HttpError(400, "We couldn't verify this payment.", "ORDER_MISMATCH");
  }

  const outcome = await settlePayment(deps, payment, "checkout");
  switch (outcome.status) {
    case "paid":
    case "already_paid":
      // Credits always go to the purchase's owner; only reveal details to them.
      if (outcome.userId !== input.userId) throw new HttpError(404, "Purchase not found.", "NOT_FOUND");
      return { status: "paid", credits: outcome.credits, balance: outcome.balance };
    case "processing":
      return { status: "processing" };
    case "failed":
      return { status: "failed" };
    case "not_ours":
      throw new HttpError(404, "Purchase not found.", "NOT_FOUND");
    case "amount_mismatch":
      throw new HttpError(409, "This payment doesn't match your order. Our team has been notified.", "AMOUNT_MISMATCH");
  }
}

// ── Webhooks ────────────────────────────────────────────────────────────

interface WebhookEvent {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    refund?: { entity?: { id: string; payment_id: string; amount: number; status?: string } };
  };
}

export type WebhookResult =
  | { status: "processed"; event: string; detail?: string }
  | { status: "duplicate" | "ignored"; event: string };

export async function processWebhook(
  deps: PurchaseDeps,
  input: { rawBody: string; signature: string | null; eventId: string | null },
): Promise<WebhookResult> {
  if (!deps.config.webhookSecret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
  if (!verifyWebhookSignature(input.rawBody, input.signature, deps.config.webhookSecret)) {
    throw new HttpError(401, "Invalid signature.", "INVALID_SIGNATURE");
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(input.rawBody) as WebhookEvent;
  } catch {
    throw new HttpError(400, "Invalid payload.", "INVALID_PAYLOAD");
  }
  const type = typeof event.event === "string" ? event.event : "unknown";
  // Razorpay sends a unique x-razorpay-event-id per event (same id on retries).
  const eventId = input.eventId?.trim() || `sha256:${createHash("sha256").update(input.rawBody).digest("hex")}`;

  const begin = await callRpc<string>(deps.db, "credit_webhook_begin", { p_event_id: eventId, p_event_type: type });
  if (begin === "duplicate") return { status: "duplicate", event: type };

  try {
    const detail = await handleWebhookEvent(deps, type, event);
    await callRpc(deps.db, "credit_webhook_finish", { p_event_id: eventId, p_error: null });
    return detail === null ? { status: "ignored", event: type } : { status: "processed", event: type, detail };
  } catch (err) {
    await callRpc(deps.db, "credit_webhook_finish", { p_event_id: eventId, p_error: (err as Error).message })
      .catch(() => undefined);
    throw err; // → 500, so Razorpay retries the delivery
  }
}

async function handleWebhookEvent(deps: PurchaseDeps, type: string, event: WebhookEvent): Promise<string | null> {
  const payment = event.payload?.payment?.entity;
  switch (type) {
    case "payment.captured":
    case "payment.authorized":
    case "order.paid":
    case "payment.failed": {
      if (!payment?.id) return null;
      const outcome = await settlePayment(deps, payment, "webhook");
      return outcome.status;
    }
    case "refund.processed": {
      const refund = event.payload?.refund?.entity;
      if (!refund?.id || !refund.payment_id) return null;
      const orderId = payment?.order_id ?? (await deps.razorpay.fetchPayment(refund.payment_id)).order_id;
      if (!orderId) return null;
      const r = asJson<Record<string, unknown>>(await callRpc(deps.db, "credit_record_purchase_refund", {
        p_order_id: orderId, p_refund_id: refund.id, p_refund_paise: refund.amount,
        p_admin_id: null, p_reason: "Refund processed in Razorpay",
      }));
      if (r.ok !== true && r.error !== "PURCHASE_NOT_FOUND" && r.error !== "NOT_REFUNDABLE") {
        throw new Error(`credit_record_purchase_refund: ${String(r.error)}`);
      }
      return r.ok === true ? String(r.status) : String(r.error);
    }
    default:
      return null;
  }
}

// ── Reconciliation ─────────────────────────────────────────────────────

export interface ReconcileSummary {
  checked: number;
  fulfilled: number;
  failed: number;
  stillPending: number;
  errors: number;
}

/** Unpaid orders older than this with no payment attempt are closed as failed. */
const EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000;

export async function reconcilePurchases(
  deps: PurchaseDeps,
  opts: { userId?: string | null; minAgeSeconds?: number; maxAgeHours?: number; limit?: number } = {},
): Promise<ReconcileSummary> {
  const rows = await callRpc<Array<{ razorpay_order_id: string; status: string; created_at: string }>>(
    deps.db, "credit_list_unsettled_purchases", {
      p_user_id: opts.userId ?? null,
      p_min_age_seconds: opts.minAgeSeconds ?? 30,
      p_max_age_hours: opts.maxAgeHours ?? 72,
      p_limit: opts.limit ?? 50,
    });

  const summary: ReconcileSummary = { checked: 0, fulfilled: 0, failed: 0, stillPending: 0, errors: 0 };
  for (const row of rows ?? []) {
    summary.checked++;
    try {
      const payments = await deps.razorpay.fetchOrderPayments(row.razorpay_order_id);
      const winner = payments.find((p) => p.status === "captured" || p.status === "refunded")
        ?? payments.find((p) => p.status === "authorized");
      if (winner) {
        const outcome = await settlePayment(deps, { ...winner, order_id: winner.order_id ?? row.razorpay_order_id }, "reconcile");
        if (outcome.status === "paid") summary.fulfilled++;
        else if (outcome.status !== "already_paid") summary.stillPending++;
        continue;
      }
      const age = Date.now() - new Date(row.created_at).getTime();
      const lastFailed = payments.filter((p) => p.status === "failed").at(-1);
      if (row.status === "pending" && (lastFailed || age > EXPIRE_AFTER_MS)) {
        await callRpc(deps.db, "credit_mark_purchase_failed", {
          p_order_id: row.razorpay_order_id,
          p_payment_id: lastFailed?.id ?? null,
          p_reason: lastFailed ? (lastFailed.error_description ?? "payment failed") : "expired without payment",
        });
        summary.failed++;
      } else {
        summary.stillPending++;
      }
    } catch (err) {
      summary.errors++;
      console.error(JSON.stringify({
        scope: "credits.reconcile", event: "order.error", order: row.razorpay_order_id, message: (err as Error).message,
      }));
    }
  }
  return summary;
}

/** Builds PurchaseDeps from env, or null when Razorpay isn't configured. */
export async function purchaseDeps(): Promise<PurchaseDeps | null> {
  const config = razorpayConfig();
  if (!config) return null;
  return { db: creditDb(), razorpay: new RazorpayClient(config), config };
}

export async function requirePurchaseDeps(): Promise<PurchaseDeps> {
  const deps = await purchaseDeps();
  if (!deps) throw new HttpError(503, "Payments are not available right now. Please try again later.", "PAYMENTS_UNAVAILABLE");
  return deps;
}
