// Applies supabase/migrations/019_question_paper_solver.sql to an in-memory
// Postgres (PGlite) and checks constraints and RLS for real. Supabase
// internals are replaced by minimal stubs (same approach as the SEO Agent).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { mergeChunks } from "@/lib/question-paper/extract";
import { PUBLIC_JOB_COLUMNS, PUBLIC_QUESTION_COLUMNS } from "@/lib/question-paper/types";

const ADMIN = "00000000-0000-0000-0000-000000000001";
const ALICE = "00000000-0000-0000-0000-000000000002";
const BOB = "00000000-0000-0000-0000-000000000003";

const STUBS = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.uid', true), '')::uuid $$;
  create type user_role as enum ('student', 'platform_admin');
  create table profiles (id uuid primary key, role user_role not null default 'student');
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
`;

const migration = readFileSync(join(process.cwd(), "supabase/migrations/019_question_paper_solver.sql"), "utf8");
let db: PGlite;

async function asUser<T>(uid: string, sql: string): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.uid', '${uid}', false);`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec("reset role; select set_config('request.jwt.uid', '', false);");
  }
}

function jobSql(id: string, userId: string, status = "completed") {
  return `insert into qps_jobs (id, user_id, file_name, file_ext, mime_type, file_size, storage_path, status, completed_at)
    values ('${id}', '${userId}', 'paper.pdf', 'pdf', 'application/pdf', 1000, '${userId}/${id}/source.pdf', '${status}',
            ${status === "completed" ? "now()" : "null"})`;
}

const JOB_A = "10000000-0000-0000-0000-00000000000a";
const JOB_B = "10000000-0000-0000-0000-00000000000b";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(`
    insert into auth.users (id) values ('${ADMIN}'), ('${ALICE}'), ('${BOB}');
    insert into profiles (id, role) values ('${ADMIN}', 'platform_admin'), ('${ALICE}', 'student'), ('${BOB}', 'student');
  `);
  await db.exec(migration);
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    -- Supabase grants table privileges broadly; RLS must still block writes.
    grant select, insert, update, delete on all tables in schema public to authenticated;
  `);
  await db.exec(jobSql(JOB_A, ALICE));
  await db.exec(jobSql(JOB_B, BOB));
  await db.exec(`
    insert into qps_questions (job_id, user_id, order_index, number_label, question_md)
    values ('${JOB_A}', '${ALICE}', 0, '1', 'What is 2+2?'), ('${JOB_B}', '${BOB}', 0, '1', 'Name a planet.');
  `);
}, 60_000);

describe("migration 019", () => {
  it("is idempotent (safe to re-run in the SQL editor)", async () => {
    await expect(db.exec(migration)).resolves.toBeDefined();
  });

  it("enables RLS on every qps_ table", async () => {
    const { rows } = await db.query("select relname from pg_class where relname like 'qps_%' and relkind = 'r' and not relrowsecurity");
    expect(rows).toEqual([]);
  });

  it("creates a private bucket with size and MIME limits", async () => {
    const { rows } = await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'question-papers'",
    );
    expect(rows[0].public).toBe(false);
    expect(Number(rows[0].file_size_limit)).toBe(15 * 1024 * 1024);
    expect(rows[0].allowed_mime_types).toContain("application/pdf");
    expect(rows[0].allowed_mime_types).not.toContain("application/vnd.ms-word.document.macroEnabled.12");
  });
});

describe("schema matches the code", () => {
  async function columns(table: string): Promise<Set<string>> {
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = '${table}'`,
    );
    return new Set(rows.map((r) => r.column_name));
  }

  it("has every column the API selects", async () => {
    const jobCols = await columns("qps_jobs");
    const qCols = await columns("qps_questions");
    const missing = [
      ...PUBLIC_JOB_COLUMNS.split(",").map((c) => c.trim()).filter((c) => !jobCols.has(c)).map((c) => `qps_jobs.${c}`),
      ...PUBLIC_QUESTION_COLUMNS.split(",").map((c) => c.trim()).filter((c) => !qCols.has(c)).map((c) => `qps_questions.${c}`),
    ];
    expect(missing).toEqual([]);
  });

  it("accepts a question row exactly as the worker builds it", async () => {
    const [row] = mergeChunks([{
      pageOffset: 1,
      result: {
        paper: { title: null, detected_class: null, detected_board: null, detected_subject: null, detected_exam_type: null },
        question_index: [{ label: "1", page: 1 }],
        questions: [{
          label: "1", section: "Section A", type: "comprehension", context_md: "Read the passage…", text_md: "Who is the hero?",
          options: [{ label: "A", text: "Ravi" }], match_left: [], match_right: [], has_diagram: false, diagram_description: null,
          image_refs: [], pages: [1], marks: 1, confidence: "high", issues: [],
          continues_on_next_page: false, continued_from_previous_page: false,
        }],
        unreadable_regions: [],
      },
    }]);
    const full = { ...row, job_id: JOB_A, user_id: ALICE, order_index: 50 };
    const cols = Object.keys(full);
    const vals = cols.map((_, i) => `$${i + 1}`).join(", ");
    const params = cols.map((c) => {
      const v = (full as Record<string, unknown>)[c];
      return v !== null && typeof v === "object" && !Array.isArray(v) || (Array.isArray(v) && v.some((x) => typeof x === "object")) ? JSON.stringify(v) : v;
    });
    await expect(db.query(`insert into qps_questions (${cols.join(", ")}) values (${vals})`, params)).resolves.toBeDefined();
    await db.exec(`delete from qps_questions where order_index = 50`);
  });

  it("adds context_md to a table created by an earlier draft without it", async () => {
    await db.exec("alter table qps_questions drop column context_md");
    await db.exec(migration);
    expect((await columns("qps_questions")).has("context_md")).toBe(true);
  });
});

