// GET /api/credits/history — the caller's ledger, newest first.
//   ?kind=transactions (default) | purchases
//   ?page=1&pageSize=20&type=usage

import { createClient } from "@/lib/supabase/server";
import { HttpError, handle, intParam, json, requireUser } from "@/lib/credits/api";
import { isTransactionType, listOwnPurchases, listOwnTransactions } from "@/lib/credits/history";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle("history", async () => {
    const { user } = await requireUser();
    const sp = new URL(request.url).searchParams;
    const page = intParam(sp.get("page"), 1, 1, 10_000);
    const pageSize = intParam(sp.get("pageSize"), 20, 1, 100);
    const kind = sp.get("kind") ?? "transactions";
    const client = await createClient();

    if (kind === "purchases") return json(await listOwnPurchases(client, user.id, { page, pageSize }));
    if (kind !== "transactions") throw new HttpError(400, "Invalid request.", "INVALID_REQUEST");

    const type = sp.get("type") || null;
    if (type !== null && !isTransactionType(type)) throw new HttpError(400, "Invalid request.", "INVALID_REQUEST");
    return json(await listOwnTransactions(client, user.id, { page, pageSize, type }));
  });
}
