import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { parsePage } from "@/lib/admin/pagination";
import { createServiceClient } from "@/lib/supabase/service";
import { getCreditRole, hasCreditRole, listPurchases, parsePurchaseFilters } from "@/lib/credits/admin";
import { PURCHASE_STATUSES, PURCHASE_STATUS_LABELS } from "@/lib/credits/constants";
import { AdminShell } from "@/components/admin/AdminShell";
import { Pagination } from "@/components/admin/Pagination";
import { CreditsNav } from "@/components/admin/credits/CreditsNav";
import { ReportFilters } from "@/components/admin/credits/ReportFilters";
import { PurchasesTable } from "@/components/admin/credits/Tables";

export const metadata: Metadata = { title: "Credit Purchases | OlympiadIQ Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminCreditPurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const service = createServiceClient();
  const [result, role] = await Promise.all([
    listPurchases(service, parsePurchaseFilters(sp), { page, pageSize: PAGE_SIZE }),
    getCreditRole(service, admin.id),
  ]);

  return (
    <AdminShell adminName={admin.fullName} title="Credit Management" subtitle={`${result.totalCount} purchase${result.totalCount === 1 ? "" : "s"}`}>
      <CreditsNav />
      <div className="mb-4">
        <ReportFilters
          searchPlaceholder="Name, email, order_… or pay_…"
          csvHref="/api/admin/credits/purchases"
          selects={[{ param: "status", label: "Payment status", options: PURCHASE_STATUSES.map((s) => ({ value: s, label: PURCHASE_STATUS_LABELS[s] })) }]}
        />
      </div>
      <PurchasesTable rows={result.rows} canRefund={hasCreditRole(role, "super_admin")} />
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))} totalCount={result.totalCount} pageSize={PAGE_SIZE} />
    </AdminShell>
  );
}
