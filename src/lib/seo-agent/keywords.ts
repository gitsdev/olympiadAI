// Keyword validation, normalisation and import parsing. Pure + client-safe.

import { z } from "zod";
import { KEYWORD_STATUSES, SEARCH_INTENTS } from "./constants";

export const KEYWORD_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export const KEYWORD_SUBJECTS = ["Mathematics", "Science", "English", "Reasoning", "General Knowledge", "Computers"] as const;
export const MAX_IMPORT_ROWS = 1000;
export const MAX_ANALYSIS_KEYWORDS = 50;

/**
 * Display form stored in seo_keywords.keyword: whitespace collapsed + trimmed.
 * Cleaning first keeps the SQL generated column (lower(regexp_replace(trim(k),
 * '\s+', ' '))) identical to normalizeKeyword() below.
 */
export function cleanKeyword(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Comparison key — must match seo_keywords.keyword_normalized. */
export function normalizeKeyword(raw: string): string {
  return cleanKeyword(raw).toLowerCase();
}

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();

export const keywordInputSchema = z.object({
  keyword: z.string().transform(cleanKeyword).pipe(z.string().min(2, "Keyword is too short").max(200, "Keyword is too long")),
  searchIntent: z.enum(SEARCH_INTENTS).nullable().optional(),
  targetClass: z.number().int().min(1).max(12).nullable().optional(),
  subject: optionalText(60),
  priority: z.enum(KEYWORD_PRIORITIES).default("MEDIUM"),
  status: z.enum(KEYWORD_STATUSES).default("ACTIVE"),
  notes: optionalText(1000),
});
export type KeywordInput = z.infer<typeof keywordInputSchema>;

export function keywordInputToRow(k: KeywordInput) {
  return {
    keyword: k.keyword,
    search_intent: k.searchIntent ?? null,
    target_class: k.targetClass ?? null,
    subject: k.subject ?? null,
    priority: k.priority,
    status: k.status,
    notes: k.notes ?? null,
  };
}

/** Keeps the first occurrence of each normalised keyword. */
export function dedupeKeywords<T extends { keyword: string }>(items: T[]): { unique: T[]; duplicates: T[] } {
  const seen = new Set<string>();
  const unique: T[] = [];
  const duplicates: T[] = [];
  for (const item of items) {
    const key = normalizeKeyword(item.keyword);
    if (seen.has(key)) duplicates.push(item);
    else {
      seen.add(key);
      unique.push(item);
    }
  }
  return { unique, duplicates };
}

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ImportError { line: number; message: string }
export interface ImportParseResult { rows: KeywordInput[]; errors: ImportError[]; duplicatesInFile: number }

const HEADER_ALIASES: Record<string, keyof KeywordInput> = {
  keyword: "keyword", keywords: "keyword",
  search_intent: "searchIntent", intent: "searchIntent", searchintent: "searchIntent",
  target_class: "targetClass", class: "targetClass", targetclass: "targetClass",
  subject: "subject", priority: "priority", status: "status", notes: "notes",
};

function rowFromRecord(rec: Partial<Record<keyof KeywordInput, string>>): unknown {
  const upper = (v?: string) => (v?.trim() ? v.trim().toUpperCase().replace(/\s+/g, "_") : undefined);
  const cls = rec.targetClass?.trim().replace(/^class\s*/i, "");
  return {
    keyword: rec.keyword ?? "",
    searchIntent: upper(rec.searchIntent) ?? null,
    targetClass: cls ? Number(cls) : null,
    subject: rec.subject ?? null,
    priority: upper(rec.priority),
    status: upper(rec.status),
    notes: rec.notes ?? null,
  };
}

/**
 * Parses a bulk import. "lines" = one keyword per line; "csv" = header row
 * with at least a `keyword` column (other columns optional).
 */
export function parseKeywordImport(text: string, format: "lines" | "csv"): ImportParseResult {
  const errors: ImportError[] = [];
  const candidates: { line: number; value: unknown }[] = [];

  if (format === "lines") {
    text.split(/\r?\n/).forEach((l, i) => {
      if (l.trim()) candidates.push({ line: i + 1, value: { keyword: l } });
    });
  } else {
    const table = parseCsv(text);
    if (table.length === 0) return { rows: [], errors: [{ line: 1, message: "The CSV file is empty." }], duplicatesInFile: 0 };
    const header = table[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/[\s-]+/g, "_")] ?? null);
    if (!header.includes("keyword")) {
      return { rows: [], errors: [{ line: 1, message: 'The first row must be a header with a "keyword" column.' }], duplicatesInFile: 0 };
    }
    table.slice(1).forEach((cells, i) => {
      const rec: Partial<Record<keyof KeywordInput, string>> = {};
      header.forEach((col, j) => { if (col && cells[j] !== undefined) rec[col] = cells[j]; });
      candidates.push({ line: i + 2, value: rowFromRecord(rec) });
    });
  }

  if (candidates.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `Import at most ${MAX_IMPORT_ROWS} keywords at a time.` }], duplicatesInFile: 0 };
  }

  const valid: KeywordInput[] = [];
  for (const c of candidates) {
    const parsed = keywordInputSchema.safeParse(c.value);
    if (parsed.success) valid.push(parsed.data);
    else errors.push({ line: c.line, message: parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`).join("; ") });
  }

  const { unique, duplicates } = dedupeKeywords(valid);
  return { rows: unique, errors, duplicatesInFile: duplicates.length };
}

const SUBJECT_WORDS: [RegExp, (typeof KEYWORD_SUBJECTS)[number]][] = [
  [/\b(math|maths|mathematics|imo|ioqm)\b/i, "Mathematics"],
  [/\b(science|nso|physics|chemistry|biology)\b/i, "Science"],
  [/\b(english|ieo|grammar)\b/i, "English"],
  [/\b(reasoning|logical)\b/i, "Reasoning"],
  [/\b(gk|general knowledge|igko)\b/i, "General Knowledge"],
  [/\b(cyber|computer|nco|coding)\b/i, "Computers"],
];

/** Best-effort class and subject from keyword text, e.g. "maths olympiad class 5" → 5, Mathematics. */
export function inferClassAndSubject(text: string): { targetClass: number | null; subject: string | null } {
  const m = /\b(?:class|grade|std)\s*(\d{1,2})\b/i.exec(text);
  const cls = m ? Number(m[1]) : null;
  return {
    targetClass: cls && cls >= 1 && cls <= 12 ? cls : null,
    subject: SUBJECT_WORDS.find(([re]) => re.test(text))?.[1] ?? null,
  };
}
