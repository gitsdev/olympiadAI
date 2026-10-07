// Applies supabase/migrations/013_seo_agent.sql to an in-memory Postgres
// (PGlite) and checks constraints, RLS and the cron lock functions for real.
// Earlier migrations and Supabase internals are replaced by minimal stubs.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const ADMIN = "00000000-0000-0000-0000-000000000001";
const STUDENT = "00000000-0000-0000-0000-000000000002";

const STUBS = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.uid', true), '')::uuid $$;
  create type user_role as enum ('student', 'platform_admin');
  create table profiles (id uuid primary key, role user_role not null default 'student');
  create table blog_posts (id uuid primary key default gen_random_uuid());
  create function update_updated_at() returns trigger language plpgsql
    as $$ begin new.updated_at = now(); return new; end; $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
`;

const migration = readFileSync(join(process.cwd(), "supabase/migrations/013_seo_agent.sql"), "utf8");
const overviewView = readFileSync(join(process.cwd(), "supabase/migrations/014_seo_keywords_overview.sql"), "utf8");
const claudeSwitch = readFileSync(join(process.cwd(), "supabase/migrations/015_seo_agent_claude.sql"), "utf8");
const imagesBucket = readFileSync(join(process.cwd(), "supabase/migrations/016_seo_agent_images.sql"), "utf8");
let db: PGlite;

/** Runs `sql` as the `authenticated` role with auth.uid() = uid (like a Supabase session). */
async function asUser<T>(uid: string, sql: string): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.uid', '${uid}', false);`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec("reset role; select set_config('request.jwt.uid', '', false);");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(migration);
  await db.exec(overviewView);
  await db.exec(`
    insert into profiles (id, role) values ('${ADMIN}', 'platform_admin'), ('${STUDENT}', 'student');
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select on seo_keywords_overview to authenticated;
  `);
}, 60_000);

describe("migration 013", () => {
  it("is idempotent (safe to re-run in the SQL editor)", async () => {
    await expect(db.exec(migration)).resolves.toBeDefined();
  });

  it("seeds spec default settings", async () => {
    const [row] = (await db.query<{ publishing_mode: string; default_publish_time: string; timezone: string; backlink_check_frequency: string }>(
      "select publishing_mode, default_publish_time, timezone, backlink_check_frequency from seo_settings",
    )).rows;
    expect(row).toEqual({ publishing_mode: "MANUAL_APPROVAL", default_publish_time: "10:00:00", timezone: "Asia/Kolkata", backlink_check_frequency: "WEEKLY" });
  });

  it("enables RLS on every seo_ table", async () => {
    const { rows } = await db.query("select relname from pg_class where relname like 'seo_%' and relkind = 'r' and not relrowsecurity");
    expect(rows).toEqual([]);
  });
});

describe("keyword constraints", () => {
  it("de-duplicates keywords ignoring case and extra spaces", async () => {
    await db.exec("insert into seo_keywords (keyword) values ('Maths  Olympiad Class 5')");
    const { rows } = await db.query<{ keyword_normalized: string }>("select keyword_normalized from seo_keywords");
    expect(rows[0].keyword_normalized).toBe("maths olympiad class 5");
    await expect(db.exec("insert into seo_keywords (keyword) values ('maths olympiad class 5 ')")).rejects.toThrow(/uq_seo_keywords_normalized/);
  });

  it("rejects unknown statuses", async () => {
    await expect(db.exec("insert into seo_keywords (keyword, status) values ('abc', 'DONE')")).rejects.toThrow(/check constraint/);
  });
});

