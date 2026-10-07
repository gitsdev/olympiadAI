// Database access for the SEO Agent.
//
// Admin UI code uses the *cookie-session* client, so every read/write is
// checked by the RLS policies in 013_seo_agent.sql (platform_admin only) in
// addition to requireAdmin(). The service-role client is reserved for cron
// and the publishing pipeline, which have no user session.

import { createClient } from "@/lib/supabase/server";

export async function seoDb() {
  return createClient();
}

/** Thrown when migration 013 hasn't been applied to this database yet. */
export class SeoSchemaMissingError extends Error {
  constructor() {
    super("SEO Agent tables not found. Run supabase/migrations/013_seo_agent.sql in the Supabase SQL editor.");
    this.name = "SeoSchemaMissingError";
  }
}

interface PgError { code?: string; message?: string }

/** PostgREST/Postgres "relation does not exist" errors. */
export function isMissingSchemaError(err: PgError | null | undefined): boolean {
  if (!err) return false;
  return err.code === "PGRST205" || err.code === "42P01" || /could not find the table/i.test(err.message ?? "");
}

/** Converts a Supabase error into a thrown error (schema-missing gets its own type). */
export function throwIfDbError(err: PgError | null | undefined, context: string): void {
  if (!err) return;
  if (isMissingSchemaError(err)) throw new SeoSchemaMissingError();
  throw new Error(`${context}: ${err.message ?? "unknown database error"}`);
}
