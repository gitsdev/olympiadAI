import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifies email OTP links (password recovery, signup confirmation, etc.) via
 * token_hash rather than the PKCE `code` exchange used by /auth/callback.
 * token_hash verification isn't bound to the requesting browser's cookies, so
 * it works when the link is opened on a different device/browser than the one
 * that triggered the email — unlike exchangeCodeForSession, which requires the
 * original code_verifier cookie and fails across devices.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/onboarding";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
