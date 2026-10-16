import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { buildVerificationOtpEmail } from "@/lib/email/verification-otp-template";

/**
 * Signup email verification by 6-digit OTP, sent through Brevo.
 *
 * The gate itself reads `app_metadata.email_otp_pending` (see
 * src/lib/supabase/middleware.ts) — app_metadata comes back with the
 * getUser() call the proxy already makes, so no extra DB query per request,
 * and only the service role can write it. Users without the flag (everyone
 * who signed up before this feature, battle-invite accounts) count as
 * verified. profiles.email_verified mirrors it for the admin area.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

export function isEmailOtpPending(appMetadata: Record<string, unknown> | undefined): boolean {
  return appMetadata?.email_otp_pending === true;
}

function hashCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

interface CodeRow {
  code_hash: string;
  expires_at: string;
  attempts: number;
  last_sent_at: string;
  window_started_at: string;
  sends_in_window: number;
}

export type IssueResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds?: number };

/** Generates a fresh code (replacing any previous one) and emails it. */
export async function issueVerificationCode(user: { id: string; email: string; name: string }): Promise<IssueResult> {
  const service = createServiceClient();
  const now = Date.now();

  const { data: existing } = await service
    .from("email_verification_codes")
    .select("code_hash, expires_at, attempts, last_sent_at, window_started_at, sends_in_window")
    .eq("user_id", user.id)
    .maybeSingle<CodeRow>();

  let windowStartedAt = new Date(now).toISOString();
  let sendsInWindow = 1;

  if (existing) {
    const sinceLast = (now - new Date(existing.last_sent_at).getTime()) / 1000;
    if (sinceLast < RESEND_COOLDOWN_SECONDS) {
      const retryAfterSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - sinceLast);
      return { ok: false, error: `Please wait ${retryAfterSeconds}s before requesting another code.`, retryAfterSeconds };
    }
    const windowAgeMs = now - new Date(existing.window_started_at).getTime();
    if (windowAgeMs < 60 * 60 * 1000) {
      if (existing.sends_in_window >= MAX_SENDS_PER_HOUR) {
        const retryAfterSeconds = Math.ceil((60 * 60 * 1000 - windowAgeMs) / 1000);
        return { ok: false, error: "Too many codes requested. Please try again in a little while.", retryAfterSeconds };
      }
      windowStartedAt = existing.window_started_at;
      sendsInWindow = existing.sends_in_window + 1;
    }
  }

  const code = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");

  const { error: upsertError } = await service.from("email_verification_codes").upsert(
    {
      user_id: user.id,
      code_hash: hashCode(user.id, code),
      expires_at: new Date(now + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
      attempts: 0,
      last_sent_at: new Date(now).toISOString(),
      window_started_at: windowStartedAt,
      sends_in_window: sendsInWindow,
    },
    { onConflict: "user_id" }
  );
  if (upsertError) {
    console.error("[issueVerificationCode] upsert failed:", upsertError.message);
    return { ok: false, error: "Couldn't create a verification code. Please try again." };
  }

  const email = buildVerificationOtpEmail({ name: user.name, code, expiresInMinutes: OTP_TTL_MINUTES });
  const result = await sendEmail({ to: user.email, ...email });
  if (!result.sent) return { ok: false, error: "We couldn't send the email right now. Please try again shortly." };

  return { ok: true };
}

export type VerifyResult = { ok: true } | { ok: false; error: string };

/** Checks the code; on success marks the user verified everywhere. */
export async function verifyCode(userId: string, rawCode: string): Promise<VerifyResult> {
  const code = rawCode.replace(/\D/g, "");
  if (code.length !== OTP_LENGTH) return { ok: false, error: `Enter the ${OTP_LENGTH}-digit code from your email.` };

  const service = createServiceClient();
  const { data: row } = await service
    .from("email_verification_codes")
    .select("code_hash, expires_at, attempts, last_sent_at, window_started_at, sends_in_window")
    .eq("user_id", userId)
    .maybeSingle<CodeRow>();

  if (!row) return { ok: false, error: "No active code. Tap “Resend code” to get a new one." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This code has expired. Tap “Resend code” to get a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Tap “Resend code” to get a new one." };
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(userId, code), "hex");
  if (!timingSafeEqual(expected, actual)) {
    const attempts = row.attempts + 1;
    await service.from("email_verification_codes").update({ attempts }).eq("user_id", userId);
    const left = MAX_ATTEMPTS - attempts;
    return {
      ok: false,
      error: left > 0
        ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many incorrect attempts. Tap “Resend code” to get a new one.",
    };
  }

  const { error: authError } = await service.auth.admin.updateUserById(userId, {
    app_metadata: { email_otp_pending: false },
  });
  if (authError) {
    console.error("[verifyCode] updateUserById failed:", authError.message);
    return { ok: false, error: "Couldn't verify right now. Please try again." };
  }

  await Promise.all([
    service.from("profiles")
      .update({ email_verified: true, email_verified_at: new Date().toISOString() })
      .eq("id", userId),
    service.from("email_verification_codes").delete().eq("user_id", userId),
  ]);

  return { ok: true };
}
