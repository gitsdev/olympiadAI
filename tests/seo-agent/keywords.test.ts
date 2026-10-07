import { describe, expect, it } from "vitest";
import {
  cleanKeyword, dedupeKeywords, keywordInputSchema, normalizeKeyword, parseCsv, parseKeywordImport,
} from "@/lib/seo-agent/keywords";
import { escapeLike } from "@/lib/seo-agent/keywords-data";

describe("keyword normalisation", () => {
  it("collapses whitespace and lower-cases", () => {
    expect(cleanKeyword("  Maths\t Olympiad \n Class 5 ")).toBe("Maths Olympiad Class 5");
    expect(normalizeKeyword("  Maths\t Olympiad \n Class 5 ")).toBe("maths olympiad class 5");
  });

  it("de-duplicates by normalised form, keeping the first", () => {
    const { unique, duplicates } = dedupeKeywords([{ keyword: "IMO Class 5" }, { keyword: "imo  class 5" }, { keyword: "NSO class 5" }]);
    expect(unique.map((k) => k.keyword)).toEqual(["IMO Class 5", "NSO class 5"]);
    expect(duplicates).toHaveLength(1);
  });
});

describe("keywordInputSchema (keyword creation)", () => {
  it("applies defaults and cleans the keyword", () => {
    const k = keywordInputSchema.parse({ keyword: "  maths   olympiad class 5 " });
    expect(k).toMatchObject({ keyword: "maths olympiad class 5", priority: "MEDIUM", status: "ACTIVE" });
  });

  it("turns empty optional text into null", () => {
    expect(keywordInputSchema.parse({ keyword: "abc", subject: " ", notes: "" })).toMatchObject({ subject: null, notes: null });
  });

  it.each([
    [{ keyword: "a" }],
    [{ keyword: "x".repeat(201) }],
    [{ keyword: "ok keyword", targetClass: 13 }],
    [{ keyword: "ok keyword", status: "DONE" }],
    [{ keyword: "ok keyword", searchIntent: "BUY" }],
  ])("rejects %j", (input) => {
    expect(keywordInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, CRLF and a BOM", () => {
    const csv = '﻿keyword,notes\r\n"imo, class 5","say ""hi"""\r\nnso class 6,\r\n';
    expect(parseCsv(csv)).toEqual([["keyword", "notes"], ["imo, class 5", 'say "hi"'], ["nso class 6", ""]]);
  });

  it("keeps newlines inside quoted fields and drops blank lines", () => {
    expect(parseCsv('a,b\n"line1\nline2",x\n\n')).toEqual([["a", "b"], ["line1\nline2", "x"]]);
  });
});

describe("parseKeywordImport (bulk + CSV import)", () => {
  it("imports one keyword per line, skipping blanks and in-file duplicates", () => {
    const r = parseKeywordImport("maths olympiad class 5\n\nMaths Olympiad Class 5\nimo tips\n", "lines");
    expect(r.rows.map((k) => k.keyword)).toEqual(["maths olympiad class 5", "imo tips"]);
    expect(r.duplicatesInFile).toBe(1);
    expect(r.errors).toEqual([]);
  });

  it("maps CSV columns with header aliases and loose values", () => {
    const csv = "Keyword,Class,Subject,Priority,Intent,Notes\nmaths olympiad class 5,Class 5,Mathematics,high,informational,top pick\n";
    const r = parseKeywordImport(csv, "csv");
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      keyword: "maths olympiad class 5", targetClass: 5, subject: "Mathematics",
      priority: "HIGH", searchIntent: "INFORMATIONAL", notes: "top pick", status: "ACTIVE",
    });
  });

  it("reports invalid rows with their line numbers and keeps the valid ones", () => {
    const csv = "keyword,target_class,priority\ngood one,5,LOW\nx,3,LOW\nanother good,99,LOW\n";
    const r = parseKeywordImport(csv, "csv");
    expect(r.rows.map((k) => k.keyword)).toEqual(["good one"]);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4]);
  });

  it("requires a keyword header for CSV", () => {
    const r = parseKeywordImport("term,class\nfoo,5\n", "csv");
    expect(r.rows).toEqual([]);
    expect(r.errors[0].message).toMatch(/keyword/);
  });

  it("caps the import size", () => {
    const r = parseKeywordImport(Array.from({ length: 1001 }, (_, i) => `keyword ${i}`).join("\n"), "lines");
    expect(r.rows).toEqual([]);
    expect(r.errors[0].message).toMatch(/at most 1000/);
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards in search text", () => {
    expect(escapeLike("100%_done\\")).toBe("100\\%\\_done\\\\");
  });
});
