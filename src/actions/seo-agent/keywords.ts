"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { seoDb } from "@/lib/seo-agent/db";
import { errorMessage, seoLog } from "@/lib/seo-agent/logger";
import { KEYWORD_STATUSES } from "@/lib/seo-agent/constants";
import {
  keywordInputSchema, keywordInputToRow, parseKeywordImport, MAX_ANALYSIS_KEYWORDS,
  type ImportError,
} from "@/lib/seo-agent/keywords";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { analyzeKeywordsCore, PipelineError, type AnalysisSummary } from "@/lib/seo-agent/pipeline";
import { syncAdminSeoKeywords, type KeywordSyncResult } from "@/lib/seo-agent/keyword-sync";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const idSchema = z.uuid();
const idsSchema = z.array(z.uuid()).min(1).max(500);

function revalidate() {
  revalidatePath("/admin/seo-agent", "layout");
}

function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.join(".") || "input"}: ${i.message}` : "Invalid input.";
}

function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === "23505";
}

/** The column doesn't exist yet (migration 026 not applied). */
function isMissingColumn(err: { code?: string } | null): boolean {
  return err?.code === "42703" || err?.code === "PGRST204";
}

export async function createKeyword(input: unknown): Promise<Result<{ id: string }>> {
  const admin = await requireAdmin();
  const parsed = keywordInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const db = await seoDb();
  const { data, error } = await db
    .from("seo_keywords")
    .insert({ ...keywordInputToRow(parsed.data), created_by: admin.id })
    .select("id")
    .single();
  if (isUniqueViolation(error)) return { ok: false, error: `"${parsed.data.keyword}" is already in your keyword list.` };
  if (error) {
    seoLog.error("keyword.create_failed", { error: error.message });
    return { ok: false, error: `Could not add keyword: ${error.message}` };
  }
  revalidate();
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateKeyword(id: string, input: unknown): Promise<Result> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid keyword id." };
  const parsed = keywordInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const db = await seoDb();
  const { error } = await db.from("seo_keywords").update(keywordInputToRow(parsed.data)).eq("id", id);
  if (isUniqueViolation(error)) return { ok: false, error: `"${parsed.data.keyword}" already exists.` };
  if (error) return { ok: false, error: `Could not save keyword: ${error.message}` };
  revalidate();
  return { ok: true };
}

export async function deleteKeywords(ids: string[]): Promise<Result<{ deleted: number }>> {
  await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Select at least one keyword." };

  const db = await seoDb();
  // Keywords synced from /admin/seo are archived instead, or the next sync would add them back.
  const archived = await db.from("seo_keywords").update({ status: "ARCHIVED" }).in("id", parsed.data).eq("source", "ADMIN_SEO").select("id");
  if (archived.error && !isMissingColumn(archived.error)) return { ok: false, error: `Could not delete: ${archived.error.message}` };
  const archivedIds = new Set(((archived.data ?? []) as { id: string }[]).map((r) => r.id));
  const rest = parsed.data.filter((id) => !archivedIds.has(id));
  let deleted = 0;
  if (rest.length) {
    const { data, error } = await db.from("seo_keywords").delete().in("id", rest).select("id");
    if (error) return { ok: false, error: `Could not delete: ${error.message}` };
    deleted = data?.length ?? 0;
  }
  revalidate();
  return { ok: true, deleted: deleted + archivedIds.size };
}

/** Adds the target keywords from /admin/seo that aren't in the SEO Agent yet. */
export async function syncKeywordsFromAdminSeo(): Promise<Result<KeywordSyncResult>> {
  const admin = await requireAdmin();
  try {
    const r = await syncAdminSeoKeywords(await seoDb(), admin.id);
    revalidate();
    return { ok: true, ...r };
  } catch (err) {
    seoLog.error("keywords.sync_failed", { error: errorMessage(err) });
    return { ok: false, error: `Could not sync keywords: ${errorMessage(err)}. Has migration 026 been run?` };
  }
}

export async function setKeywordStatus(ids: string[], status: string): Promise<Result<{ updated: number }>> {
  await requireAdmin();
  const parsedIds = idsSchema.safeParse(ids);
  const parsedStatus = z.enum(KEYWORD_STATUSES).safeParse(status);
  if (!parsedIds.success || !parsedStatus.success) return { ok: false, error: "Invalid selection or status." };

  const db = await seoDb();
  const { data, error } = await db.from("seo_keywords").update({ status: parsedStatus.data }).in("id", parsedIds.data).select("id");
  if (error) return { ok: false, error: `Could not update status: ${error.message}` };
  revalidate();
  return { ok: true, updated: data?.length ?? 0 };
}

export interface ImportSummary {
  inserted: number;
  alreadyExisted: number;
  duplicatesInFile: number;
  errors: ImportError[];
}

export async function importKeywords(text: string, format: "lines" | "csv"): Promise<Result<ImportSummary>> {
  const admin = await requireAdmin();
  if (typeof text !== "string" || text.length > 500_000) return { ok: false, error: "Import is empty or larger than 500 KB." };
  if (format !== "lines" && format !== "csv") return { ok: false, error: "Unknown import format." };

  const { rows, errors, duplicatesInFile } = parseKeywordImport(text, format);
  if (rows.length === 0) return { ok: true, inserted: 0, alreadyExisted: 0, duplicatesInFile, errors };

  const db = await seoDb();
  // ON CONFLICT DO NOTHING on the normalised keyword: existing keywords are left untouched.
  const { data, error } = await db
    .from("seo_keywords")
    .upsert(rows.map((r) => ({ ...keywordInputToRow(r), created_by: admin.id })), { onConflict: "keyword_normalized", ignoreDuplicates: true })
    .select("id");
  if (error) {
    seoLog.error("keyword.import_failed", { error: error.message, rows: rows.length });
    return { ok: false, error: `Import failed: ${error.message}` };
  }
  const inserted = data?.length ?? 0;
  revalidate();
  return { ok: true, inserted, alreadyExisted: rows.length - inserted, duplicatesInFile, errors };
}

export type { AnalysisSummary } from "@/lib/seo-agent/pipeline";

/**
 * Runs the Keyword Analysis Agent on the selected keywords and saves the
 * resulting clusters + recommendations. Logged as a KeywordAgent task.
 */
export async function analyzeSelectedKeywords(ids: string[]): Promise<Result<AnalysisSummary>> {
  const admin = await requireAdmin();
  const parsed = z.array(z.uuid()).min(1).max(MAX_ANALYSIS_KEYWORDS).safeParse(ids);
  if (!parsed.success) return { ok: false, error: `Select between 1 and ${MAX_ANALYSIS_KEYWORDS} keywords to analyse.` };

  try {
    const db = await seoDb();
    const summary = await analyzeKeywordsCore(db, await getSeoSettings(), parsed.data, { createdBy: admin.id, triggeredBy: "USER" as const });
    revalidate();
    return { ok: true, ...summary };
  } catch (err) {
    if (err instanceof PipelineError) return { ok: false, error: err.message };
    seoLog.error("keyword.analysis_failed", { error: errorMessage(err) });
    return { ok: false, error: `Keyword analysis failed: ${errorMessage(err)}` };
  }
}
