import Link from "next/link";
import { Clock, Coins, Gift, IndianRupee, ShoppingCart, Users, Wallet, Zap } from "lucide-react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getCreditOverview, getCreditRole, hasCreditRole, listPurchases, listTransactions } from "@/lib/credits/admin";
import { creditDb } from "@/lib/credits/db";
import { formatCredits, formatInr } from "@/lib/credits/constants";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { CreditsNav } from "@/components/admin/credits/CreditsNav";
import { ReconcileButton } from "@/components/admin/credits/ReconcileButton";
import { PurchasesTable, TransactionsTable } from "@/components/admin/credits/Tables";

export const metadata: Metadata = { title: "Credits | OlympiadIQ Admin" };
export const dynamic = "force-dynamic";

export default async function AdminCreditsOverviewPage() {
  const admin = await requireAdmin();
  const service = createServiceClient();
  const [overview, role, recentPurchases, recentAdjustments] = await Promise.all([
    getCreditOverview(creditDb()),
    getCreditRole(service, admin.id),
    listPurchases(service, {}, { page: 1, pageSize: 6 }),
    listTransactions(service, { type: "admin_adjustment" }, { page: 1, pageSize: 6 }),
  ]);

  return (
    <AdminShell
      adminName={admin.fullName}
      title="Credit Management"
      subtitle="Prepaid credits · 1 credit = ₹1"
      actions={hasCreditRole(role, "admin") ? <ReconcileButton /> : undefined}
    >
      <CreditsNav />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="Credits purchased" value={formatCredits(overview.creditsPurchased)} Icon={ShoppingCart} />
        <StatCard label="Credits consumed" value={formatCredits(overview.creditsConsumed)} Icon={Zap} />
        <StatCard label="Promotional credits issued" value={formatCredits(overview.promotionalIssued)} hint="Welcome + admin additions" Icon={Gift} />
        <StatCard label="Students with wallets" value={formatCredits(overview.wallets)} Icon={Users} />
        <StatCard label="Successful purchases" value={formatCredits(overview.successfulPurchases)} Icon={Coins} />
        <StatCard label="Pending purchases" value={formatCredits(overview.pendingPurchases)} Icon={Clock}
          tone={overview.pendingPurchases > 0 ? "warning" : "default"} />
        <StatCard label="Revenue" value={formatInr(overview.revenuePaise)}
          hint={overview.refundedPaise ? `${formatInr(overview.refundedPaise)} refunded` : "No refunds"} Icon={IndianRupee} />
        <StatCard label="Outstanding balance" value={formatCredits(overview.outstandingBalance)} hint="Unspent credits held by students" Icon={Wallet} />
      </div>

      {!role && (
        <p className="text-[12.5px] mt-4 px-3 py-2 rounded-[var(--r-md)]" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
          You can view credit data. Changing prices, adjusting balances and refunds need a credit admin role (credit_admins table).
        </p>
      )}

      <Section title="Recent purchases" href="/admin/credits/purchases">
        <PurchasesTable rows={recentPurchases.rows} />
      </Section>
      <Section title="Recent manual adjustments" href="/admin/credits/transactions?type=admin_adjustment">
        <TransactionsTable rows={recentAdjustments.rows} />
      </Section>
    </AdminShell>
  );
}

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold" style={{ color: "var(--ink-900)" }}>{title}</h2>
        <Link href={href} className="text-[13px] font-semibold hover:underline" style={{ color: "var(--brand)" }}>View all</Link>
      </div>
      {children}
    </section>
  );
}
