// Credit administration: authorisation + reporting queries.
//
// Authorisation layers on the EXISTING admin system rather than replacing it:
//   1. profiles.role must be 'platform_admin' (same check as requireAdmin())
//   2. money-moving actions additionally need a credit_admins row:
//        admin       → pricing changes, manual adjustments
//        super_admin → everything above + purchase refunds

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { toCsv } from "@/lib/admin/csv";
import { requireUser } from "./api";
import { PURCHASE_STATUSES, TRANSACTION_TYPES, type CreditPurchaseStatus, type CreditTransactionType } from "./constants";
import { asJson, callRpc, num, type CreditDb } from "./db";
import { HttpError } from "./errors";
import { normalisePurchase, normaliseTx } from "./history";
import type { CreditPurchase, CreditTransaction, Paginated } from "./types";

export type CreditAdminRole = "super_admin" | "admin";
export type RequiredCreditRole = "viewer" | CreditAdminRole;

export interface CreditAdmin {
  id: string;
  name: string;
  creditRole: CreditAdminRole | null;
}

const RANK: Record<RequiredCreditRole, number> = { viewer: 0, admin: 1, super_admin: 2 };

export function hasCreditRole(have: CreditAdminRole | null, need: RequiredCreditRole): boolean {
  return RANK[have ?? "viewer"] >= RANK[need];
}

export async function getCreditRole(service: SupabaseClient, userId: string): Promise<CreditAdminRole | null> {
  const { data } = await service.from("credit_admins").select("role").eq("user_id", userId).maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  return role === "super_admin" || role === "admin" ? role : null;
}

/** For API routes: throws 401/403 HttpErrors (never redirects). */
export async function requireCreditAdmin(need: RequiredCreditRole = "viewer"): Promise<CreditAdmin> {
  const caller = await requireUser();
  if (caller.role !== "platform_admin") throw new HttpError(403, "Admin access required.", "FORBIDDEN");
  const creditRole = await getCreditRole(createServiceClient(), caller.user.id);
  if (!hasCreditRole(creditRole, need)) {
    throw new HttpError(403, "You don't have permission to do this.", "FORBIDDEN");
  }
  return { id: caller.user.id, name: caller.fullName ?? "Admin", creditRole };
}

// ── Profiles lookup (credit tables reference auth.users, not profiles) ──

export interface ProfileLite { id: string; full_name: string; email: string; role: string }

export async function profilesById(service: SupabaseClient, ids: (string | null)[]): Promise<Map<string, ProfileLite>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const map = new Map<string, ProfileLite>();
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await service.from("profiles").select("id, full_name, email, role").in("id", unique.slice(i, i + 200));
    for (const p of (data ?? []) as ProfileLite[]) map.set(p.id, p);
  }
  return map;
}

/** Resolves a name/email search to user ids (bounded). */
async function searchUserIds(service: SupabaseClient, q: string): Promise<string[]> {
  const term = q.replace(/[%_,()]/g, " ").trim();
  if (!term) return [];
  const { data } = await service.from("profiles").select("id")
    .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).limit(200);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

// ── Overview ────────────────────────────────────────────────────────────

export interface CreditOverview {
  creditsPurchased: number;
  creditsConsumed: number;
  promotionalIssued: number;
  wallets: number;
  pendingPurchases: number;
  successfulPurchases: number;
  revenuePaise: number;
  refundedPaise: number;
  outstandingBalance: number;
}

export async function getCreditOverview(db: CreditDb): Promise<CreditOverview> {
  const rows = await callRpc<Record<string, unknown>[]>(db, "credit_admin_overview");
  const r = rows?.[0] ?? {};
  return {
    creditsPurchased: num(r.credits_purchased),
    creditsConsumed: num(r.credits_consumed),
    promotionalIssued: num(r.promotional_issued),
    wallets: num(r.wallets),
    pendingPurchases: num(r.pending_purchases),
    successfulPurchases: num(r.successful_purchases),
    revenuePaise: num(r.revenue_paise),
    refundedPaise: num(r.refunded_paise),
    outstandingBalance: num(r.outstanding_balance),
  };
}

// ── Wallets ─────────────────────────────────────────────────────────────

export interface AdminWalletRow {
  user_id: string; full_name: string; email: string; role: string;
  balance: number; purchased: number; welcome: number; consumed: number; last_activity: string | null;
}

