import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { parsePage } from "@/lib/admin/pagination";
import { createServiceClient } from "@/lib/supabase/service";
import { listTransactions, parseTransactionFilters } from "@/lib/credits/admin";
import { TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from "@/lib/credits/constants";
import { listFeaturePricing } from "@/lib/credits/pricing";
import { AdminShell } from "@/components/admin/AdminShell";
import { Pagination } from "@/components/admin/Pagination";
import { CreditsNav } from "@/components/admin/credits/CreditsNav";
import { ReportFilters } from "@/components/admin/credits/ReportFilters";
import { TransactionsTable } from "@/components/admin/credits/Tables";

export const metadata: Metadata = { title: "Credit Reports | OlympiadIQ Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminCreditTransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const service = createServiceClient();
  const [result, features] = await Promise.all([
    listTransactions(service, parseTransactionFilters(sp), { page, pageSize: PAGE_SIZE }),
    listFeaturePricing(service),
  ]);

  return (
    <AdminShell adminName={admin.fullName} title="Credit Management" subtitle={`Reports · ${result.totalCount} transaction${result.totalCount === 1 ? "" : "s"}`}>
      <CreditsNav />
      <div className="mb-4">
        <ReportFilters
          csvHref="/api/admin/credits/transactions"
          selects={[
            { param: "type", label: "Transaction type", options: TRANSACTION_TYPES.map((t) => ({ value: t, label: TRANSACTION_TYPE_LABELS[t] })) },
            { param: "feature", label: "Feature", options: features.map((f) => ({ value: f.feature_key, label: f.feature_name })) },
          ]}
        />
      </div>
      <TransactionsTable rows={result.rows} />
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))} totalCount={result.totalCount} pageSize={PAGE_SIZE} />
    </AdminShell>
  );
}
