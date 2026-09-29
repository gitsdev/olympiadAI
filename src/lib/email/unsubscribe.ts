import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Opts the profile owning `token` out of marketing/reminder emails. Token
 * based (no login) so it works straight from an inbox; the token is a
 * random uuid stored on the profile, never the profile id. Transactional
 * emails (password reset, battle invites) are unaffected.
 */
export async function optOutByToken(token: string | null | undefined): Promise<boolean> {
  if (!token || !UUID_RE.test(token)) return false;
  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .update({ email_opt_out: true })
    .eq("unsubscribe_token", token)
    .select("id");
  return !error && (data?.length ?? 0) > 0;
}