export async function listWallets(db: CreditDb, opts: { q?: string | null; page: number; pageSize: number }): Promise<Paginated<AdminWalletRow>> {
  const rows = await callRpc<Record<string, unknown>[]>(db, "credit_admin_list_wallets", {
    p_search: opts.q?.trim() || null, p_page: opts.page, p_page_size: opts.pageSize,
  });
  return {
    rows: (rows ?? []).map((r) => ({
      user_id: String(r.user_id), full_name: String(r.full_name ?? ""), email: String(r.email ?? ""), role: String(r.role ?? ""),
      balance: num(r.balance), purchased: num(r.purchased), welcome: num(r.welcome), consumed: num(r.consumed),
      last_activity: (r.last_activity as string | null) ?? null,
    })),
    page: opts.page, pageSize: opts.pageSize, totalCount: num(rows?.[0]?.total_count),
  };
}

// ── Transactions report ─────────────────────────────────────────────────

export interface TransactionFilters {
  from?: string | null; to?: string | null;
  userId?: string | null; q?: string | null;
  featureKey?: string | null; type?: CreditTransactionType | null;
}

export interface PurchaseFilters {
  from?: string | null; to?: string | null;
  userId?: string | null; q?: string | null;
  status?: CreditPurchaseStatus | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Report dates are calendar days in India time. */
export function dayStartIst(d: string): string { return `${d}T00:00:00+05:30`; }
export function dayEndIst(d: string): string { return `${d}T23:59:59.999+05:30`; }

export function parseTransactionFilters(sp: Record<string, string | undefined>): TransactionFilters {
  return {
    from: sp.from && DATE.test(sp.from) ? sp.from : null,
    to: sp.to && DATE.test(sp.to) ? sp.to : null,
    userId: sp.student && /^[0-9a-f-]{36}$/i.test(sp.student) ? sp.student : null,
    q: sp.q?.trim() || null,
    featureKey: sp.feature && /^[a-z][a-z0-9_]{1,49}$/.test(sp.feature) ? sp.feature : null,
    type: sp.type && (TRANSACTION_TYPES as readonly string[]).includes(sp.type) ? (sp.type as CreditTransactionType) : null,
  };
}

export function parsePurchaseFilters(sp: Record<string, string | undefined>): PurchaseFilters {
  return {
    from: sp.from && DATE.test(sp.from) ? sp.from : null,
    to: sp.to && DATE.test(sp.to) ? sp.to : null,
    userId: sp.student && /^[0-9a-f-]{36}$/i.test(sp.student) ? sp.student : null,
    q: sp.q?.trim() || null,
    status: sp.status && (PURCHASE_STATUSES as readonly string[]).includes(sp.status) ? (sp.status as CreditPurchaseStatus) : null,
  };
}

export type WithProfile<T> = T & { student: ProfileLite | null };

export async function listTransactions(
  service: SupabaseClient, f: TransactionFilters, opts: { page: number; pageSize: number },
): Promise<Paginated<WithProfile<CreditTransaction>>> {
  let ids: string[] | null = null;
  if (f.q) {
    ids = await searchUserIds(service, f.q);
    if (!ids.length) return { rows: [], page: opts.page, pageSize: opts.pageSize, totalCount: 0 };
  }
  const start = (opts.page - 1) * opts.pageSize;
  let q = service.from("credit_transactions").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).range(start, start + opts.pageSize - 1);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (ids) q = q.in("user_id", ids);
  if (f.type) q = q.eq("transaction_type", f.type);
  if (f.featureKey) q = q.eq("feature_key", f.featureKey);
  if (f.from) q = q.gte("created_at", dayStartIst(f.from));
  if (f.to) q = q.lte("created_at", dayEndIst(f.to));
  const { data, count, error } = await q;
  if (error) throw new Error(`admin transactions: ${error.message}`);
  const rows = (data ?? []).map((r) => normaliseTx(r as Record<string, unknown>));
  const profiles = await profilesById(service, rows.map((r) => r.user_id));
  return {
    rows: rows.map((r) => ({ ...r, student: r.user_id ? profiles.get(r.user_id) ?? null : null })),
    page: opts.page, pageSize: opts.pageSize, totalCount: count ?? 0,
  };
}

