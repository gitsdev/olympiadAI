import { createServiceClient } from "@/lib/supabase/service";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Generates a device-independent sign-in link for `email`, without sending
 * Supabase's own template email — the caller sends their own custom email
 * (e.g. via Brevo) with this link embedded.
 *
 * Deliberately builds a link at our own /auth/confirm route using the
 * returned token_hash (OTP verification), NOT Supabase's hosted
 * `action_link` (which round-trips through Supabase's PKCE `code` flow at
 * /auth/callback) — this is generated server-side with no browser involved,
 * so there's no code_verifier cookie for a later PKCE exchange to match
 * against. /auth/confirm's token_hash verification is exactly the
 * device-independent mechanism this needs (see its own header comment).
 *
 * Picks 'invite' vs 'magiclink' based on whether the email already has an
 * OlympiadIQ account — admin.generateLink({type:'invite'}) errors for an
 * email that's already registered.
 */
export async function generateSignInLink(email: string, next: string): Promise<string | null> {
  const service = createServiceClient();

  const { data: existingProfile } = await service.from("profiles").select("id").eq("email", email).maybeSingle();
  const linkType: "invite" | "magiclink" = existingProfile ? "magiclink" : "invite";

  const { data, error } = await service.auth.admin.generateLink({
    type: linkType,
    email,
    options: { redirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}` },
  });

  if (error || !data?.properties?.hashed_token) {
    console.error("[generateSignInLink] generateLink failed:", error?.message);
    return null;
  }

  return `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${linkType}&next=${encodeURIComponent(next)}`;
}
