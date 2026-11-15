// 16. Admin credit endpoints authorise server-side. Calls the real route
// handlers with mocked Supabase sessions (no database needed: rejected
// requests must never reach it).

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; app_metadata: Record<string, unknown> },
  role: null as string | null,
  creditRole: null as string | null,
  rpcCalls: [] as string[],
}));

function query(result: () => unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "or", "order", "range", "limit", "gte", "lte", "not"]) q[m] = () => q;
  q.maybeSingle = async () => ({ data: result(), error: null });
  q.single = async () => ({ data: result(), error: null });
  q.insert = async () => ({ data: null, error: null });
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => query(() => (state.role ? { role: state.role, full_name: "Test User" } : null)),
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => query(() => (table === "credit_admins" && state.creditRole ? { role: state.creditRole } : null)),
    rpc: async (fn: string) => {
      state.rpcCalls.push(fn);
      if (fn === "credit_admin_adjust") return { data: { ok: true, status: "adjusted", balance: 75, transaction_id: "t1" }, error: null };
      if (fn === "credit_admin_overview") return { data: [{}], error: null };
      return { data: null, error: null };
    },
  }),
}));

const { POST: adjust } = await import("@/app/api/admin/credits/adjust/route");
const { POST: refund } = await import("@/app/api/admin/credits/refund/route");
const { POST: pricing } = await import("@/app/api/admin/credits/pricing/route");
const { GET: dashboard } = await import("@/app/api/admin/credits/dashboard/route");
const { GET: transactions } = await import("@/app/api/admin/credits/transactions/route");

const USER = "00000000-0000-0000-0000-000000000123";
const adjustBody = { userId: USER, amount: 50, reason: "Goodwill credit", idempotencyKey: "key-12345678" };

function post(body: unknown): Request {
  return new Request("http://localhost/api/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  state.user = { id: "00000000-0000-0000-0000-0000000000aa", email: "u@x.test", app_metadata: {} };
  state.role = "student";
  state.creditRole = null;
  state.rpcCalls = [];
});

describe("16. unauthorized admin requests are rejected", () => {
  it("signed-out callers get 401 everywhere", async () => {
    state.user = null;
    for (const res of [
      await adjust(post(adjustBody)),
      await refund(post({ purchaseId: USER, reason: "abc" })),
      await pricing(post({})),
      await dashboard(),
      await transactions(new Request("http://localhost/api/admin/credits/transactions?format=csv")),
    ]) expect(res.status).toBe(401);
    expect(state.rpcCalls).toEqual([]);
  });

  it("students get 403 — even with a well-formed request", async () => {
    for (const res of [
      await adjust(post(adjustBody)),
      await refund(post({ purchaseId: USER, reason: "abc" })),
      await pricing(post({ featureKey: "ai_tutor", featureName: "AI Tutor", creditCost: 0, isEnabled: false })),
      await dashboard(),
      await transactions(new Request("http://localhost/api/admin/credits/transactions")),
    ]) expect(res.status).toBe(403);
    expect(state.rpcCalls).toEqual([]);
  });

  it("a student cannot sneak in with a credit_admins row alone", async () => {
    state.creditRole = "super_admin";
    expect((await adjust(post(adjustBody))).status).toBe(403);
  });

  it("platform admins without a credit role can view but not move credits", async () => {
    state.role = "platform_admin";
    expect((await dashboard()).status).toBe(200);
    expect((await adjust(post(adjustBody))).status).toBe(403);
    expect((await pricing(post({ featureKey: "ai_tutor", featureName: "AI Tutor", creditCost: 0, isEnabled: false }))).status).toBe(403);
    expect(state.rpcCalls).not.toContain("credit_admin_adjust");
  });

  it("credit 'admin' can adjust but cannot refund purchases (super_admin only)", async () => {
    state.role = "platform_admin";
    state.creditRole = "admin";
    const res = await adjust(post(adjustBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, balance: 75 });
    expect((await refund(post({ purchaseId: USER, reason: "abc refund" }))).status).toBe(403);
  });

  it("validates input: no reason → 400, zero amount → 400", async () => {
    state.role = "platform_admin";
    state.creditRole = "super_admin";
    expect((await adjust(post({ ...adjustBody, reason: "" }))).status).toBe(400);
    expect((await adjust(post({ ...adjustBody, amount: 0 }))).status).toBe(400);
  });

  it("unverified-email accounts are refused", async () => {
    state.role = "platform_admin";
    state.creditRole = "super_admin";
    state.user!.app_metadata = { email_otp_pending: true };
    expect((await adjust(post(adjustBody))).status).toBe(403);
  });
});
