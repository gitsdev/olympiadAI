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
