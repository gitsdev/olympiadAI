// End-to-end purchase flow: the real credit service + RazorpayClient,
// running against PGlite (migration 021) and a simulated Razorpay API
// (injected fetch). Numbers in test names map to the spec's test list.

import { createHmac } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creditsToPaise, validatePurchaseCredits } from "@/lib/credits/constants";
import { HttpError } from "@/lib/credits/errors";
import {
  createPurchaseOrder, processWebhook, reconcilePurchases, verifyCheckoutPayment, type PurchaseDeps,
} from "@/lib/credits/purchase";
import { RazorpayClient, verifyCheckoutSignature, verifyWebhookSignature, type RazorpayPayment } from "@/lib/credits/razorpay";
import { refundPurchase } from "@/lib/credits/refund";
import { normalisePurchase } from "@/lib/credits/history";
import { ALICE, BOB, balanceOf, createDb, ledgerSum, pgliteCreditDb, signUp } from "./helpers";

const KEY_ID = "rzp_test_abc123";
const KEY_SECRET = "test_key_secret_value";
const WEBHOOK_SECRET = "test_webhook_secret_value";

let seq = 0; // shared across fake instances so ids never collide between tests

/** In-memory stand-in for the Razorpay REST API. */
class FakeRazorpay {
  orders = new Map<string, { id: string; amount: number; currency: string; receipt: string; notes: Record<string, string> }>();
  payments = new Map<string, RazorpayPayment>();
  refunds: Array<{ id: string; payment_id: string; amount: number }> = [];
  calls: string[] = [];

  fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const u = new URL(String(url));
    const method = init?.method ?? "GET";
    const auth = new Headers(init?.headers).get("authorization");
    if (auth !== `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`) {
      return Response.json({ error: { description: "auth failed" } }, { status: 401 });
    }
    const path = u.pathname.replace(/^\/v1/, "");
    this.calls.push(`${method} ${path}`);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    let m: RegExpExecArray | null;

    if (method === "POST" && path === "/orders") {
      const id = `order_T${String(++seq).padStart(8, "0")}`;
      const order = { id, amount: body.amount, currency: body.currency, receipt: body.receipt, notes: body.notes, status: "created" };
      this.orders.set(id, order);
      return Response.json(order);
    }
    if (method === "GET" && (m = /^\/payments\/([^/]+)$/.exec(path))) {
      const p = this.payments.get(m[1]);
      return p ? Response.json(p) : Response.json({ error: { description: "not found" } }, { status: 404 });
    }
    if (method === "GET" && (m = /^\/orders\/([^/]+)\/payments$/.exec(path))) {
      return Response.json({ items: [...this.payments.values()].filter((p) => p.order_id === m![1]) });
    }
    if (method === "POST" && (m = /^\/payments\/([^/]+)\/capture$/.exec(path))) {
      const p = this.payments.get(m[1])!;
      p.status = "captured";
      return Response.json(p);
    }
    if (method === "POST" && (m = /^\/payments\/([^/]+)\/refund$/.exec(path))) {
      const refund = { id: `rfnd_T${String(++seq).padStart(8, "0")}`, payment_id: m[1], amount: body.amount, status: "processed" };
      this.refunds.push(refund);
      return Response.json(refund);
    }
    return Response.json({ error: { description: "unexpected" } }, { status: 400 });
  };

  /** Simulates the student paying in Checkout. */
  pay(orderId: string, status: RazorpayPayment["status"] = "captured", amountOverride?: number): RazorpayPayment {
    const order = this.orders.get(orderId)!;
    const p: RazorpayPayment = {
      id: `pay_T${String(++seq).padStart(8, "0")}`,
      order_id: orderId, amount: amountOverride ?? order.amount, currency: order.currency, status,
      error_description: status === "failed" ? "Card declined" : null,
    };
    this.payments.set(p.id, p);
    return p;
  }
}

