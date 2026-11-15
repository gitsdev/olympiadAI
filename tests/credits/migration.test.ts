// Credit wallet database layer (migrations 021 + 022) on a real in-memory
// Postgres (PGlite). Numbers in test names map to the spec's test list.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ADMIN, ALICE, BOB, MIGRATION_021, MIGRATION_022, PARENT,
  asUser, balanceOf, createDb, ledgerSum, setPrice, signUp,
} from "./helpers";

const OLD_STUDENT = "00000000-0000-0000-0000-0000000000d1";
const OLD_STUDENT_2 = "00000000-0000-0000-0000-0000000000d2";
const OLD_ADMIN = "00000000-0000-0000-0000-0000000000d3";

let db: PGlite;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
async function jsonOf(sql: string, params: unknown[] = []): Promise<Record<string, unknown>> {
  const [row] = await q<{ r: Record<string, unknown> }>(`select (${sql}) as r`, params);
  return row.r;
}
async function adjust(uid: string, amount: number, key: string, reason = "test credit") {
  return jsonOf(`credit_admin_adjust($1, $2, $3, $4, $5)`, [uid, amount, reason, ADMIN, key]);
}
async function deduct(uid: string, feature: string, key: string) {
  return jsonOf(`credit_deduct($1, $2, $3)`, [uid, feature, key]);
}

beforeAll(async () => {
  // Accounts that exist BEFORE the migration (for the backfill test).
  db = await createDb({ preExisting: [[OLD_STUDENT, "student"], [OLD_STUDENT_2, "student"], [OLD_ADMIN, "platform_admin"]] });
  await signUp(db, ADMIN, "platform_admin");
  await signUp(db, ALICE);
  await signUp(db, BOB);
  await signUp(db, PARENT, "parent");
}, 60_000);

describe("migration", () => {
  it("is idempotent (safe to re-run)", async () => {
    await expect(db.exec(MIGRATION_021)).resolves.toBeDefined();
    const [{ n }] = await q<{ n: number }>("select count(*)::int as n from feature_credit_costs");
    expect(n).toBe(4);
  });

  it("registers the four features unpriced and not charging", async () => {
    const rows = await q<{ feature_key: string; credit_cost: number | null; is_enabled: boolean }>(
      "select feature_key, credit_cost, is_enabled from feature_credit_costs order by feature_key");
    expect(rows.map((r) => r.feature_key)).toEqual(["ai_tutor", "brain_booster", "friend_battle", "mock_test"]);
    expect(rows.every((r) => r.credit_cost === null && r.is_enabled === false)).toBe(true);
  });

  it("enables RLS on every credit table", async () => {
    const rows = await q("select relname from pg_class where relkind = 'r' and (relname like 'credit_%' or relname = 'feature_credit_costs') and not relrowsecurity");
    expect(rows).toEqual([]);
  });

  it("seeds existing platform admins as credit super admins", async () => {
    const rows = await q<{ user_id: string; role: string }>("select user_id, role from credit_admins");
    expect(rows).toContainEqual({ user_id: OLD_ADMIN, role: "super_admin" });
    expect(rows.map((r) => r.user_id)).not.toContain(ALICE);
  });
});

