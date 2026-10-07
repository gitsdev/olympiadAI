import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeUsage, formatUsd } from "@/lib/seo-agent/usage";
import { redact, errorMessage } from "@/lib/seo-agent/logger";
import { isMissingSchemaError, throwIfDbError, SeoSchemaMissingError } from "@/lib/seo-agent/db";
import {
  AGENT_TASK_STATUSES, ARTICLE_STATUSES, BLOG_CATEGORIES, CONTENT_PLAN_STATUSES, CTA_TYPES, KEYWORD_STATUSES,
  STATUS_TONES, humanizeStatus,
} from "@/lib/seo-agent/constants";
import { SEO_NAV } from "@/components/seo-agent/nav";

describe("summarizeUsage", () => {
  it("sums priced calls and counts unpriced ones separately", () => {
    const s = summarizeUsage([
      { category: "CONTENT", estimated_cost: "0.120000", input_tokens: 1000, output_tokens: 2000 },
      { category: "SEO", estimated_cost: 0.03, input_tokens: 500, output_tokens: 100 },
      { category: "CONTENT", estimated_cost: null, input_tokens: 10, output_tokens: 10 },
      { category: "WEIRD", estimated_cost: 0.01, input_tokens: 0, output_tokens: 0 },
    ]);
    expect(s.calls).toBe(4);
    expect(s.unpricedCalls).toBe(1);
    expect(s.cost).toBeCloseTo(0.16);
    expect(s.tokens).toBe(3620);
    expect(s.byCategory.CONTENT).toBeCloseTo(0.12);
    expect(s.byCategory.OTHER).toBeCloseTo(0.01);
  });

  it("formats small amounts with extra precision", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(1.234)).toBe("$1.23");
    expect(formatUsd(0.0042)).toBe("$0.0042");
  });
});

describe("logger redaction", () => {
  it("redacts secret-looking keys at any depth", () => {
    const out = redact({ apiKey: "sk-1", nested: { CRON_SECRET: "x", authorization: "Bearer y", ok: 1 }, list: [{ token: "t" }] });
    expect(out).toEqual({ apiKey: "[REDACTED]", nested: { CRON_SECRET: "[REDACTED]", authorization: "[REDACTED]", ok: 1 }, list: [{ token: "[REDACTED]" }] });
  });

  it("extracts messages from errors and error-like objects", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage({ message: "pg failed" })).toBe("pg failed");
  });
});

describe("db error handling", () => {
  it("recognises a missing migration", () => {
    expect(isMissingSchemaError({ code: "PGRST205" })).toBe(true);
    expect(isMissingSchemaError({ code: "42P01" })).toBe(true);
    expect(isMissingSchemaError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(() => throwIfDbError({ code: "PGRST205" }, "x")).toThrow(SeoSchemaMissingError);
    expect(() => throwIfDbError({ code: "23505", message: "dup" }, "Saving")).toThrow("Saving: dup");
    expect(() => throwIfDbError(null, "x")).not.toThrow();
  });
});

describe("constants stay in sync with migration 013", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/013_seo_agent.sql"), "utf8");

  /** Values in the first `<column> ... check (<column> in (...))` for a table. */
  function checkValues(table: string, column: string): string[] {
    const tableSql = sql.slice(sql.indexOf(`create table if not exists ${table} (`));
    const m = new RegExp(`check \\(${column} in \\(([^)]*)\\)`, "s").exec(tableSql);
    if (!m) throw new Error(`No CHECK for ${table}.${column}`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }

  it.each([
    ["seo_keywords", "status", KEYWORD_STATUSES],
    ["seo_content_plans", "status", CONTENT_PLAN_STATUSES],
    ["seo_articles", "status", ARTICLE_STATUSES],
    ["seo_agent_tasks", "status", AGENT_TASK_STATUSES],
    ["seo_articles", "cta_type", CTA_TYPES],
  ] as const)("%s.%s", (table, column, values) => {
    expect(checkValues(table, column)).toEqual([...values]);
  });

  it("blog categories match blog_posts", () => {
    const blogSql = readFileSync(join(process.cwd(), "supabase/migrations/003_blog_posts.sql"), "utf8");
    for (const c of BLOG_CATEGORIES) expect(blogSql).toContain(`'${c}'`);
  });

  it("enables RLS on every seo_ table", () => {
    const tables = [...sql.matchAll(/create table if not exists (seo_\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBe(19); // 18 spec tables (profiles reused) + seo_job_locks
    for (const t of tables) {
      expect(sql.includes(`'${t}'`) || sql.includes(`alter table ${t} enable row level security`)).toBe(true);
    }
  });

  it("every article/task status has a badge tone", () => {
    for (const s of [...ARTICLE_STATUSES, ...CONTENT_PLAN_STATUSES, ...AGENT_TASK_STATUSES, ...KEYWORD_STATUSES]) {
      expect(STATUS_TONES[s], s).toBeDefined();
    }
    expect(humanizeStatus("REVIEW_REQUIRED")).toBe("Review required");
  });
});

describe("navigation", () => {
  it("keeps every item under /admin/seo-agent with unique hrefs", () => {
    const items = SEO_NAV.flatMap((g) => g.items);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
    for (const i of items) expect(i.href.startsWith("/admin/seo-agent/")).toBe(true);
  });
});