function checkoutSignature(orderId: string, paymentId: string, secret = KEY_SECRET): string {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

function webhook(event: string, entities: Record<string, unknown>, eventId: string) {
  const rawBody = JSON.stringify({ entity: "event", event, payload: Object.fromEntries(
    Object.entries(entities).map(([k, v]) => [k, { entity: v }])), created_at: 1700000000 });
  return { rawBody, signature: createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex"), eventId };
}

let db: PGlite;
let rzp: FakeRazorpay;
let deps: PurchaseDeps;

beforeAll(async () => {
  db = await createDb();
  await signUp(db, ALICE);
  await signUp(db, BOB);
}, 60_000);

beforeEach(() => {
  rzp = new FakeRazorpay();
  const config = { keyId: KEY_ID, keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET };
  deps = { db: pgliteCreditDb(db), razorpay: new RazorpayClient(config, rzp.fetch as typeof fetch), config };
});

async function purchaseRow(orderId: string) {
  const { rows } = await db.query<Record<string, unknown>>("select * from credit_purchases where razorpay_order_id = $1", [orderId]);
  return rows[0];
}

describe("order creation", () => {
  it("4. rejects purchases below 100 credits (and non-integers)", async () => {
    expect(validatePurchaseCredits(99)).toMatch(/minimum/);
    expect(validatePurchaseCredits(100.5)).toMatch(/whole number/);
    await expect(createPurchaseOrder(deps, { userId: ALICE, credits: 99 })).rejects.toMatchObject({ status: 400, code: "INVALID_QUANTITY" });
    expect(rzp.calls).toEqual([]); // no Razorpay order was created
  });

  it("5. 100 credits creates a ₹100 (10000 paise) order", async () => {
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 100 });
    expect(order).toMatchObject({ credits: 100, amountPaise: 10000, currency: "INR", keyId: KEY_ID });
    expect(rzp.orders.get(order.orderId)?.amount).toBe(10000);
    const row = await purchaseRow(order.orderId);
    expect(row).toMatchObject({ status: "pending", user_id: ALICE });
    expect(Number(row.amount_paise)).toBe(10000);
  });

  it("6. 500 credits creates a ₹500 (50000 paise) order", async () => {
    expect(creditsToPaise(500)).toBe(50000);
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 500 });
    expect(order.amountPaise).toBe(50000);
    expect(rzp.orders.get(order.orderId)?.amount).toBe(50000);
  });

  it("caps unfinished orders per hour", async () => {
    for (let i = 0; i < 10; i++) await createPurchaseOrder(deps, { userId: BOB, credits: 100 });
    await expect(createPurchaseOrder(deps, { userId: BOB, credits: 100 })).rejects.toMatchObject({ status: 429 });
  });
});

describe("checkout verification", () => {
  it("rejects a forged signature without crediting anything", async () => {
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 100 });
    const pay = rzp.pay(order.orderId);
    const before = await balanceOf(db, ALICE);
    await expect(verifyCheckoutPayment(deps, {
      userId: ALICE, orderId: order.orderId, paymentId: pay.id, signature: checkoutSignature(order.orderId, pay.id, "wrong"),
    })).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
    expect(await balanceOf(db, ALICE)).toBe(before);
  });

  it("7. a failed payment does not credit the wallet", async () => {
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 100 });
    const pay = rzp.pay(order.orderId, "failed");
    const before = await balanceOf(db, ALICE);
    const r = await verifyCheckoutPayment(deps, {
      userId: ALICE, orderId: order.orderId, paymentId: pay.id, signature: checkoutSignature(order.orderId, pay.id),
    });
    expect(r.status).toBe("failed");
    expect((await purchaseRow(order.orderId)).status).toBe("failed");
    expect(await balanceOf(db, ALICE)).toBe(before);
  });

  it("does not trust a signed payment id from a different order", async () => {
    const a = await createPurchaseOrder(deps, { userId: ALICE, credits: 100 });
    const b = await createPurchaseOrder(deps, { userId: ALICE, credits: 1000 });
    const payA = rzp.pay(a.orderId);
    await expect(verifyCheckoutPayment(deps, {
      userId: ALICE, orderId: b.orderId, paymentId: payA.id, signature: checkoutSignature(b.orderId, payA.id),
    })).rejects.toMatchObject({ code: "ORDER_MISMATCH" });
  });

  it("8. a successful payment adds credits exactly once (checkout + webhook + retry)", async () => {
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 500 });
    const pay = rzp.pay(order.orderId);
    const before = await balanceOf(db, ALICE);
    const input = { userId: ALICE, orderId: order.orderId, paymentId: pay.id, signature: checkoutSignature(order.orderId, pay.id) };

    const first = await verifyCheckoutPayment(deps, input);
    expect(first).toEqual({ status: "paid", credits: 500, balance: before + 500 });
    expect(await verifyCheckoutPayment(deps, input)).toEqual({ status: "paid", credits: 500, balance: before + 500 });
    await processWebhook(deps, webhook("payment.captured", { payment: pay }, "evt_once_1"));
    expect(await balanceOf(db, ALICE)).toBe(before + 500);
    expect((await purchaseRow(order.orderId)).status).toBe("paid");
  });

  it("captures an authorized payment when auto-capture is off", async () => {
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 100 });
    const pay = rzp.pay(order.orderId, "authorized");
    const before = await balanceOf(db, ALICE);
    const r = await verifyCheckoutPayment(deps, {
      userId: ALICE, orderId: order.orderId, paymentId: pay.id, signature: checkoutSignature(order.orderId, pay.id),
    });
    expect(r.status).toBe("paid");
    expect(rzp.calls).toContain(`POST /payments/${pay.id}/capture`);
    expect(await balanceOf(db, ALICE)).toBe(before + 100);
  });

  it("doesn't reveal another student's purchase", async () => {
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 100 });
    const pay = rzp.pay(order.orderId);
    await expect(verifyCheckoutPayment(deps, {
      userId: BOB, orderId: order.orderId, paymentId: pay.id, signature: checkoutSignature(order.orderId, pay.id),
    })).rejects.toMatchObject({ status: 404 });
    // …but the real payer is still credited.
    expect((await purchaseRow(order.orderId)).status).toBe("paid");
  });
});

