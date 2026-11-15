import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRANSACTION_TYPES, type CreditTransactionType } from "./constants";
import { num } from "./db";
import {
  STUDENT_PURCHASE_COLUMNS, STUDENT_TX_COLUMNS,
  type CreditPurchase, type CreditTransaction, type Paginated,
} from "./types";

export function normaliseTx(r: Record<string, unknown>): CreditTransaction {
  return {
    id: String(r.id),
    user_id: (r.user_id as string | null) ?? null,
    transaction_type: r.transaction_type as CreditTransactionType,
    amount: num(r.amount),
    balance_after: num(r.balance_after),
    feature_key: (r.feature_key as string | null) ?? null,
    reference_id: (r.reference_id as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
  };
}

export function normalisePurchase(r: Record<string, unknown>): CreditPurchase {
  return {
    id: String(r.id),
    user_id: (r.user_id as string | null) ?? null,
    credits: num(r.credits),
    amount_paise: num(r.amount_paise),
    currency: String(r.currency ?? "INR"),
    razorpay_order_id: String(r.razorpay_order_id),
    razorpay_payment_id: (r.razorpay_payment_id as string | null) ?? null,
    status: r.status as CreditPurchase["status"],
    refunded_credits: num(r.refunded_credits),
    refunded_paise: num(r.refunded_paise),
    created_at: String(r.created_at),
    paid_at: (r.paid_at as string | null) ?? null,
  };
}

export function isTransactionType(v: unknown): v is CreditTransactionType {
  return typeof v === "string" && (TRANSACTION_TYPES as readonly string[]).includes(v);
}

/** The caller's own ledger, read through their RLS session. */
export async function listOwnTransactions(
  client: SupabaseClient, userId: string,
  opts: { page: number; pageSize: number; type?: CreditTransactionType | null },
): Promise<Paginated<CreditTransaction>> {
  const from = (opts.page - 1) * opts.pageSize;
  let q = client.from("credit_transactions")
    .select(STUDENT_TX_COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + opts.pageSize - 1);
  if (opts.type) q = q.eq("transaction_type", opts.type);
  const { data, count, error } = await q;
  if (error) throw new Error(`credit history: ${error.message}`);
  return {
    rows: (data ?? []).map((r) => normaliseTx({ ...(r as Record<string, unknown>), user_id: userId })),
    page: opts.page, pageSize: opts.pageSize, totalCount: count ?? 0,
  };
}

export async function listOwnPurchases(
  client: SupabaseClient, userId: string, opts: { page: number; pageSize: number },
): Promise<Paginated<CreditPurchase>> {
  const from = (opts.page - 1) * opts.pageSize;
  const { data, count, error } = await client.from("credit_purchases")
    .select(STUDENT_PURCHASE_COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + opts.pageSize - 1);
  if (error) throw new Error(`credit purchases: ${error.message}`);
  return {
    rows: (data ?? []).map((r) => normalisePurchase({ ...(r as Record<string, unknown>), user_id: userId })),
    page: opts.page, pageSize: opts.pageSize, totalCount: count ?? 0,
  };
}