describe("welcome credits", () => {
  it("1. a new student receives 25 welcome credits with a ledger entry", async () => {
    expect(await balanceOf(db, ALICE)).toBe(25);
    const rows = await q<{ transaction_type: string; amount: number; balance_after: number }>(
      "select transaction_type, amount::int, balance_after::int from credit_transactions where user_id = $1", [ALICE]);
    expect(rows).toEqual([{ transaction_type: "welcome", amount: 25, balance_after: 25 }]);
  });

  it("does not award admins or parents", async () => {
    expect(await balanceOf(db, ADMIN)).toBe(0);
    expect(await balanceOf(db, PARENT)).toBe(0);
    expect((await jsonOf("to_jsonb(credit_grant_welcome($1))", [PARENT]))).toBe("not_eligible");
  });

  it("2. cannot be granted twice (function, role flip, or direct insert)", async () => {
    expect(await jsonOf("to_jsonb(credit_grant_welcome($1))", [ALICE])).toBe("already_granted");
    await db.exec(`update profiles set role = 'parent' where id = '${ALICE}'; update profiles set role = 'student' where id = '${ALICE}';`);
    expect(await balanceOf(db, ALICE)).toBe(25);
    await expect(db.query(
      `insert into credit_transactions (user_id, transaction_type, amount, balance_after, idempotency_key)
       values ($1, 'welcome', 25, 50, 'sneaky')`, [ALICE])).rejects.toThrow();
  });

  it("3. backfill grants existing students once and skips non-students; re-running is a no-op", async () => {
    expect(await balanceOf(db, OLD_STUDENT)).toBe(0);
    await db.exec(MIGRATION_022);
    expect(await balanceOf(db, OLD_STUDENT)).toBe(25);
    expect(await balanceOf(db, OLD_STUDENT_2)).toBe(25);
    expect(await balanceOf(db, OLD_ADMIN)).toBe(0);
    expect(await balanceOf(db, ALICE)).toBe(25);
    await db.exec(MIGRATION_022);
    const [{ n }] = await q<{ n: number }>("select count(*)::int as n from credit_transactions where transaction_type = 'welcome'");
    expect(n).toBe(4); // ALICE, BOB, two old students
    expect(await balanceOf(db, OLD_STUDENT)).toBe(25);
  });

  it("never blocks signup when the grant fails", async () => {
    await db.exec("alter table credit_wallets rename to credit_wallets_tmp");
    try {
      await expect(signUp(db, "00000000-0000-0000-0000-0000000000e1")).resolves.toBeUndefined();
    } finally {
      await db.exec("alter table credit_wallets_tmp rename to credit_wallets");
    }
  });
});

describe("security", () => {
  it("11. a student cannot modify their wallet, ledger, purchases or pricing", async () => {
    const attempts = [
      `update credit_wallets set balance = 999999 where user_id = '${ALICE}'`,
      `insert into credit_wallets (user_id, balance) values ('${ALICE}', 1000)`,
      `delete from credit_wallets where user_id = '${ALICE}'`,
      `insert into credit_transactions (user_id, transaction_type, amount, balance_after, idempotency_key) values ('${ALICE}', 'purchase', 500, 525, 'x1')`,
      `update credit_transactions set amount = 1000 where user_id = '${ALICE}'`,
      `insert into credit_purchases (user_id, credits, amount_paise, razorpay_order_id, status) values ('${ALICE}', 100, 10000, 'order_fake', 'paid')`,
      `update feature_credit_costs set credit_cost = 0`,
      `select credit_admin_adjust('${ALICE}', 1000, 'free money', '${ALICE}', 'k1')`,
      `select credit_apply('${ALICE}', 'purchase', 1000, 'k2')`,
      `select credit_fulfil_purchase('order_x', 'pay_x', 100, 'INR', 'checkout')`,
    ];
    for (const sql of attempts) {
      await expect(asUser(db, ALICE, sql), sql).rejects.toThrow();
    }
    expect(await balanceOf(db, ALICE)).toBe(25);
  });

  it("a student reads only their own wallet and transactions", async () => {
    const wallets = await asUser<{ user_id: string }>(db, ALICE, "select user_id from credit_wallets");
    expect(wallets.map((w) => w.user_id)).toEqual([ALICE]);
    const txs = await asUser<{ user_id: string }>(db, ALICE, "select user_id from credit_transactions");
    expect(new Set(txs.map((t) => t.user_id))).toEqual(new Set([ALICE]));
    await expect(asUser(db, ALICE, "select * from credit_webhook_events")).rejects.toThrow();
  });

  it("the ledger is append-only even for the service role", async () => {
    await expect(db.exec(`update credit_transactions set amount = 1 where user_id = '${ALICE}'`)).rejects.toThrow(/append-only/);
    await expect(db.exec(`delete from credit_transactions where user_id = '${ALICE}'`)).rejects.toThrow(/append-only/);
  });

  it("balances cannot be overwritten directly, even by the service role", async () => {
    await expect(db.exec(`update credit_wallets set balance = 5000 where user_id = '${ALICE}'`)).rejects.toThrow(/credit_apply/);
  });
});

