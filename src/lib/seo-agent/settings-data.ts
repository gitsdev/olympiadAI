// Server-side read of SEO Agent settings (RLS-checked, admin session).

import { seoDb, throwIfDbError } from "./db";
import { settingsFromRow, type SeoSettings, type SeoSettingsRow } from "./settings-schema";

export async function getSeoSettings(): Promise<SeoSettings> {
  const db = await seoDb();
  const { data, error } = await db.from("seo_settings").select("*").eq("id", 1).maybeSingle();
  throwIfDbError(error, "Loading SEO settings");
  if (!data) throw new Error("seo_settings row is missing — re-run 013_seo_agent.sql.");
  return settingsFromRow(data as SeoSettingsRow);
}

/**
 * Which server-side secrets are present. Only booleans leave the server —
 * secret values are never sent to the browser.
 */
export function getSecretStatus() {
  return [
    { name: "ANTHROPIC_API_KEY", purpose: "AI provider (Claude)", configured: Boolean(process.env.ANTHROPIC_API_KEY) },
    { name: "SUPABASE_SERVICE_ROLE_KEY", purpose: "Cron + publishing pipeline", configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { name: "CRON_SECRET", purpose: "Protects /api/cron/* (Vercel Cron)", configured: Boolean(process.env.CRON_SECRET) },
    { name: "BLOG_API_SECRET", purpose: "Protects /api/content/publish", configured: Boolean(process.env.BLOG_API_SECRET) },
  ];
}
