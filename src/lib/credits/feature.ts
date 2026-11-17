// The integration point for OlympiadIQ features. A feature calls
// chargeFeatureStart() on the server once its prerequisites pass and it is
// about to start, and refundFailedStart() only if it then fails to start.
// See docs/credits/feature-integration.md.

import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { creditDb } from "./db";
import { deductCredits, type DeductResult } from "./deduct";
import { reverseUsage, type ReverseResult } from "./refund";
import type { KnownFeatureKey } from "./constants";

export interface FeatureStartInput {
  userId: string;
  featureKey: KnownFeatureKey;
  /** Stable id for this start (attempt id, battle id, client UUID…). Retries with the same key never double-charge. */
  sessionKey: string;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function chargeFeatureStart(input: FeatureStartInput): Promise<DeductResult> {
  const db = creditDb();
  const base = {
    userId: input.userId,
    featureKey: input.featureKey,
    referenceId: input.referenceId ?? null,
    metadata: input.metadata,
  };
  const result = await deductCredits(db, { ...base, idempotencyKey: input.sessionKey });

  // A "duplicate" whose original charge was refunded (the start failed) must
  // not become a free retry: charge again under a fresh key.
  if (result.ok && result.status === "duplicate" && result.transactionId) {
    const { data } = await createServiceClient().from("credit_transactions").select("id")
      .eq("idempotency_key", `reversal:${result.transactionId}`).maybeSingle();
    if (data) return deductCredits(db, { ...base, idempotencyKey: `${input.sessionKey}.r${Date.now().toString(36)}` });
  }
  return result;
}

/**
 * Refunds the charge recorded against `referenceId` (e.g. a job id) for a
 * session that failed without delivering anything. Finds the usage entry
 * itself, so callers needn't store the transaction id. Never throws — a
 * refund problem must not break the feature's own failure handling.
 */
export async function refundFeatureByReference(input: {
  userId: string;
  featureKey: KnownFeatureKey;
  referenceId: string;
  reason: string;
  maxAgeMinutes?: number;
}): Promise<ReverseResult | null> {
  try {
    const { data } = await createServiceClient().from("credit_transactions").select("id")
      .eq("user_id", input.userId).eq("feature_key", input.featureKey)
      .eq("reference_id", input.referenceId).eq("transaction_type", "usage")
      .limit(1).maybeSingle();
    const txId = (data as { id?: string } | null)?.id;
    if (!txId) return null; // nothing was charged (free, or admin)
    return await reverseUsage(creditDb(), {
      userId: input.userId,
      usageTransactionId: txId,
      reason: input.reason,
      maxAgeMinutes: input.maxAgeMinutes,
    });
  } catch (err) {
    console.error(JSON.stringify({ scope: "credits.feature", event: "refund.failed", feature: input.featureKey,
      reference: input.referenceId, message: (err as Error).message }));
    return null;
  }
}

/** Gives the charge back when the feature failed BEFORE starting. Safe to call more than once. */
export function refundFailedStart(input: { userId: string; transactionId: string; reason: string }): Promise<ReverseResult> {
  return reverseUsage(creditDb(), {
    userId: input.userId,
    usageTransactionId: input.transactionId,
    reason: input.reason,
  });
}

/* ── Delivery tracking (migration 025) ────────────────────────────────
 * Practice and Mock Tests charge when the student clicks Start, before the
 * questions exist. A charge whose questions never arrive (connection lost,
 * tab closed, server cut off) is refunded by refundUndeliveredSessions().
 * Only charges made with DELIVERY_TRACKED in their metadata are eligible. */

/** Put in a charge's metadata to opt it into undelivered-session refunds. */
export const DELIVERY_TRACKED = { delivery_tracked: true } as const;

/** Never wait less than this before deciding a session was never delivered. */
export const UNDELIVERED_MIN_AGE_MINUTES = 5;

/**
 * Records that a charged session delivered what it was charged for. Never
 * throws. Returns false if it couldn't be recorded — the session would
 * then be refunded by the sweep, so callers should log but carry on.
 */
export async function markSessionDelivered(input: { userId: string; transactionId: string }): Promise<boolean> {
  try {
    const { data, error } = await creditDb().rpc("credit_mark_session_delivered", {
      p_user_id: input.userId,
      p_usage_transaction_id: input.transactionId,
    });
    if (error) throw new Error(error.message);
    if (data === false) throw new Error("not this user's usage charge");
    return true;
  } catch (err) {
    console.error(JSON.stringify({ scope: "credits.feature", event: "delivery.mark_failed",
      transaction: input.transactionId, message: (err as Error).message }));
    return false;
  }
}

export interface UndeliveredSweepResult {
  found: number;
  refunded: number;
  failed: number;
}

/**
 * Refunds tracked charges that never delivered. `userId` limits it to one
 * student (run when they start a new session); omit it for every student
 * (the daily cron). Idempotent — a charge is refunded at most once. Never
 * throws.
 */
export async function refundUndeliveredSessions(input: {
  userId?: string;
  minAgeMinutes?: number;
  maxAgeHours?: number;
  limit?: number;
} = {}): Promise<UndeliveredSweepResult> {
  const summary: UndeliveredSweepResult = { found: 0, refunded: 0, failed: 0 };
  const maxAgeMinutes = (input.maxAgeHours ?? 72) * 60;
  try {
    const db = creditDb();
    const { data, error } = await db.rpc("credit_list_undelivered_sessions", {
      p_user_id: input.userId ?? null,
      p_min_age_minutes: Math.max(UNDELIVERED_MIN_AGE_MINUTES, input.minAgeMinutes ?? UNDELIVERED_MIN_AGE_MINUTES),
      p_max_age_minutes: maxAgeMinutes,
      p_limit: input.limit ?? 200,
    });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ transaction_id: string; user_id: string }>;
    summary.found = rows.length;
    for (const row of rows) {
      try {
        const r = await reverseUsage(db, {
          userId: row.user_id,
          usageTransactionId: row.transaction_id,
          reason: "questions were never delivered",
          // The list is already bounded by maxAgeHours; let every row through.
          maxAgeMinutes: maxAgeMinutes + 60,
        });
        if (r.ok) summary.refunded++;
        else summary.failed++;
      } catch (err) {
        summary.failed++;
        console.error(JSON.stringify({ scope: "credits.feature", event: "undelivered.refund_failed",
          transaction: row.transaction_id, message: (err as Error).message }));
      }
    }
  } catch (err) {
    console.error(JSON.stringify({ scope: "credits.feature", event: "undelivered.sweep_failed",
      message: (err as Error).message }));
  }
  if (summary.found) {
    console.log(JSON.stringify({ scope: "credits.feature", event: "undelivered.sweep", user: input.userId ?? "all", ...summary }));
  }
  return summary;
}