describe("webhooks", () => {
  it("rejects an invalid signature", async () => {
    const w = webhook("payment.captured", { payment: { id: "pay_x" } }, "evt_bad");
    await expect(processWebhook(deps, { ...w, signature: "00".repeat(32) })).rejects.toBeInstanceOf(HttpError);
    await expect(processWebhook(deps, { ...w, rawBody: w.rawBody.replace("pay_x", "pay_y") })).rejects.toMatchObject({ status: 401 });
  });

  it("10. completes the purchase when the browser closed after payment (no verify call)", async () => {
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 250 });
    const pay = rzp.pay(order.orderId);
    const before = await balanceOf(db, ALICE);
    const r = await processWebhook(deps, webhook("payment.captured", { payment: pay }, "evt_closed_1"));
    expect(r).toMatchObject({ status: "processed", detail: "paid" });
    expect(await balanceOf(db, ALICE)).toBe(before + 250);
  });

  it("9. a duplicate (or replayed) webhook does not add credits twice", async () => {
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 100 });
    const pay = rzp.pay(order.orderId);
    const before = await balanceOf(db, ALICE);
    const w = webhook("payment.captured", { payment: pay }, "evt_dup_1");
    await processWebhook(deps, w);
    expect(await processWebhook(deps, w)).toMatchObject({ status: "duplicate" });
    // Same payment under a different event (order.paid) is also a no-op.
    await processWebhook(deps, webhook("order.paid", { payment: pay, order: rzp.orders.get(order.orderId) }, "evt_dup_2"));
    expect(await balanceOf(db, ALICE)).toBe(before + 100);
  });

  it("refuses to credit when the paid amount doesn't match the order", async () => {
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 1000 });
    const pay = rzp.pay(order.orderId, "captured", 100);
    const before = await balanceOf(db, ALICE);
    expect(await processWebhook(deps, webhook("payment.captured", { payment: pay }, "evt_mismatch")))
      .toMatchObject({ detail: "amount_mismatch" });
    expect(await balanceOf(db, ALICE)).toBe(before);
  });

  it("ignores payments for orders that aren't credit purchases", async () => {
    const r = await processWebhook(deps, webhook("payment.captured", {
      payment: { id: "pay_other1", order_id: "order_other1", amount: 100, currency: "INR", status: "captured" },
    }, "evt_other"));
    expect(r).toMatchObject({ status: "processed", detail: "not_ours" });
  });

  it("records a refund made in the Razorpay dashboard", async () => {
    // BOB hit the hourly order cap earlier; age those orders out of the window.
    await db.exec(`update credit_purchases set created_at = now() - interval '2 hours' where user_id = '${BOB}' and status = 'pending'`);
    const order = await createPurchaseOrder(deps, { userId: BOB, credits: 100 });
    const pay = rzp.pay(order.orderId);
    await processWebhook(deps, webhook("payment.captured", { payment: pay }, "evt_bob_pay"));
    const before = await balanceOf(db, BOB);
    await processWebhook(deps, webhook("refund.processed", {
      refund: { id: "rfnd_dash1", payment_id: pay.id, amount: 4000 }, payment: { ...pay, status: "refunded" },
    }, "evt_refund_1"));
    expect(await balanceOf(db, BOB)).toBe(before - 40);
    expect((await purchaseRow(order.orderId)).status).toBe("partially_refunded");
  });
});

