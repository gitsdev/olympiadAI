// Minimal Razorpay REST client (no SDK dependency) + signature checks.
// Server-only: uses RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
}

export function razorpayConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null };
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string | null;
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  captured?: boolean;
  error_description?: string | null;
}

export interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
}

export class RazorpayError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Fetch = typeof fetch;

/** Thin client. `fetchImpl` is injectable for tests. */
export class RazorpayClient {
  constructor(private readonly cfg: RazorpayConfig, private readonly fetchImpl: Fetch = fetch) {}

  get keyId(): string {
    return this.cfg.keyId;
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const auth = Buffer.from(`${this.cfg.keyId}:${this.cfg.keySecret}`).toString("base64");
    const res = await this.fetchImpl(`${API}${path}`, {
      method,
      headers: { authorization: `Basic ${auth}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { description?: string } } & T;
    if (!res.ok) throw new RazorpayError(res.status, data?.error?.description ?? `Razorpay ${method} ${path} failed (${res.status})`);
    return data;
  }

  createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder> {
    return this.request("POST", "/orders", {
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    });
  }

  fetchPayment(paymentId: string): Promise<RazorpayPayment> {
    return this.request("GET", `/payments/${encodeURIComponent(paymentId)}`);
  }

  async fetchOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
    const res = await this.request<{ items: RazorpayPayment[] }>("GET", `/orders/${encodeURIComponent(orderId)}/payments`);
    return res.items ?? [];
  }

  /** Captures an authorized payment (only needed if auto-capture is off on the account). */
  capturePayment(paymentId: string, amountPaise: number): Promise<RazorpayPayment> {
    return this.request("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: "INR" });
  }

  refundPayment(paymentId: string, amountPaise: number, notes: Record<string, string>): Promise<RazorpayRefund> {
    return this.request("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise, notes });
  }
}

export function razorpayClient(fetchImpl?: Fetch): RazorpayClient | null {
  const cfg = razorpayConfig();
  return cfg ? new RazorpayClient(cfg, fetchImpl) : null;
}

function safeEqualHex(expectedHex: string, actual: string): boolean {
  if (typeof actual !== "string" || !/^[0-9a-f]+$/i.test(actual)) return false;
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(actual, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Standard Checkout: HMAC-SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhooks: HMAC-SHA256(raw request body, webhook secret). Must use the raw body, not re-serialised JSON. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
