import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Site maintenance mode (migration 020, table `site_status`).
 * Safe to import from the proxy — no server-only dependencies.
 */
export interface MaintenanceState {
  enabled: boolean;
  message: string | null;
  updatedAt: string | null;
}

export const MAINTENANCE_OFF: MaintenanceState = { enabled: false, message: null, updatedAt: null };

/** Reads the flag. Fails open (site stays up) if the row/table is missing. */
export async function readMaintenanceState(client: SupabaseClient): Promise<MaintenanceState> {
  const { data, error } = await client
    .from("site_status")
    .select("maintenance_mode, maintenance_message, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return MAINTENANCE_OFF;
  const row = data as { maintenance_mode: boolean; maintenance_message: string | null; updated_at: string };
  return { enabled: row.maintenance_mode === true, message: row.maintenance_message, updatedAt: row.updated_at };
}

// The proxy runs on every request, so cache the flag per server instance
// briefly. Toggling therefore takes up to this long to reach every instance.
const CACHE_TTL_MS = 10_000;
let cached: { state: MaintenanceState; expires: number } | null = null;

export async function getMaintenanceStateCached(client: SupabaseClient): Promise<MaintenanceState> {
  const now = Date.now();
  if (cached && cached.expires > now) return cached.state;
  const state = await readMaintenanceState(client);
  cached = { state, expires: now + CACHE_TTL_MS };
  return state;
}

/** Paths a non-admin may still reach while maintenance mode is on. */
export function isMaintenanceExempt(pathname: string): boolean {
  return (
    pathname === "/maintenance"
    // Admins must be able to sign in (and recover their password) to turn it off.
    || pathname === "/login"
    || pathname === "/auth/callback"
    || pathname === "/auth/confirm"
    || pathname === "/forgot-password"
    || pathname === "/reset-password"
    // Email unsubscribe links must keep working.
    || pathname === "/unsubscribe"
    || pathname === "/api/unsubscribe"
    // Secret-authenticated background jobs.
    || pathname.startsWith("/api/cron/")
    || pathname === "/api/question-paper/worker"
  );
}
