import type { CreditPurchaseStatus, CreditTransactionType } from "./constants";

export interface CreditTransaction {
  id: string;
  user_id: string | null;
  transaction_type: CreditTransactionType;
  amount: number;
  balance_after: number;
  feature_key: string | null;
  reference_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreditPurchase {
  id: string;
  user_id: string | null;
  credits: number;
  amount_paise: number;
  currency: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  status: CreditPurchaseStatus;
  refunded_credits: number;
  refunded_paise: number;
  created_at: string;
  paid_at: string | null;
}

export interface FeaturePricing {
  id: string;
  feature_key: string;
  feature_name: string;
  credit_cost: number | null;
  is_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
  updated_by_name?: string | null;
}

export interface WalletSummary {
  balance: number;
  purchased: number;
  welcome: number;
  consumed: number;
  refunded: number;
  adjusted: number;
  transactionCount: number;
}

export interface Paginated<T> {
  rows: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** Columns safe to return to the owning student (no internal metadata). */
export const STUDENT_TX_COLUMNS =
  "id, transaction_type, amount, balance_after, feature_key, reference_id, description, created_at";
export const STUDENT_PURCHASE_COLUMNS =
  "id, credits, amount_paise, currency, razorpay_order_id, razorpay_payment_id, status, refunded_credits, refunded_paise, created_at, paid_at";
