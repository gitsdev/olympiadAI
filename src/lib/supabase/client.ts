import { createBrowserClient } from "@supabase/ssr";

// We don't pass the Database generic here — Supabase's internal
// Relationships requirement makes hand-written types incompatible.
// Results are cast explicitly via types-helper.ts.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
