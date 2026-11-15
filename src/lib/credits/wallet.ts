import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callRpc, num, type CreditDb } from "./db";
import type { WalletSummary } from "./types";

/**
 * Reads the caller's balance through their own session, so RLS limits it
 * to their wallet. A missing wallet reads as 0.
 */
export async function getOwnBalance(client: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await client.from("credit_wallets").select("balance").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`credit balance: ${error.message}`);
  return num((data as { balance?: unknown } | null)?.balance);
}

/** Same as getOwnBalance but returns null instead of throwing (e.g. before migration 021 is applied). */
export async function tryGetOwnBalance(client: SupabaseClient, userId: string): Promise<number | null> {
  try {
    return await getOwnBalance(client, userId);
  } catch {
    return null;
  }
}

export async function getWalletSummary(db: CreditDb, userId: string): Promise<WalletSummary> {
  const rows = await callRpc<Record<string, unknown>[]>(db, "credit_user_summary", { p_user_id: userId });
  const r = rows?.[0] ?? {};
  return {
    balance: num(r.balance),
    purchased: num(r.purchased),
    welcome: num(r.welcome),
    consumed: num(r.consumed),
    refunded: num(r.refunded),
    adjusted: num(r.adjusted),
    transactionCount: num(r.transaction_count),
  };
}

export type WelcomeResult = "granted" | "already_granted" | "not_eligible";

/** Grants the one-time welcome credits (also done automatically by a trigger on signup). */
export async function grantWelcomeCredits(db: CreditDb, userId: string): Promise<WelcomeResult> {
  return callRpc<WelcomeResult>(db, "credit_grant_welcome", { p_user_id: userId });
}