export async function listPurchases(
  service: SupabaseClient, f: PurchaseFilters, opts: { page: number; pageSize: number },
): Promise<Paginated<WithProfile<CreditPurchase>>> {
  let ids: string[] | null = null;
  if (f.q) {
    ids = await searchUserIds(service, f.q);
    // Also allow searching by Razorpay order/payment id.
    if (!ids.length && !/^(order|pay)_/.test(f.q)) return { rows: [], page: opts.page, pageSize: opts.pageSize, totalCount: 0 };
  }
  const start = (opts.page - 1) * opts.pageSize;
  let q = service.from("credit_purchases").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).range(start, start + opts.pageSize - 1);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (f.q && /^order_/.test(f.q)) q = q.eq("razorpay_order_id", f.q);
  else if (f.q && /^pay_/.test(f.q)) q = q.eq("razorpay_payment_id", f.q);
  else if (ids) q = q.in("user_id", ids);
  if (f.status) q = q.eq("status", f.status);
  if (f.from) q = q.gte("created_at", dayStartIst(f.from));
  if (f.to) q = q.lte("created_at", dayEndIst(f.to));
  const { data, count, error } = await q;
  if (error) throw new Error(`admin purchases: ${error.message}`);
  const rows = (data ?? []).map((r) => normalisePurchase(r as Record<string, unknown>));
  const profiles = await profilesById(service, rows.map((r) => r.user_id));
  return {
    rows: rows.map((r) => ({ ...r, student: r.user_id ? profiles.get(r.user_id) ?? null : null })),
    page: opts.page, pageSize: opts.pageSize, totalCount: count ?? 0,
  };
}

export async function getPurchase(service: SupabaseClient, purchaseId: string): Promise<CreditPurchase | null> {
  const { data } = await service.from("credit_purchases").select("*").eq("id", purchaseId).maybeSingle();
  return data ? normalisePurchase(data as Record<string, unknown>) : null;
}

// ── CSV ─────────────────────────────────────────────────────────────────

export const CSV_CAP = 5000;

export async function transactionsCsv(service: SupabaseClient, f: TransactionFilters): Promise<{ csv: string; truncated: boolean }> {
  const { rows } = await listTransactions(service, f, { page: 1, pageSize: CSV_CAP });
  const csv = toCsv(
    ["Date", "Student", "Email", "Type", "Amount", "Balance After", "Feature", "Description", "Reference", "Transaction ID"],
    rows.map((r) => [r.created_at, r.student?.full_name ?? "", r.student?.email ?? "", r.transaction_type, r.amount,
      r.balance_after, r.feature_key ?? "", r.description ?? "", r.reference_id ?? "", r.id]),
  );
  return { csv, truncated: rows.length >= CSV_CAP };
}

export async function purchasesCsv(service: SupabaseClient, f: PurchaseFilters): Promise<{ csv: string; truncated: boolean }> {
  const { rows } = await listPurchases(service, f, { page: 1, pageSize: CSV_CAP });
  const csv = toCsv(
    ["Created", "Paid", "Student", "Email", "Credits", "Amount (INR)", "Status", "Refunded (INR)", "Razorpay Order", "Razorpay Payment"],
    rows.map((r) => [r.created_at, r.paid_at ?? "", r.student?.full_name ?? "", r.student?.email ?? "", r.credits,
      (r.amount_paise / 100).toFixed(2), r.status, (r.refunded_paise / 100).toFixed(2), r.razorpay_order_id, r.razorpay_payment_id ?? ""]),
  );
  return { csv, truncated: rows.length >= CSV_CAP };
}

// ── Manual adjustments ──────────────────────────────────────────────────

export type AdjustResult =
  | { ok: true; status: "adjusted" | "duplicate"; balance: number; transactionId: string }
  | { ok: false; error: "REASON_REQUIRED" | "INVALID_AMOUNT" | "USER_NOT_FOUND" | "INSUFFICIENT_CREDITS"; balance?: number };

/** Adds (amount > 0) or deducts (amount < 0) credits with a mandatory reason. Writes a ledger entry; never overwrites balances. */
export async function adjustCredits(
  db: CreditDb,
  input: { userId: string; amount: number; reason: string; adminId: string; idempotencyKey: string },
): Promise<AdjustResult> {
  const r = asJson<Record<string, unknown>>(await callRpc(db, "credit_admin_adjust", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_reason: input.reason,
    p_admin_id: input.adminId,
    p_idempotency_key: `${input.adminId}:${input.idempotencyKey}`,
  }));
  if (r.ok === true) {
    return { ok: true, status: r.status as "adjusted" | "duplicate", balance: num(r.balance), transactionId: String(r.transaction_id) };
  }
  return { ok: false, error: r.error as Exclude<AdjustResult, { ok: true }>["error"], ...(r.balance !== undefined ? { balance: num(r.balance) } : {}) };
}