describe("feature deduction", () => {
  it("19. disabled or unpriced features consume nothing", async () => {
    await setPrice(db, "mock_test", 10, false);
    const r = await deduct(ALICE, "mock_test", "k-disabled");
    expect(r).toMatchObject({ ok: true, status: "free", cost: 0 });
    await setPrice(db, "mock_test", null, true);
    expect(await deduct(ALICE, "mock_test", "k-unpriced")).toMatchObject({ ok: true, status: "free" });
    expect(await balanceOf(db, ALICE)).toBe(25);
  });

  it("13. deducts exactly the configured price", async () => {
    await setPrice(db, "mock_test", 10, true);
    const r = await deduct(ALICE, "mock_test", "attempt-1");
    expect(r).toMatchObject({ ok: true, status: "charged", cost: 10, balance: 15 });
    expect(await balanceOf(db, ALICE)).toBe(15);
    const [tx] = await q<{ amount: number; feature_key: string }>(
      "select amount::int, feature_key from credit_transactions where id = $1", [r.transaction_id]);
    expect(tx).toEqual({ amount: -10, feature_key: "mock_test" });
  });

  it("14. repeating the same request does not deduct twice", async () => {
    const r = await deduct(ALICE, "mock_test", "attempt-1");
    expect(r).toMatchObject({ ok: true, status: "duplicate", balance: 15 });
    expect(await balanceOf(db, ALICE)).toBe(15);
  });

  it("12. insufficient balance blocks the start with a structured error", async () => {
    await setPrice(db, "ai_tutor", 100, true);
    const r = await deduct(ALICE, "ai_tutor", "chat-1");
    expect(r).toEqual({ ok: false, error: "INSUFFICIENT_CREDITS", cost: 100, balance: 15 });
    expect(await balanceOf(db, ALICE)).toBe(15);
  });

  it("rejects unknown features and non-students", async () => {
    expect(await deduct(ALICE, "nope", "k-x1")).toMatchObject({ ok: false, error: "FEATURE_NOT_FOUND" });
    expect(await deduct(PARENT, "mock_test", "k-x2")).toMatchObject({ ok: false, error: "NOT_ELIGIBLE" });
  });

  it("15. many requests in flight can never drive the balance negative", async () => {
    // PGlite has a single connection, so these are serialised rather than
    // truly parallel; the row lock + CHECK (balance >= 0) are what make the
    // same guarantee hold under real concurrency in Supabase.
    await setPrice(db, "brain_booster", 4, true);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => deduct(BOB, "brain_booster", `burst-${i}`)));
    expect(results.filter((r) => r.ok === true)).toHaveLength(6); // 25 / 4
    expect(results.filter((r) => r.error === "INSUFFICIENT_CREDITS")).toHaveLength(4);
    expect(await balanceOf(db, BOB)).toBe(1);
    // And the database itself refuses a negative balance outright.
    await expect(db.exec(`select set_config('credits.in_apply', 'on', false);
      update credit_wallets set balance = -1 where user_id = '${BOB}'`)).rejects.toThrow();
    await db.exec("select set_config('credits.in_apply', 'off', false)");
  });

  it("reverses a charge for a feature that failed to start, only once", async () => {
    const charge = await deduct(ALICE, "mock_test", "attempt-2");
    expect(charge).toMatchObject({ status: "charged", balance: 5 });
    const rev = await jsonOf("credit_reverse_usage($1, $2, $3)", [ALICE, charge.transaction_id, "question generation failed"]);
    expect(rev).toMatchObject({ ok: true, status: "reversed", balance: 15 });
    const again = await jsonOf("credit_reverse_usage($1, $2, $3)", [ALICE, charge.transaction_id, "retry"]);
    expect(again).toMatchObject({ ok: true, status: "duplicate", balance: 15 });
    expect(await balanceOf(db, ALICE)).toBe(15);
  });

  it("will not reverse someone else's charge or an old (completed) session", async () => {
    const charge = await deduct(ALICE, "mock_test", "attempt-3");
    expect(await jsonOf("credit_reverse_usage($1, $2, $3)", [BOB, charge.transaction_id, "x"]))
      .toMatchObject({ ok: false, error: "USAGE_NOT_FOUND" });
    expect(await jsonOf("credit_reverse_usage($1, $2, $3, 0)", [ALICE, charge.transaction_id, "x"]))
      .toMatchObject({ ok: false, error: "REVERSAL_WINDOW_CLOSED" });
  });
});

