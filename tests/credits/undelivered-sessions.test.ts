// Migration 025 + the undelivered-session refund: a Practice / Mock Test
// charge whose questions never arrived is refunded (once), while delivered,
// recent, already-refunded and untracked charges are left alone.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ALICE, BOB, asUser, balanceOf, createDb, pgliteCreditDb, setPrice, signUp } from "./helpers";

const holder = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/credits/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/credits/db")>()),
  creditDb: () => pgliteCreditDb(holder.db as PGlite),
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => { throw new Error("not used in these tests"); } }));

const {
  chargeFeatureStart, refundFailedStart, markSessionDelivered, refundUndeliveredSessions, DELIVERY_TRACKED,
} = await import("@/lib/credits/feature");

const MIGRATION_025 = readFileSync(join(process.cwd(), "supabase/migrations/025_credit_session_deliveries.sql"), "utf8");

let db: PGlite;
let n = 0;

beforeAll(async () => {
  db = await createDb();
  holder.db = db;
  await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/024_credit_practice_pricing.sql"), "utf8"));
  await db.exec(MIGRATION_025);
  await db.exec(MIGRATION_025); // re-runnable
  await signUp(db, ALICE);
  await signUp(db, BOB);
  // Plenty of credits for every charge below (welcome credits are only 25).
  for (const u of [ALICE, BOB]) {
    await db.query("select * from credit_apply($1, 'admin_adjustment', 500, $2, null, null, 'test top-up', '{}')", [u, `topup:${u}`]);
  }
  // Tests back-date charges; pretend tracking began long before them.
  await db.exec("update credit_session_tracking set started_at = now() - interval '30 days'");
}, 60_000); // PGlite start-up is slow when the whole suite runs in parallel

beforeEach(async () => {
  await setPrice(db, "practice", 5, true);
});

/** Charges a 5-credit practice session; returns its usage transaction id. */
async function charge(userId: string, tracked = true): Promise<string> {
  const r = await chargeFeatureStart({
    userId, featureKey: "practice", sessionKey: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    metadata: tracked ? { ...DELIVERY_TRACKED } : {},
  });
  if (!r.ok || !r.transactionId) throw new Error(`charge failed: ${JSON.stringify(r)}`);
  return r.transactionId;
}

/** Back-dates a ledger row (the ledger is append-only, so lift the guard briefly). */
async function age(txId: string, minutes: number) {
  await db.exec(`alter table credit_transactions disable trigger user;
    update credit_transactions set created_at = now() - interval '${minutes} minutes' where id = '${txId}';
    alter table credit_transactions enable trigger user;`);
}