describe("article approval guarantees", () => {
  it.each([
    ["APPROVED under manual mode without approver", "insert into seo_articles (title, status, publish_authorization) values ('a', 'APPROVED', 'MANUAL_APPROVAL')"],
    ["PUBLISHED with no authorization at all", "insert into seo_articles (title, status, published_at) values ('a', 'PUBLISHED', now())"],
    ["SCHEDULED with no authorization at all", "insert into seo_articles (title, status, scheduled_for) values ('a', 'SCHEDULED', now())"],
    ["SCHEDULED without a time", "insert into seo_articles (title, status, publish_authorization) values ('a', 'SCHEDULED', 'AUTO_PUBLISH')"],
    ["PUBLISHED without published_at", "insert into seo_articles (title, status, publish_authorization) values ('a', 'PUBLISHED', 'AUTO_PUBLISH')"],
  ])("blocks %s", async (_label, sql) => {
    await expect(db.exec(sql)).rejects.toThrow(/check constraint/);
  });

  it("allows an approved, scheduled article", async () => {
    await db.exec(`insert into seo_articles (title, slug, status, publish_authorization, approved_by, approved_at, scheduled_for)
      values ('Class 5 guide', 'class-5-guide', 'SCHEDULED', 'MANUAL_APPROVAL', '${ADMIN}', now(), now() + interval '1 day')`);
  });

  it("keeps live slugs unique but frees archived ones", async () => {
    await expect(db.exec("insert into seo_articles (title, slug) values ('dup', 'class-5-guide')")).rejects.toThrow(/uq_seo_articles_slug/);
    await db.exec("insert into seo_articles (title, slug, status) values ('old', 'archived-slug', 'ARCHIVED')");
    await db.exec("insert into seo_articles (title, slug) values ('new', 'archived-slug')");
  });

  it("does not let a task claim COMPLETED without finishing", async () => {
    await expect(db.exec("insert into seo_agent_tasks (agent_type, task_type, status) values ('X', 'y', 'COMPLETED')")).rejects.toThrow(/completed_has_time/);
  });

  it("does not let outreach be SENT without approval", async () => {
    await db.exec(`
      insert into seo_backlink_prospects (website, url) values ('a', 'https://a.example');
      insert into seo_outreach_campaigns (prospect_id, name) select id, 'c' from seo_backlink_prospects;
    `);
    await expect(db.exec("insert into seo_outreach_messages (campaign_id, subject, body, status) select id, 's', 'b', 'SENT' from seo_outreach_campaigns"))
      .rejects.toThrow(/sent_requires_approval/);
  });
});

describe("RLS", () => {
  it("lets platform admins read, and hides everything from other users", async () => {
    expect((await asUser<{ n: number }>(ADMIN, "select count(*)::int n from seo_keywords"))[0].n).toBe(1);
    expect((await asUser<{ n: number }>(STUDENT, "select count(*)::int n from seo_keywords"))[0].n).toBe(0);
    expect((await asUser<{ n: number }>(STUDENT, "select count(*)::int n from seo_settings"))[0].n).toBe(0);
  });

  it("blocks writes from non-admins", async () => {
    await expect(asUser(STUDENT, "insert into seo_keywords (keyword) values ('sneaky')")).rejects.toThrow(/row-level security/);
    expect(await asUser(STUDENT, "update seo_settings set publishing_mode = 'AUTO_PUBLISH' returning id")).toEqual([]);
  });

  it("lets admins update settings but not create a second settings row", async () => {
    expect(await asUser(ADMIN, "update seo_settings set ai_model = 'm2' where id = 1 returning ai_model")).toEqual([{ ai_model: "m2" }]);
    await expect(asUser(ADMIN, "insert into seo_settings (id) values (1) on conflict do nothing")).rejects.toThrow(/row-level security/);
  });

  it("keeps cron locks service-role only", async () => {
    await expect(asUser(ADMIN, "select seo_try_acquire_lock('x', 1, 'y')")).rejects.toThrow(/permission denied/);
  });
});