describe("admin adjustments", () => {
  it("17. create ledger entries with the reason and admin", async () => {
    const r = await adjust(BOB, 50, "k-adj-1", "Compensation for outage");
    expect(r).toMatchObject({ ok: true, status: "adjusted", balance: 51 });
    const [tx] = await q<{ transaction_type: string; amount: number; description: string; metadata: Record<string, unknown> }>(
      "select transaction_type, amount::int, description, metadata from credit_transactions where id = $1", [r.transaction_id]);
    expect(tx).toMatchObject({ transaction_type: "admin_adjustment", amount: 50, description: "Compensation for outage" });
    expect(tx.metadata).toMatchObject({ admin_id: ADMIN });
  });

  it("require a reason, and cannot deduct below zero", async () => {
    expect(await adjust(BOB, 5, "k-adj-2", " ")).toMatchObject({ ok: false, error: "REASON_REQUIRED" });
    expect(await adjust(BOB, -1000, "k-adj-3")).toMatchObject({ ok: false, error: "INSUFFICIENT_CREDITS", balance: 51 });
    expect(await adjust(BOB, -11, "k-adj-4", "Correction")).toMatchObject({ ok: true, balance: 40 });
  });
});

describe("purchases (database side)", () => {
  async function order(uid: string, id: string, credits: number) {
    await q("select credit_create_purchase($1, $2, $3, $4)", [uid, credits, credits * 100, id]);
  }

  it("rejects an amount that doesn't match the credits", async () => {
    await expect(q("select credit_create_purchase($1, 100, 5000, 'order_bad')", [ALICE])).rejects.toThrow(/INVALID_AMOUNT/);
  });

  it("7. a failed payment does not credit the wallet", async () => {
    await order(ALICE, "order_f1", 100);
    await q("select credit_mark_purchase_failed('order_f1', 'pay_f1', 'card declined')");
    const [p] = await q<{ status: string }>("select status from credit_purchases where razorpay_order_id = 'order_f1'");
    expect(p.status).toBe("failed");
    expect(await balanceOf(db, ALICE)).toBe(5);
  });

  it("a retry on a failed order can still succeed", async () => {
    const r = await jsonOf("credit_fulfil_purchase('order_f1', 'pay_f2', 10000, 'INR', 'webhook')");
    expect(r).toMatchObject({ ok: true, status: "paid", balance: 105 });
  });

  it("8. a payment is credited exactly once, whichever path arrives first", async () => {
    await order(ALICE, "order_p1", 500);
    const first = await jsonOf("credit_fulfil_purchase('order_p1', 'pay_p1', 50000, 'INR', 'checkout')");
    const second = await jsonOf("credit_fulfil_purchase('order_p1', 'pay_p1', 50000, 'INR', 'webhook')");
    expect(first).toMatchObject({ ok: true, status: "paid", credits: 500, balance: 605 });
    expect(second).toMatchObject({ ok: true, status: "already_paid", balance: 605 });
    expect(await balanceOf(db, ALICE)).toBe(605);
  });

  it("refuses to fulfil when the paid amount or currency differs", async () => {
    await order(ALICE, "order_m1", 100);
    expect(await jsonOf("credit_fulfil_purchase('order_m1', 'pay_m1', 100, 'INR', 'webhook')"))
      .toMatchObject({ ok: false, error: "AMOUNT_MISMATCH" });
    expect(await jsonOf("credit_fulfil_purchase('order_m1', 'pay_m1', 10000, 'USD', 'webhook')"))
      .toMatchObject({ ok: false, error: "AMOUNT_MISMATCH" });
    expect(await balanceOf(db, ALICE)).toBe(605);
  });

  it("18. refunds create reversal entries, are idempotent, and never go negative", async () => {
    // Partial refund of 200 of the 500 purchased credits.
    const r1 = await jsonOf("credit_record_purchase_refund('order_p1', 'rfnd_1', 20000, $1, 'requested')", [ADMIN]);
    expect(r1).toMatchObject({ ok: true, status: "recorded", credits_removed: 200, shortfall: 0, balance: 405 });
    const dup = await jsonOf("credit_record_purchase_refund('order_p1', 'rfnd_1', 20000, $1, 'requested')", [ADMIN]);
    expect(dup).toMatchObject({ ok: true, status: "duplicate" });
    const [p] = await q<{ status: string; refunded_credits: number }>(
      "select status, refunded_credits::int from credit_purchases where razorpay_order_id = 'order_p1'");
    expect(p).toEqual({ status: "partially_refunded", refunded_credits: 200 });
    const [tx] = await q<{ transaction_type: string; amount: number }>(
      "select transaction_type, amount::int from credit_transactions where idempotency_key = 'purchase_refund:rfnd_1'");
    expect(tx).toEqual({ transaction_type: "refund", amount: -200 });

    // Student spends most of the rest, then the remaining 300 are refunded.
    await setPrice(db, "friend_battle", 400, true);
    await deduct(ALICE, "friend_battle", "battle-1");
    expect(await balanceOf(db, ALICE)).toBe(5);
    const r2 = await jsonOf("credit_record_purchase_refund('order_p1', 'rfnd_2', 30000, null, 'dashboard')");
    expect(r2).toMatchObject({ ok: true, credits_removed: 5, shortfall: 295, balance: 0 });
    expect(await jsonOf("credit_record_purchase_refund('order_p1', 'rfnd_3', 100, null, 'x')"))
      .toMatchObject({ ok: false, error: "NOT_REFUNDABLE" });
  });
});

