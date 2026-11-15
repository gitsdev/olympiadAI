// GET /api/admin/credits/dashboard — credit overview totals. Platform admins only.

import { handle, json } from "@/lib/credits/api";
import { getCreditOverview, requireCreditAdmin } from "@/lib/credits/admin";
import { creditDb } from "@/lib/credits/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle("admin.dashboard", async () => {
    await requireCreditAdmin("viewer");
    return json({ overview: await getCreditOverview(creditDb()) });
  });
}