describe("cron job lock", () => {
  const acquire = async (owner: string) =>
    (await db.query<{ ok: boolean }>("select seo_try_acquire_lock('daily', 60, $1) ok", [owner])).rows[0].ok;

  it("allows only one holder until released or expired", async () => {
    expect(await acquire("run-a")).toBe(true);
    expect(await acquire("run-b")).toBe(false);
    await db.query("select seo_release_lock('daily', 'run-b')"); // wrong owner: no effect
    expect(await acquire("run-b")).toBe(false);
    await db.query("select seo_release_lock('daily', 'run-a')");
    expect(await acquire("run-b")).toBe(true);
    await db.exec("update seo_job_locks set locked_until = now() - interval '1 second'");
    expect(await acquire("run-c")).toBe(true);
  });
});

describe("migration 014 + keyword import", () => {
  it("is idempotent", async () => {
    await expect(db.exec(overviewView)).resolves.toBeDefined();
  });

  it("matches the app's normalizeKeyword() for cleaned input", async () => {
    const { cleanKeyword, normalizeKeyword } = await import("@/lib/seo-agent/keywords");
    for (const raw of ["  NSO\tClass  6 \n", "IMO  Level-2 Prep", "Ünïcödé  Maths"]) {
      const cleaned = cleanKeyword(raw);
      const { rows } = await db.query<{ n: string }>("insert into seo_keywords (keyword) values ($1) returning keyword_normalized n", [cleaned]);
      expect(rows[0].n).toBe(normalizeKeyword(raw));
    }
  });

  it("supports ON CONFLICT (keyword_normalized) DO NOTHING for bulk import", async () => {
    const { rows } = await db.query<{ id: string }>(
      "insert into seo_keywords (keyword) values ('maths olympiad CLASS 5'), ('brand new keyword') on conflict (keyword_normalized) do nothing returning id",
    );
    expect(rows).toHaveLength(1);
  });

  it("lists active cluster memberships and filters on is_clustered", async () => {
    await db.exec(`
      insert into seo_keyword_clusters (id, name, primary_keyword) values
        ('10000000-0000-0000-0000-000000000001', 'Class 5 Maths', 'maths olympiad class 5'),
        ('10000000-0000-0000-0000-000000000002', 'Old', 'x');
      update seo_keyword_clusters set status = 'ARCHIVED' where name = 'Old';
      insert into seo_keyword_cluster_members (cluster_id, keyword_id, role)
        select '10000000-0000-0000-0000-000000000001', id, 'PRIMARY' from seo_keywords where keyword_normalized = 'maths olympiad class 5';
      insert into seo_keyword_cluster_members (cluster_id, keyword_id, role)
        select '10000000-0000-0000-0000-000000000002', id, 'SECONDARY' from seo_keywords where keyword_normalized = 'brand new keyword';
    `);
    const rows = await asUser<{ keyword_normalized: string; is_clustered: boolean; clusters: { name: string; role: string }[] }>(
      ADMIN, "select keyword_normalized, is_clustered, clusters from seo_keywords_overview where keyword_normalized in ('maths olympiad class 5', 'brand new keyword') order by 1 desc",
    );
    expect(rows).toEqual([
      { keyword_normalized: "maths olympiad class 5", is_clustered: true, clusters: [{ id: "10000000-0000-0000-0000-000000000001", name: "Class 5 Maths", role: "PRIMARY" }] },
      // Membership of an archived cluster doesn't count.
      { keyword_normalized: "brand new keyword", is_clustered: false, clusters: [] },
    ]);
  });

  it("respects RLS through the view (security_invoker)", async () => {
    expect((await asUser<{ n: number }>(STUDENT, "select count(*)::int n from seo_keywords_overview"))[0].n).toBe(0);
    expect((await asUser<{ n: number }>(ADMIN, "select count(*)::int n from seo_keywords_overview"))[0].n).toBeGreaterThan(0);
  });
});