describe("undelivered Practice / Mock Test sessions", () => {
  it("refunds a tracked charge with no delivery after 5 minutes — exactly once", async () => {
    const before = await balanceOf(db, ALICE);
    const tx = await charge(ALICE);
    await age(tx, 10);
    expect(await balanceOf(db, ALICE)).toBe(before - 5);

    expect(await refundUndeliveredSessions({ userId: ALICE })).toEqual({ found: 1, refunded: 1, failed: 0 });
    expect(await balanceOf(db, ALICE)).toBe(before);
    expect(await refundUndeliveredSessions()).toEqual({ found: 0, refunded: 0, failed: 0 });
    expect(await balanceOf(db, ALICE)).toBe(before);
  });

  it("leaves delivered sessions alone", async () => {
    const before = await balanceOf(db, ALICE);
    const tx = await charge(ALICE);
    expect(await markSessionDelivered({ userId: ALICE, transactionId: tx })).toBe(true);
    expect(await markSessionDelivered({ userId: ALICE, transactionId: tx })).toBe(true); // idempotent
    await age(tx, 10);
    expect((await refundUndeliveredSessions()).found).toBe(0);
    expect(await balanceOf(db, ALICE)).toBe(before - 5);
  });

  it("waits at least 5 minutes, so a session still generating isn't refunded", async () => {
    const tx = await charge(ALICE);
    await age(tx, 2);
    expect((await refundUndeliveredSessions({ userId: ALICE, minAgeMinutes: 0 })).found).toBe(0);
    await markSessionDelivered({ userId: ALICE, transactionId: tx });
  });

  it("does not refund twice when generation already failed and refunded", async () => {
    const before = await balanceOf(db, ALICE);
    const tx = await charge(ALICE);
    await refundFailedStart({ userId: ALICE, transactionId: tx, reason: "question generation failed" });
    await age(tx, 10);
    expect((await refundUndeliveredSessions()).found).toBe(0);
    expect(await balanceOf(db, ALICE)).toBe(before);
  });

  it("ignores untracked charges (made before 025, or by other features)", async () => {
    const before = await balanceOf(db, ALICE);
    const tx = await charge(ALICE, false);
    await age(tx, 10);
    expect((await refundUndeliveredSessions()).found).toBe(0);
    expect(await balanceOf(db, ALICE)).toBe(before - 5);
  });

  it("ignores charges older than the sweep window", async () => {
    const tx = await charge(ALICE);
    await age(tx, 73 * 60);
    expect((await refundUndeliveredSessions({ maxAgeHours: 72 })).found).toBe(0);
    await markSessionDelivered({ userId: ALICE, transactionId: tx });
  });

  it("a per-student sweep only touches that student", async () => {
    const bobBefore = await balanceOf(db, BOB);
    const tx = await charge(BOB);
    await age(tx, 10);
    expect((await refundUndeliveredSessions({ userId: ALICE })).found).toBe(0);
    expect(await balanceOf(db, BOB)).toBe(bobBefore - 5);
    expect(await refundUndeliveredSessions({ userId: BOB })).toEqual({ found: 1, refunded: 1, failed: 0 });
    expect(await balanceOf(db, BOB)).toBe(bobBefore);
  });

  it("can't mark another student's charge as delivered", async () => {
    const tx = await charge(BOB);
    expect(await markSessionDelivered({ userId: ALICE, transactionId: tx })).toBe(false);
    await age(tx, 10);
    expect((await refundUndeliveredSessions({ userId: BOB })).refunded).toBe(1);
  });

  it("ignores charges made before delivery recording began (migration applied after deploy)", async () => {
    const tx = await charge(ALICE);
    await age(tx, 10);
    await db.exec("update credit_session_tracking set started_at = now() - interval '5 minutes'");
    try {
      expect((await refundUndeliveredSessions()).found).toBe(0);
    } finally {
      await db.exec("update credit_session_tracking set started_at = now() - interval '30 days'");
      await markSessionDelivered({ userId: ALICE, transactionId: tx });
    }
  });

  it("re-running 025 keeps the original tracking start time", async () => {
    const before = (await db.query<{ s: string }>("select started_at::text as s from credit_session_tracking")).rows;
    await db.exec(MIGRATION_025);
    expect((await db.query<{ s: string }>("select started_at::text as s from credit_session_tracking")).rows).toEqual(before);
  });

  it("students can't read or write deliveries, or call the functions", async () => {
    const tx = await charge(ALICE);
    await markSessionDelivered({ userId: ALICE, transactionId: tx });
    expect(await asUser(db, ALICE, "select * from credit_session_deliveries").catch(() => [])).toEqual([]);
    expect(await asUser(db, ALICE, "select * from credit_session_tracking").catch(() => [])).toEqual([]);
    await expect(asUser(db, ALICE, `insert into credit_session_deliveries (usage_transaction_id) values ('${tx}')`)).rejects.toThrow();
    await expect(asUser(db, ALICE, `select credit_mark_session_delivered('${ALICE}', '${tx}')`)).rejects.toThrow();
    await expect(asUser(db, ALICE, "select * from credit_list_undelivered_sessions(null, 0, 99999, 10)")).rejects.toThrow();
  });
});