describe("webhook dedupe", () => {
  it("processes an event once, but allows retrying one that failed", async () => {
    expect(await jsonOf("to_jsonb(credit_webhook_begin('evt_1', 'payment.captured'))")).toBe("process");
    await q("select credit_webhook_finish('evt_1', 'temporary failure')");
    expect(await jsonOf("to_jsonb(credit_webhook_begin('evt_1', 'payment.captured'))")).toBe("process");
    await q("select credit_webhook_finish('evt_1', null)");
    expect(await jsonOf("to_jsonb(credit_webhook_begin('evt_1', 'payment.captured'))")).toBe("duplicate");
  });
});

describe("20. balances and ledgers stay consistent", () => {
  it("every wallet equals the sum of its ledger, and each balance_after chains correctly", async () => {
    const wallets = await q<{ user_id: string }>("select user_id from credit_wallets");
    expect(wallets.length).toBeGreaterThan(3);
    for (const { user_id } of wallets) {
      expect(await balanceOf(db, user_id)).toBe(await ledgerSum(db, user_id));
    }
    // Each user's most recent ledger row carries the current balance.
    const latest = await q<{ user_id: string; balance_after: number }>(`
      select distinct on (user_id) user_id, balance_after::int
        from credit_transactions where user_id is not null
       order by user_id, created_at desc, balance_after`);
    for (const row of latest) {
      // Ties on created_at only happen within one statement; the wallet must match one of them.
      const [{ ok }] = await q<{ ok: boolean }>(`
        select exists (select 1 from credit_transactions t join credit_wallets w on w.user_id = t.user_id
          where t.user_id = $1 and t.balance_after = w.balance
            and t.created_at = (select max(created_at) from credit_transactions where user_id = $1)) as ok`, [row.user_id]);
      expect(ok, row.user_id).toBe(true);
    }
    const [{ neg }] = await q<{ neg: number }>("select count(*)::int as neg from credit_wallets where balance < 0");
    expect(neg).toBe(0);
  });
});
