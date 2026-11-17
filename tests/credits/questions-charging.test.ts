// POST /api/questions charges Mock Tests and Practice (5 credits each once
// priced), never AI Battle, and refunds when question generation fails.

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "00000000-0000-0000-0000-0000000000b1" } as { id: string } | null,
  role: "student",
  charges: [] as Array<{ featureKey: string; sessionKey: string }>,
  refunds: [] as string[],
  chargeResult: { ok: true, status: "charged", cost: 5, balance: 20, transactionId: "tx-1" } as Record<string, unknown>,
  generateFails: false,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q; q.eq = () => q;
      q.maybeSingle = async () => ({ data: { role: state.role } });
      q.insert = () => ({ select: () => ({ single: async () => ({ data: null }) }) });
      return q;
    },
  }),
}));

vi.mock("@/lib/credits/feature", () => ({
  chargeFeatureStart: async (input: { featureKey: string; sessionKey: string }) => {
    state.charges.push({ featureKey: input.featureKey, sessionKey: input.sessionKey });
    return state.chargeResult;
  },
  refundFailedStart: async (input: { transactionId: string }) => {
    state.refunds.push(input.transactionId);
    return { ok: true, status: "reversed", balance: 25, transactionId: "r1" };
  },
}));

vi.mock("@/lib/questions/generate", () => ({
  generateQuestions: async () => {
    if (state.generateFails) throw new Error("AI unavailable");
    return [{ question_text: "2+2?", options: ["3", "4"], correct_answer_index: 1, explanation: "", topic_name: "x", difficulty: "Easy", estimated_time_seconds: 30 }];
  },
}));

const { POST } = await import("@/app/api/questions/route");

function req(body: Record<string, unknown>) {
  return new Request("http://localhost/api/questions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ subject: "Mathematics", topicName: "Fractions", difficulty: "Easy", count: 5, classLevel: 6, board: "CBSE", ...body }),
  }) as unknown as Parameters<typeof POST>[0];
}

const SESSION = "5a3e1f7c-2b4d-4e6f-8a9b-0c1d2e3f4a5b";

beforeEach(() => {
  state.user = { id: "00000000-0000-0000-0000-0000000000b1" };
  state.role = "student";
  state.charges = [];
  state.refunds = [];
  state.chargeResult = { ok: true, status: "charged", cost: 5, balance: 20, transactionId: "tx-1" };
  state.generateFails = false;
});

describe("/api/questions credit charging", () => {
  it("charges a mock test under mock_test, using the client's session id", async () => {
    const res = await POST(req({ purpose: "mock_test", sessionId: SESSION }));
    expect(res.status).toBe(200);
    expect(state.charges).toEqual([{ featureKey: "mock_test", sessionKey: SESSION }]);
  });

  it("charges practice — and treats a missing purpose as practice", async () => {
    await POST(req({ purpose: "practice", sessionId: SESSION }));
    await POST(req({}));
    expect(state.charges.map((c) => c.featureKey)).toEqual(["practice", "practice"]);
  });

  it("does not charge AI Battle", async () => {
    expect((await POST(req({ purpose: "battle" }))).status).toBe(200);
    expect(state.charges).toEqual([]);
  });

  it("returns 402 with the shortfall and generates nothing when credits are short", async () => {
    state.chargeResult = { ok: false, error: "INSUFFICIENT_CREDITS", cost: 5, balance: 2, shortfall: 3 };
    const res = await POST(req({ purpose: "practice", sessionId: SESSION }));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ code: "INSUFFICIENT_CREDITS", required: 5, balance: 2, buyUrl: "/credits" });
  });

  it("refunds the charge when question generation fails", async () => {
    state.generateFails = true;
    const res = await POST(req({ purpose: "mock_test", sessionId: SESSION }));
    expect(res.status).toBe(500);
    expect(state.refunds).toEqual(["tx-1"]);
  });

  it("requires sign-in for charged purposes, and exempts admins", async () => {
    state.user = null;
    expect((await POST(req({ purpose: "practice" }))).status).toBe(401);
    state.user = { id: "00000000-0000-0000-0000-0000000000a1" };
    state.role = "platform_admin";
    expect((await POST(req({ purpose: "practice" }))).status).toBe(200);
    expect(state.charges).toEqual([]);
  });
});
