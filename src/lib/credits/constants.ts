// Credit wallet business rules. Safe to import from client components —
// no secrets, no server-only dependencies.
//
// Feature PRICES are deliberately not here: they live in the
// feature_credit_costs table and are edited from /admin/credits/pricing.

/** 1 credit = ₹1 = 100 paise. */
export const PAISE_PER_CREDIT = 100;
export const MIN_PURCHASE_CREDITS = 100;
/**
 * No business maximum. This is only a technical guard against typos and
 * Razorpay's per-transaction limit (₹5,00,000 on most accounts).
 */
export const MAX_PURCHASE_CREDITS = 500_000;
/** Mirrors the default in credit_grant_welcome() (migration 021). */
export const WELCOME_CREDITS = 25;
export const SUGGESTED_PURCHASES = [100, 250, 500, 1000] as const;
export const CURRENCY = "INR";

/** Feature identifiers registered in migrations 021, 023 and 024. */
export const FEATURE_KEYS = ["ai_tutor", "mock_test", "practice", "friend_battle", "brain_booster", "question_paper_solver"] as const;
export type KnownFeatureKey = (typeof FEATURE_KEYS)[number];

export const TRANSACTION_TYPES = ["welcome", "purchase", "usage", "refund", "admin_adjustment"] as const;
export type CreditTransactionType = (typeof TRANSACTION_TYPES)[number];

export const PURCHASE_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded"] as const;
export type CreditPurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const TRANSACTION_TYPE_LABELS: Record<CreditTransactionType, string> = {
  welcome: "Welcome bonus",
  purchase: "Purchase",
  usage: "Used",
  refund: "Refund",
  admin_adjustment: "Adjustment",
};

export const PURCHASE_STATUS_LABELS: Record<CreditPurchaseStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
};

export function creditsToPaise(credits: number): number {
  return credits * PAISE_PER_CREDIT;
}

/** Returns an error message, or null when the quantity is purchasable. */
export function validatePurchaseCredits(credits: unknown): string | null {
  if (typeof credits !== "number" || !Number.isInteger(credits)) return "Enter a whole number of credits.";
  if (credits < MIN_PURCHASE_CREDITS) return `The minimum purchase is ${MIN_PURCHASE_CREDITS} credits.`;
  if (credits > MAX_PURCHASE_CREDITS) {
    return `For purchases above ${MAX_PURCHASE_CREDITS.toLocaleString("en-IN")} credits, please contact support.`;
  }
  return null;
}

export function formatInr(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: rupees % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function formatCredits(n: number): string {
  return n.toLocaleString("en-IN");
}
