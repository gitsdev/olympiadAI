// GET /api/admin/credits/students — student wallets.
//   ?q=name-or-email&page=1&pageSize=20          → paginated list
//   ?userId=<uuid>                               → one student's summary + recent ledger

import { createServiceClient } from "@/lib/supabase/service";
import { HttpError, handle, intParam, isUuid, json } from "@/lib/credits/api";
import { listTransactions, listWallets, profilesById, requireCreditAdmin } from "@/lib/credits/admin";
import { creditDb } from "@/lib/credits/db";
import { getWalletSummary } from "@/lib/credits/wallet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle("admin.students", async () => {
    await requireCreditAdmin("viewer");
    const sp = new URL(request.url).searchParams;
    const userId = sp.get("userId");

    if (userId !== null) {
      if (!isUuid(userId)) throw new HttpError(400, "Invalid student id.", "INVALID_REQUEST");
      const service = createServiceClient();
      const profile = (await profilesById(service, [userId])).get(userId);
      if (!profile) throw new HttpError(404, "Student not found.", "NOT_FOUND");
      const [summary, history] = await Promise.all([
        getWalletSummary(creditDb(), userId),
        listTransactions(service, { userId }, { page: intParam(sp.get("page"), 1, 1, 10_000), pageSize: 50 }),
      ]);
      return json({ student: profile, summary, transactions: history });
    }

    const result = await listWallets(creditDb(), {
      q: sp.get("q"),
      page: intParam(sp.get("page"), 1, 1, 10_000),
      pageSize: intParam(sp.get("pageSize"), 20, 1, 100),
    });
    return json(result);
  });
}
