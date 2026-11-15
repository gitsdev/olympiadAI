// Shared PGlite harness for the credit wallet tests: applies migrations 021
// and 022 to an in-memory Postgres with minimal Supabase stubs, and offers a
// tiny adapter so the app's credit service (which only needs `.rpc()`) can
// run against it for end-to-end tests.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { CreditDb } from "@/lib/credits/db";

export const ADMIN = "00000000-0000-0000-0000-0000000000a1";
export const ALICE = "00000000-0000-0000-0000-0000000000b1";
export const BOB = "00000000-0000-0000-0000-0000000000b2";
export const PARENT = "00000000-0000-0000-0000-0000000000c1";

const STUBS = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.uid', true), '')::uuid $$;
  create type user_role as enum ('student', 'parent', 'teacher', 'school_admin', 'platform_admin');
  create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null default '', full_name text not null default '',
    role user_role not null default 'student', created_at timestamptz not null default now());
  create function update_updated_at() returns trigger language plpgsql
    as $$ begin new.updated_at = now(); return new; end; $$;
`;

export const MIGRATION_021 = readFileSync(join(process.cwd(), "supabase/migrations/021_credit_wallet.sql"), "utf8");
export const MIGRATION_022 = readFileSync(join(process.cwd(), "supabase/migrations/022_credit_wallet_backfill.sql"), "utf8");

export async function createDb(opts: { preExisting?: Array<[string, string]> } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUBS);
  for (const [id, role] of opts.preExisting ?? []) {
    await db.exec(`insert into auth.users (id) values ('${id}');
      insert into profiles (id, email, full_name, role) values ('${id}', '${id}@x.test', 'User ${id.slice(-2)}', '${role}');`);
  }
  await db.exec(MIGRATION_021);
  await db.exec(`
    grant usage on schema public, auth to authenticated, service_role;
    -- Supabase grants broad table privileges; RLS + the revokes in 021 must still hold.
    grant select on all tables in schema public to authenticated;
    grant all on all tables in schema public to service_role;
  `);
  // Re-apply the revokes (the grant above re-opened what 021 revoked, the
  // way a later blanket grant could in a real project).
  await db.exec(`revoke insert, update, delete, truncate on credit_wallets, credit_transactions, credit_purchases,
    feature_credit_costs, credit_admins, credit_webhook_events from authenticated;
    revoke all on credit_webhook_events from authenticated;`);
  return db;
}

/** Creates an auth user + profile (fires the welcome-credit trigger like signup does). */
export async function signUp(db: PGlite, id: string, role = "student"): Promise<void> {
  await db.exec(`insert into auth.users (id) values ('${id}');
    insert into profiles (id, email, full_name, role) values ('${id}', '${id}@x.test', 'User ${id.slice(-2)}', '${role}');`);
}

export async function asUser<T>(db: PGlite, uid: string, sql: string): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.uid', '${uid}', false);`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec("reset role; select set_config('request.jwt.uid', '', false);");
  }
}

export async function balanceOf(db: PGlite, uid: string): Promise<number> {
  const { rows } = await db.query<{ balance: string | number }>(
    `select coalesce((select balance from credit_wallets where user_id = $1), 0) as balance`, [uid]);
  return Number(rows[0].balance);
}

export async function ledgerSum(db: PGlite, uid: string): Promise<number> {
  const { rows } = await db.query<{ s: string | number }>(
    `select coalesce(sum(amount), 0) as s from credit_transactions where user_id = $1`, [uid]);
  return Number(rows[0].s);
}

export async function setPrice(db: PGlite, key: string, cost: number | null, enabled: boolean): Promise<void> {
  await db.query(`update feature_credit_costs set credit_cost = $2, is_enabled = $3 where feature_key = $1`, [key, cost, enabled]);
}

/**
 * Adapter: lets the app's credit service call Postgres functions in PGlite
 * through the same `.rpc(name, params)` shape supabase-js exposes.
 */
export function pgliteCreditDb(db: PGlite): CreditDb {
  return {
    async rpc(fn: string, params: Record<string, unknown> = {}) {
      const keys = Object.keys(params);
      const args = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
      try {
        const res = await db.query<Record<string, unknown>>(
          `select * from ${fn}(${args})`,
          keys.map((k) => {
            const v = params[k];
            return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
          }),
        );
        // Scalar functions come back as one column named after the function.
        if (res.rows.length === 1 && res.fields.length === 1 && res.fields[0].name === fn) {
          return { data: res.rows[0][fn], error: null };
        }
        return { data: res.rows, error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    },
  };
}
