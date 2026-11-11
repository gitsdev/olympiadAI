// Shared helpers for the Question Paper Solver's route handlers.

import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DAILY_JOB_LIMIT, DAILY_REGEN_LIMIT } from "./constants";
import type { JobRow } from "./types";

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** Turns thrown errors into JSON responses with user-safe messages. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(JSON.stringify({ scope: "qps", event: "route.error", message: (err as Error)?.message }));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}

export async function requireUser(): Promise<{ user: User; isAdmin: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  if (user.app_metadata?.email_otp_pending === true) throw new HttpError(403, "Please verify your email first.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { user, isAdmin: (profile as { role?: string } | null)?.role === "platform_admin" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(id: string): void {
  if (!UUID.test(id)) throw new HttpError(404, "Not found.");
}

/**
 * Loads a job the caller owns. Reads through the user's RLS session, so a
 * job belonging to someone else is simply "not found". (Admins can read any
 * job via RLS, but mutations below always require ownership.)
 */
export async function getOwnedJob(jobId: string, userId: string): Promise<JobRow> {
  assertUuid(jobId);
  const supabase = await createClient();
  const { data } = await supabase.from("qps_jobs").select("*").eq("id", jobId).eq("user_id", userId).maybeSingle();
  if (!data) throw new HttpError(404, "Question paper not found.");
  return data as JobRow;
}

/** The deployment's own origin, for the worker self-call. */
export function originOf(request: Request): string {
  return new URL(request.url).origin;
}

function dayAgo(): string {
  return new Date(Date.now() - 24 * 3600 * 1000).toISOString();
}

/** Papers started + full-sheet regenerations in the last 24 h. */
export async function assertJobQuota(userId: string, isAdmin: boolean): Promise<void> {
  if (isAdmin) return;
  const db = createServiceClient();
  const since = dayAgo();
  const [{ count: started }, { count: regens }] = await Promise.all([
    db.from("qps_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("started_at", since),
    db.from("qps_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "regenerate_sheet").gte("created_at", since),
  ]);
  if ((started ?? 0) + (regens ?? 0) >= DAILY_JOB_LIMIT) {
    throw new HttpError(429, `You can solve up to ${DAILY_JOB_LIMIT} question papers a day. Please try again tomorrow.`);
  }
}

export async function assertRegenQuota(userId: string, isAdmin: boolean): Promise<void> {
  if (isAdmin) return;
  const db = createServiceClient();
  const { count } = await db.from("qps_usage").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("kind", "regenerate_answer").gte("created_at", dayAgo());
  if ((count ?? 0) >= DAILY_REGEN_LIMIT) {
    throw new HttpError(429, `You can regenerate up to ${DAILY_REGEN_LIMIT} answers a day. Please try again tomorrow.`);
  }
}