describe("constraints", () => {
  it("rejects unsupported file formats and oversized files", async () => {
    await expect(db.exec(`insert into qps_jobs (user_id, file_name, file_ext, mime_type, file_size, storage_path)
      values ('${ALICE}', 'x.docm', 'docm', 'x', 10, 'p')`)).rejects.toThrow(/check constraint/);
    await expect(db.exec(`insert into qps_jobs (user_id, file_name, file_ext, mime_type, file_size, storage_path)
      values ('${ALICE}', 'x.pdf', 'pdf', 'application/pdf', 20000000, 'p')`)).rejects.toThrow(/check constraint/);
  });

  it("allows only one active job per user", async () => {
    await db.exec(jobSql("20000000-0000-0000-0000-000000000001", ALICE, "solving"));
    await expect(db.exec(jobSql("20000000-0000-0000-0000-000000000002", ALICE, "queued"))).rejects.toThrow(/qps_jobs_one_active_per_user/);
    // Another user is unaffected.
    await expect(db.exec(jobSql("20000000-0000-0000-0000-000000000003", BOB, "queued"))).resolves.toBeDefined();
    await db.exec("delete from qps_jobs where id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003')");
  });

  it("cannot mark a job completed without completed_at", async () => {
    await expect(db.exec(`update qps_jobs set completed_at = null where id = '${JOB_A}'`)).rejects.toThrow(/qps_jobs_completed_has_timestamp/);
  });

  it("keeps question order unique within a job", async () => {
    await expect(db.exec(`insert into qps_questions (job_id, user_id, order_index, number_label)
      values ('${JOB_A}', '${ALICE}', 0, '1 again')`)).rejects.toThrow(/duplicate key/);
  });
});

describe("row level security", () => {
  it("users see only their own jobs and questions", async () => {
    const jobs = await asUser<{ id: string }>(ALICE, "select id from qps_jobs");
    expect(jobs.map((j) => j.id)).toEqual([JOB_A]);
    const qs = await asUser<{ question_md: string }>(ALICE, "select question_md from qps_questions");
    expect(qs.map((q) => q.question_md)).toEqual(["What is 2+2?"]);
  });

  it("users cannot read another user's job even by id", async () => {
    expect(await asUser(ALICE, `select id from qps_jobs where id = '${JOB_B}'`)).toEqual([]);
  });

  it("admins can read every job", async () => {
    const jobs = await asUser<{ id: string }>(ADMIN, "select id from qps_jobs order by id");
    expect(jobs.map((j) => j.id)).toEqual([JOB_A, JOB_B]);
  });

  it("the migration revokes direct write privileges", async () => {
    await db.exec(migration); // re-applies the REVOKE after the broad grant above
    await expect(asUser(ALICE, `update qps_jobs set status = 'queued' where id = '${JOB_A}'`)).rejects.toThrow(/permission denied/);
  });

  it("users cannot write directly even if privileges are re-granted (RLS backstop)", async () => {
    await db.exec("grant select, insert, update, delete on all tables in schema public to authenticated");
    // RLS with no write policies: UPDATE/DELETE silently affect 0 rows, INSERT errors.
    await asUser(ALICE, `update qps_jobs set status = 'queued' where id = '${JOB_A}'`);
    await asUser(ALICE, `delete from qps_questions where job_id = '${JOB_A}'`);
    const { rows } = await db.query<{ status: string }>(`select status from qps_jobs where id = '${JOB_A}'`);
    expect(rows[0].status).toBe("completed");
    expect((await db.query(`select 1 from qps_questions where job_id = '${JOB_A}'`)).rows).toHaveLength(1);
    await expect(asUser(ALICE, `insert into qps_usage (user_id, kind) values ('${ALICE}', 'regenerate_answer')`)).rejects.toThrow(/row-level security/);
  });

  it("internal logs are admin-only", async () => {
    await db.exec(`insert into qps_job_logs (job_id, level, event) values ('${JOB_A}', 'error', 'test')`);
    expect(await asUser(ALICE, "select * from qps_job_logs")).toEqual([]);
    expect(await asUser(ADMIN, "select event from qps_job_logs")).toEqual([{ event: "test" }]);
  });
});
