import { createClient } from "@supabase/supabase-js";

// No Database generic — hand-written types lack Supabase's internal
// Relationships field, making the generic incompatible (same as server.ts).
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