describe("migration 015 (Claude provider)", () => {
  it("moves settings from OpenAI to Claude Opus 5.5 and seeds its price", async () => {
    await db.exec("update seo_settings set ai_model = 'gpt-4o-mini', ai_pricing = '{\"gpt-4o-mini\": {\"input\": 1, \"output\": 2}}'");
    await db.exec(claudeSwitch);
    const { rows } = await db.query<{ ai_provider: string; ai_model: string; ai_pricing: Record<string, unknown> }>("select ai_provider, ai_model, ai_pricing from seo_settings");
    expect(rows[0]).toEqual({
      ai_provider: "anthropic",
      ai_model: "claude-opus-5-5",
      ai_pricing: { "gpt-4o-mini": { input: 1, output: 2 }, "claude-opus-5-5": { input: 4, output: 20 } },
    });
  });

  it("is idempotent and keeps an admin-edited price", async () => {
    await db.exec(`update seo_settings set ai_pricing = '{"claude-opus-5-5": {"input": 9, "output": 9}}'`);
    await db.exec(claudeSwitch);
    const { rows } = await db.query<{ ai_pricing: unknown }>("select ai_pricing from seo_settings");
    expect(rows[0].ai_pricing).toEqual({ "claude-opus-5-5": { input: 9, output: 9 } });
  });

  it("rejects OpenAI as a provider from now on", async () => {
    await expect(db.exec("update seo_settings set ai_provider = 'openai'")).rejects.toThrow(/ai_provider_check/);
  });

  it("matches the app's settings defaults", async () => {
    const { DEFAULT_SEO_SETTINGS } = await import("@/lib/seo-agent/settings-schema");
    const { rows } = await db.query<{ p: string; m: string }>(
      "select column_default p, (select column_default from information_schema.columns where table_name = 'seo_settings' and column_name = 'ai_model') m from information_schema.columns where table_name = 'seo_settings' and column_name = 'ai_provider'",
    );
    expect(rows[0].p).toContain(DEFAULT_SEO_SETTINGS.aiProvider);
    expect(rows[0].m).toContain(DEFAULT_SEO_SETTINGS.aiModel);
  });
});

describe("migration 016 (featured-image bucket)", () => {
  it("creates a public, size- and type-limited bucket, idempotently", async () => {
    await db.exec(imagesBucket);
    await db.exec(imagesBucket);
    const { rows } = await db.query("select id, public, file_size_limit, allowed_mime_types from storage.buckets");
    expect(rows).toEqual([{ id: "blog-images", public: true, file_size_limit: 5242880, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] }]);
  });
});

describe("publishing guarantees in the database (scheduling + approval)", () => {
  it("lets a manually approved article be scheduled and published, but not unapproved ones", async () => {
    await db.exec(`insert into seo_articles (id, title, status) values ('20000000-0000-0000-0000-000000000001', 'Pub test', 'DRAFT')`);
    // Scheduling without approval is impossible even if application code had a bug.
    await expect(db.exec(`update seo_articles set status = 'SCHEDULED', scheduled_for = now() + interval '1 day', publish_authorization = 'MANUAL_APPROVAL'
      where id = '20000000-0000-0000-0000-000000000001'`)).rejects.toThrow(/requires_approval/);
    await db.exec(`update seo_articles set status = 'APPROVED', publish_authorization = 'MANUAL_APPROVAL', approved_by = '${ADMIN}', approved_at = now()
      where id = '20000000-0000-0000-0000-000000000001'`);
    await db.exec(`update seo_articles set status = 'SCHEDULED', scheduled_for = now() + interval '1 day' where id = '20000000-0000-0000-0000-000000000001'`);
    await db.exec(`update seo_articles set status = 'PUBLISHED', published_at = now() where id = '20000000-0000-0000-0000-000000000001'`);
    // Withdrawing approval on a live article without moving it out of PUBLISHED is blocked.
    await expect(db.exec(`update seo_articles set approved_at = null, approved_by = null where id = '20000000-0000-0000-0000-000000000001'`))
      .rejects.toThrow(/requires_approval/);
  });
});
