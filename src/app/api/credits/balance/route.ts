// GET /api/credits/balance — the caller's available balance.
//   ?summary=1 also returns totals (purchased, welcome, consumed, …).

import { createClient } from "@/lib/supabase/server";
import { handle, json, requireUser } from "@/lib/credits/api";
import { creditDb } from "@/lib/credits/db";
import { getOwnBalance, getWalletSummary } from "@/lib/credits/wallet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle("balance", async () => {
    const { user } = await requireUser();
    if (new URL(request.url).searchParams.get("summary") === "1") {
      // Computed server-side for the authenticated user only.
      const summary = await getWalletSummary(creditDb(), user.id);
      return json({ balance: summary.balance, summary });
    }
    const balance = await getOwnBalance(await createClient(), user.id);
    return json({ balance });
  });
}
