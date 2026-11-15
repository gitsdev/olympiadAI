// GET /api/admin/credits/purchases — Razorpay purchases.
//   Filters: from, to (YYYY-MM-DD, India time), student (uuid),
//            q (name/email or order_…/pay_… id), status. ?format=csv downloads CSV.

import { createServiceClient } from "@/lib/supabase/service";
import { handle, intParam, json } from "@/lib/credits/api";
import { listPurchases, parsePurchaseFilters, purchasesCsv, requireCreditAdmin } from "@/lib/credits/admin";
import { logAdminAction } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle("admin.purchases", async () => {
    const admin = await requireCreditAdmin("viewer");
    const sp = new URL(request.url).searchParams;
    const filters = parsePurchaseFilters(Object.fromEntries(sp));
    const service = createServiceClient();

    if (sp.get("format") === "csv") {
      const { csv, truncated } = await purchasesCsv(service, filters);
      await logAdminAction(admin.id, "data_exported", "credit_purchases", null, { filters, truncated });
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="credit-purchases-${new Date().toISOString().slice(0, 10)}.csv"`,
          "cache-control": "no-store",
          "x-export-truncated": String(truncated),
        },
      });
    }

    return json(await listPurchases(service, filters, {
      page: intParam(sp.get("page"), 1, 1, 10_000),
      pageSize: intParam(sp.get("pageSize"), 25, 1, 200),
    }));
  });
}
