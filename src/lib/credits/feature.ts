// The integration point for OlympiadIQ features. A feature calls
// chargeFeatureStart() on the server once its prerequisites pass and it is
// about to start, and refundFailedStart() only if it then fails to start.
// See docs/credits/feature-integration.md.

import "server-only";
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

export function chargeFeatureStart(input: FeatureStartInput): Promise<DeductResult> {
  return deductCredits(creditDb(), {
    userId: input.userId,
    featureKey: input.featureKey,
    idempotencyKey: input.sessionKey,
    referenceId: input.referenceId ?? null,
    metadata: input.metadata,
  });
}

/** Gives the charge back when the feature failed BEFORE starting. Safe to call more than once. */
export function refundFailedStart(input: { userId: string; transactionId: string; reason: string }): Promise<ReverseResult> {
  return reverseUsage(creditDb(), {
    userId: input.userId,
    usageTransactionId: input.transactionId,
    reason: input.reason,
  });
}
