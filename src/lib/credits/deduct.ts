import "server-only";
import { asJson, callRpc, num, type CreditDb } from "./db";

export interface DeductInput {
  userId: string;
  featureKey: string;
  /**
   * Stable per feature session (e.g. the mock-test attempt id, battle id or
   * a UUID the client generated for this start). Retrying with the same key
   * never charges twice. Namespaced per user + feature internally, so one
   * user's keys can never collide with another's.
   */
  idempotencyKey: string;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}

export type DeductResult =
  | { ok: true; status: "charged" | "duplicate" | "free"; cost: number; balance: number; transactionId: string | null }
  | { ok: false; error: "INSUFFICIENT_CREDITS"; cost: number; balance: number; shortfall: number }
  | { ok: false; error: "FEATURE_NOT_FOUND" | "NOT_ELIGIBLE"; cost?: number; balance?: number };

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,120}$/;
export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === "string" && KEY_PATTERN.test(key);
}

export function scopedUsageKey(userId: string, featureKey: string, key: string): string {
  return `${userId}:${featureKey}:${key}`;
}

/**
 * Charges the configured price for one start of a feature — atomically, in
 * Postgres (credit_deduct → credit_apply: wallet row locked FOR UPDATE,
 * balance checked, ledger written, all in one transaction).
 *
 * Call it only once the feature has passed its own prerequisites and is
 * about to start. If the feature then fails before starting, call
 * reverseUsage() with the returned transactionId.
 *
 * `status: "free"` means the feature is not charged right now (disabled for
 * charging, or not priced yet) — start it without consuming credits.
 */
export async function deductCredits(db: CreditDb, input: DeductInput): Promise<DeductResult> {
  if (!isValidIdempotencyKey(input.idempotencyKey)) throw new Error("deductCredits: invalid idempotency key");
  const raw = asJson<Record<string, unknown>>(await callRpc(db, "credit_deduct", {
    p_user_id: input.userId,
    p_feature_key: input.featureKey,
    p_idempotency_key: scopedUsageKey(input.userId, input.featureKey, input.idempotencyKey),
    p_reference_id: input.referenceId ?? null,
    p_metadata: input.metadata ?? {},
  }));

  if (raw.ok === true) {
    return {
      ok: true,
      status: raw.status as "charged" | "duplicate" | "free",
      cost: num(raw.cost),
      balance: num(raw.balance),
      transactionId: (raw.transaction_id as string | null) ?? null,
    };
  }
  if (raw.error === "INSUFFICIENT_CREDITS") {
    const cost = num(raw.cost);
    const balance = num(raw.balance);
    return { ok: false, error: "INSUFFICIENT_CREDITS", cost, balance, shortfall: Math.max(0, cost - balance) };
  }
  return {
    ok: false,
    error: raw.error as "FEATURE_NOT_FOUND" | "NOT_ELIGIBLE",
    ...(raw.cost !== undefined ? { cost: num(raw.cost) } : {}),
    ...(raw.balance !== undefined ? { balance: num(raw.balance) } : {}),
  };
}

/** Student-facing message + HTTP status for a failed deduction. */
export function deductErrorResponse(result: Extract<DeductResult, { ok: false }>): {
  status: number; body: Record<string, unknown>;
} {
  switch (result.error) {
    case "INSUFFICIENT_CREDITS":
      return {
        status: 402,
        body: {
          error: `You need ${result.cost} credits to start this, but you have ${result.balance}.`,
          code: "INSUFFICIENT_CREDITS",
          required: result.cost,
          balance: result.balance,
          shortfall: result.shortfall,
          buyUrl: "/credits",
        },
      };
    case "NOT_ELIGIBLE":
      return { status: 403, body: { error: "Credits are available to student accounts only.", code: "NOT_ELIGIBLE" } };
    default:
      return { status: 404, body: { error: "This feature isn't available.", code: "FEATURE_NOT_FOUND" } };
  }
}
