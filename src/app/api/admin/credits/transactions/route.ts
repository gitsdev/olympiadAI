// GET /api/admin/credits/transactions — ledger report.
//   Filters: from, to (YYYY-MM-DD, India time), student (uuid), q (name/email),
//            feature, type. Paging: page, pageSize. ?format=csv downloads CSV.

import { createServiceClient } from "@/lib/supabase/service";
import { handle, intParam, json } from "@/lib/credits/api";
import { listTransactions, parseTransactionFilters, requireCreditAdmin, transactionsCsv } from "@/lib/credits/admin";
import { logAdminAction } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle("admin.transactions", async () => {
    const admin = await requireCreditAdmin("viewer");
    const sp = new URL(request.url).searchParams;
    const filters = parseTransactionFilters(Object.fromEntries(sp));
    const service = createServiceClient();

    if (sp.get("format") === "csv") {
      const { csv, truncated } = await transactionsCsv(service, filters);
      await logAdminAction(admin.id, "data_exported", "credit_transactions", null, { filters, truncated });
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="credit-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
          "cache-control": "no-store",
          "x-export-truncated": String(truncated),
        },
      });
    }

    return json(await listTransactions(service, filters, {
      page: intParam(sp.get("page"), 1, 1, 10_000),
      pageSize: intParam(sp.get("pageSize"), 25, 1, 200),
    }));
  });
}
