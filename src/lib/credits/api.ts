// Route-handler helpers for the credit APIs: auth, JSON responses and
// error mapping. Internal errors are logged, never returned to the client.

import "server-only";
import type { User } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import { HttpError } from "./errors";

export { HttpError };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function handle(scope: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message, ...(err.code ? { code: err.code } : {}), ...(err.details ?? {}) }, err.status);
    }
    console.error(JSON.stringify({ scope: `credits.${scope}`, event: "route.error", message: (err as Error)?.message }));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}

export async function parseBody<T>(request: Request, schema: ZodType<T>, message = "Invalid request."): Promise<T> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, message, "INVALID_REQUEST");
  return parsed.data;
}

export interface CreditCaller {
  user: User;
  role: string | null;
  fullName: string | null;
  email: string;
}

/** Signed-in, email-verified caller (any role). */
export async function requireUser(): Promise<CreditCaller> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.", "UNAUTHENTICATED");
  if (user.app_metadata?.email_otp_pending === true) throw new HttpError(403, "Please verify your email first.", "EMAIL_UNVERIFIED");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  const row = profile as { role?: string; full_name?: string } | null;
  return { user, role: row?.role ?? null, fullName: row?.full_name ?? null, email: user.email ?? "" };
}

/** Caller must be a student — only students buy and spend credits. */
export async function requireStudent(): Promise<CreditCaller> {
  const caller = await requireUser();
  if (caller.role !== "student") throw new HttpError(403, "Credits are available to student accounts only.", "NOT_STUDENT");
  return caller;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

export function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