describe("reconciliation", () => {
  it("fulfils a paid order whose webhook never arrived, and expires abandoned ones", async () => {
    const paid = await createPurchaseOrder(deps, { userId: ALICE, credits: 100 });
    const abandoned = await createPurchaseOrder(deps, { userId: ALICE, credits: 100 });
    rzp.pay(paid.orderId);
    await db.exec(`update credit_purchases set created_at = now() - interval '25 hours'
                    where razorpay_order_id in ('${paid.orderId}', '${abandoned.orderId}')`);
    const before = await balanceOf(db, ALICE);
    const summary = await reconcilePurchases(deps, { userId: ALICE, minAgeSeconds: 0 });
    expect(summary.fulfilled).toBe(1);
    expect(summary.failed).toBeGreaterThanOrEqual(1);
    expect(await balanceOf(db, ALICE)).toBe(before + 100);
    expect((await purchaseRow(paid.orderId)).razorpay_payment_id).toBeTruthy();
    expect((await purchaseRow(abandoned.orderId)).status).toBe("failed");
    // Running again changes nothing.
    await reconcilePurchases(deps, { userId: ALICE, minAgeSeconds: 0 });
    expect(await balanceOf(db, ALICE)).toBe(before + 100);
  });
});

describe("admin purchase refund", () => {
  it("18. refunds money via Razorpay and records one reversal entry (webhook afterwards is a no-op)", async () => {
    await db.exec(`update credit_purchases set created_at = now() - interval '2 hours' where status = 'pending'`);
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 300 });
    const pay = rzp.pay(order.orderId);
    await processWebhook(deps, webhook("payment.captured", { payment: pay }, "evt_ref_pay"));
    const before = await balanceOf(db, ALICE);
    const purchase = normalisePurchase(await purchaseRow(order.orderId));

    const result = await refundPurchase(deps, {
      purchase, credits: 300, currentBalance: before, adminId: ALICE, reason: "Requested by parent",
    });
    expect(result).toMatchObject({ status: "recorded", credits: 300, amountPaise: 30000, creditsRemoved: 300, shortfall: 0 });
    expect(rzp.refunds).toHaveLength(1);
    expect(await balanceOf(db, ALICE)).toBe(before - 300);

    await processWebhook(deps, webhook("refund.processed", {
      refund: { id: result.refundId, payment_id: pay.id, amount: 30000 }, payment: pay,
    }, "evt_ref_done"));
    expect(await balanceOf(db, ALICE)).toBe(before - 300);
    expect((await purchaseRow(order.orderId)).status).toBe("refunded");
  });

  it("refuses to refund credits the student already spent (unless allowed)", async () => {
    const order = await createPurchaseOrder(deps, { userId: ALICE, credits: 100 });
    const pay = rzp.pay(order.orderId);
    await processWebhook(deps, webhook("payment.captured", { payment: pay }, "evt_spent_pay"));
    const purchase = normalisePurchase(await purchaseRow(order.orderId));
    await expect(refundPurchase(deps, { purchase, credits: 100, currentBalance: 30, adminId: ALICE, reason: "x refund" }))
      .rejects.toMatchObject({ code: "CREDITS_ALREADY_SPENT" });
    expect(rzp.refunds).toHaveLength(0);
  });
});

describe("signatures", () => {
  it("verifies checkout and webhook HMACs in constant time", () => {
    const sig = checkoutSignature("order_A", "pay_B");
    expect(verifyCheckoutSignature("order_A", "pay_B", sig, KEY_SECRET)).toBe(true);
    expect(verifyCheckoutSignature("order_A", "pay_C", sig, KEY_SECRET)).toBe(false);
    expect(verifyCheckoutSignature("order_A", "pay_B", "not-hex", KEY_SECRET)).toBe(false);
    const body = '{"a":1}';
    const wsig = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
    expect(verifyWebhookSignature(body, wsig, WEBHOOK_SECRET)).toBe(true);
    expect(verifyWebhookSignature('{"a": 1}', wsig, WEBHOOK_SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, null, WEBHOOK_SECRET)).toBe(false);
  });
});

describe("20. consistency after the whole payment suite", () => {
  it("wallet balances equal ledger sums", async () => {
    for (const uid of [ALICE, BOB]) expect(await balanceOf(db, uid)).toBe(await ledgerSum(db, uid));
  });
});
