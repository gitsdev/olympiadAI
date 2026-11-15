import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { parsePage } from "@/lib/admin/pagination";
import { createServiceClient } from "@/lib/supabase/service";
import { getCreditRole, hasCreditRole, listPurchases, listTransactions, profilesById } from "@/lib/credits/admin";
import { creditDb } from "@/lib/credits/db";
import { formatCredits } from "@/lib/credits/constants";
import { getWalletSummary } from "@/lib/credits/wallet";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { Pagination } from "@/components/admin/Pagination";
import { CreditsNav } from "@/components/admin/credits/CreditsNav";
import { AdjustCreditsForm } from "@/components/admin/credits/AdjustCreditsForm";
import { PurchasesTable, TransactionsTable } from "@/components/admin/credits/Tables";

export const metadata: Metadata = { title: "Student Wallet | OlympiadIQ Admin" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 25;

export default async function AdminStudentWalletPage({
  params, searchParams,
}: { params: Promise<{ userId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const { userId } = await params;
  if (!UUID.test(userId)) notFound();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const service = createServiceClient();

  const student = (await profilesById(service, [userId])).get(userId);
  if (!student) notFound();

  const [summary, role, history, adjustments, purchases, reversals] = await Promise.all([
    getWalletSummary(creditDb(), userId),
    getCreditRole(service, admin.id),
    listTransactions(service, { userId }, { page, pageSize: PAGE_SIZE }),
    listTransactions(service, { userId, type: "admin_adjustment" }, { page: 1, pageSize: 20 }),
    listPurchases(service, { userId }, { page: 1, pageSize: 10 }),
    service.from("credit_transactions").select("reference_id").eq("user_id", userId)
      .eq("transaction_type", "refund").not("feature_key", "is", null),
  ]);
  const reversedIds = new Set(((reversals.data ?? []) as { reference_id: string | null }[]).map((r) => r.reference_id ?? ""));
  const canAdjust = hasCreditRole(role, "admin");

  return (
    <AdminShell adminName={admin.fullName} title={student.full_name || student.email} subtitle={`${student.email} · ${student.role}`}>
      <CreditsNav />
      <Link href="/admin/credits/students" className="inline-flex items-center gap-1 text-[13px] font-semibold mb-4 hover:underline" style={{ color: "var(--brand)" }}>
        <ArrowLeft size={14} /> All wallets
      </Link>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Available balance" value={formatCredits(summary.balance)} />
        <StatCard label="Purchased" value={formatCredits(summary.purchased)} />
        <StatCard label="Welcome credits" value={formatCredits(summary.welcome)} />
        <StatCard label="Consumed" value={formatCredits(summary.consumed)} />
        <StatCard label="Adjustments (net)" value={`${summary.adjusted > 0 ? "+" : ""}${formatCredits(summary.adjusted)}`}
          hint={summary.refunded ? `${formatCredits(summary.refunded)} removed by refunds` : undefined} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 mt-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <section>
            <h2 className="text-[15px] font-bold mb-3" style={{ color: "var(--ink-900)" }}>Transaction history</h2>
            <TransactionsTable rows={history.rows} showStudent={false} canRefundUsage={canAdjust} reversedIds={reversedIds} />
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(history.totalCount / PAGE_SIZE))} totalCount={history.totalCount} pageSize={PAGE_SIZE} />
          </section>
          <section>
            <h2 className="text-[15px] font-bold mb-3" style={{ color: "var(--ink-900)" }}>Purchases</h2>
            <PurchasesTable rows={purchases.rows} canRefund={hasCreditRole(role, "super_admin")} />
          </section>
        </div>

        <div className="flex flex-col gap-5">
          {canAdjust ? (
            <AdjustCreditsForm userId={userId} balance={summary.balance} />
          ) : (
            <p className="text-[12.5px] rounded-[var(--r-md)] px-3 py-2" style={{ background: "var(--fill-100)", color: "var(--fg-muted)" }}>
              Manual adjustments need a credit admin role.
            </p>
          )}
          <section>
            <h3 className="text-[14px] font-bold mb-2" style={{ color: "var(--ink-900)" }}>Adjustment history</h3>
            {adjustments.rows.length === 0 ? (
              <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>No manual adjustments.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {adjustments.rows.map((a) => (
                  <li key={a.id} className="rounded-[var(--r-md)] border px-3 py-2 text-[12.5px]" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
                    <span className="font-bold tabular-nums" style={{ color: a.amount > 0 ? "var(--success-tx)" : "var(--danger-tx)" }}>
                      {a.amount > 0 ? "+" : "−"}{formatCredits(Math.abs(a.amount))}
                    </span>
                    <span style={{ color: "var(--ink-700)" }}> · {a.description}</span>
                    <span className="block text-[11.5px]" style={{ color: "var(--fg-muted)" }}>
                      {new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
