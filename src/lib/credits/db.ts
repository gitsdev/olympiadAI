import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * The slice of a Supabase client the credit service needs. Every balance
 * change is a Postgres function call (migration 021), so the service only
 * ever uses `.rpc()` — which also lets tests run it against PGlite.
 */
export interface CreditDb {
  rpc(fn: string, params?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** Service-role client. Server-only: call it after authorising the caller. */
export function creditDb(): CreditDb {
  return createServiceClient() as unknown as CreditDb;
}

export class CreditDbError extends Error {
  constructor(readonly fn: string, message: string) {
    super(`${fn}: ${message}`);
  }
}

/** Calls a credit function and throws on a database error (never returned to students verbatim). */
export async function callRpc<T>(db: CreditDb, fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, params);
  if (error) throw new CreditDbError(fn, error.message);
  return data as T;
}

/** Postgres bigint columns may arrive as strings; normalise to number. */
export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  if (typeof v === "bigint") return Number(v);
  return 0;
}

/** Functions returning jsonb come back as an object (PostgREST) or a string (some drivers). */
export function asJson<T>(v: unknown): T {
  return (typeof v === "string" ? JSON.parse(v) : v) as T;
}
