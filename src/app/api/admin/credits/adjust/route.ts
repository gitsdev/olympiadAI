// POST /api/admin/credits/adjust — manual credit adjustment.
// Body: { userId, amount (non-zero integer; negative deducts), reason, idempotencyKey }
// Always writes an admin_adjustment ledger entry; balances are never overwritten.
// Requires credit role "admin" or "super_admin". Audit-logged.

import { z } from "zod";
import { handle, json, parseBody } from "@/lib/credits/api";
import { adjustCredits, requireCreditAdmin } from "@/lib/credits/admin";
import { creditDb } from "@/lib/credits/db";
import { logAdminAction } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  userId: z.string().regex(UUID_RE),
  amount: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 1_000_000),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_.:-]{8,120}$/),
});

const MESSAGES: Record<string, [number, string]> = {
  REASON_REQUIRED: [400, "A reason is required."],
  INVALID_AMOUNT: [400, "Enter a non-zero whole number of credits."],
  USER_NOT_FOUND: [404, "Student not found."],
  INSUFFICIENT_CREDITS: [409, "That would take the balance below zero."],
};

export async function POST(request: Request) {
  return handle("admin.adjust", async () => {
    const admin = await requireCreditAdmin("admin");
    const body = await parseBody(request, schema, "Enter a non-zero amount and a reason (at least 3 characters).");
    const result = await adjustCredits(creditDb(), { ...body, adminId: admin.id });
    if (!result.ok) {
      const [status, message] = MESSAGES[result.error] ?? [400, "Adjustment failed."];
      return json({ error: message, code: result.error, ...(result.balance !== undefined ? { balance: result.balance } : {}) }, status);
    }
    if (result.status === "adjusted") {
      await logAdminAction(admin.id, "credit_adjusted", "credit_wallet", body.userId, {
        amount: body.amount, reason: body.reason, transaction_id: result.transactionId,
      });
    }
    return json(result);
  });
}
