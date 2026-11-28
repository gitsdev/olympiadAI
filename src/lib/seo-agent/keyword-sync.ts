// Keeps the SEO Agent's keyword list in step with the target keywords on
// /admin/seo (src/lib/admin/seo-data.ts). New keywords are added; existing
// ones are never overwritten, so edits, pauses and archives made in the SEO
// Agent stick. Run by the autopilot every day and by the Sync button.

import type { SupabaseClient } from "@supabase/supabase-js";
import { SEO_KEYWORDS, type Priority, type SeoKeyword } from "@/lib/admin/seo-data";
import { throwIfDbError } from "./db";
import { cleanKeyword, inferClassAndSubject, normalizeKeyword } from "./keywords";

const PRIORITY: Record<Priority, "HIGH" | "MEDIUM" | "LOW"> = { P1: "HIGH", P2: "MEDIUM", P3: "LOW" };

export interface SyncedKeywordRow {
  keyword: string;
  search_intent: "INFORMATIONAL" | "NAVIGATIONAL" | "COMMERCIAL" | "TRANSACTIONAL";
  target_class: number | null;
  subject: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "ACTIVE";
  source: "ADMIN_SEO";
  notes: string;
}

/** /admin/seo keyword → seo_keywords row. Volume and difficulty are estimates there, so they go in notes, marked as such. */
export function adminSeoKeywordToRow(k: SeoKeyword): SyncedKeywordRow {
  const { targetClass, subject } = inferClassAndSubject(k.keyword);
  return {
    keyword: cleanKeyword(k.keyword),
    search_intent: k.intent.toUpperCase() as SyncedKeywordRow["search_intent"],
    target_class: targetClass,
    subject,
    priority: PRIORITY[k.priority],
    status: "ACTIVE",
    source: "ADMIN_SEO",
    notes: `From /admin/seo · ${k.cluster} · est. ${k.volume} searches/month · ${k.difficulty} difficulty (estimates) · target page ${k.targetPage}`,
  };
}

/** Unique rows for every /admin/seo keyword (first one wins on duplicates). */
export function adminSeoKeywordRows(source: SeoKeyword[] = SEO_KEYWORDS): SyncedKeywordRow[] {
  const seen = new Set<string>();
  const rows: SyncedKeywordRow[] = [];
  for (const k of source) {
    const key = normalizeKeyword(k.keyword);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(adminSeoKeywordToRow(k));
  }
  return rows;
}

export interface KeywordSyncResult {
  /** Keywords on /admin/seo. */
  total: number;
  /** Newly added to the SEO Agent. */
  added: number;
}

/** Adds /admin/seo keywords the SEO Agent doesn't have yet. Safe to run any number of times. */
export async function syncAdminSeoKeywords(db: SupabaseClient, createdBy: string | null = null): Promise<KeywordSyncResult> {
  const rows = adminSeoKeywordRows();
  const { data, error } = await db
    .from("seo_keywords")
    .upsert(rows.map((r) => ({ ...r, created_by: createdBy })), { onConflict: "keyword_normalized", ignoreDuplicates: true })
    .select("id");
  throwIfDbError(error, "Syncing keywords from /admin/seo");
  return { total: rows.length, added: data?.length ?? 0 };
}
