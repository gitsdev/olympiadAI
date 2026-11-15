import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { parsePage } from "@/lib/admin/pagination";
import { listWallets } from "@/lib/credits/admin";
import { creditDb } from "@/lib/credits/db";
import { formatCredits } from "@/lib/credits/constants";
import { AdminShell } from "@/components/admin/AdminShell";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { CreditsNav } from "@/components/admin/credits/CreditsNav";
import { fmtDateTime } from "@/components/admin/credits/format";

export const metadata: Metadata = { title: "Student Wallets | OlympiadIQ Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminCreditStudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const { rows, totalCount } = await listWallets(creditDb(), { q: sp.q, page, pageSize: PAGE_SIZE });

  return (
    <AdminShell adminName={admin.fullName} title="Credit Management" subtitle={`${totalCount} wallet${totalCount === 1 ? "" : "s"}`}>
      <CreditsNav />
      <div className="mb-4"><SearchInput placeholder="Search by name or email…" /></div>
      <div className="rounded-[var(--r-lg)] border overflow-x-auto" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
        <table className="w-full text-[13px] min-w-[820px]">
          <thead>
            <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)", background: "var(--paper-2)" }}>
              <th className="px-4 py-2.5 font-semibold">Student</th>
              <th className="px-4 py-2.5 font-semibold text-right">Balance</th>
              <th className="px-4 py-2.5 font-semibold text-right">Purchased</th>
              <th className="px-4 py-2.5 font-semibold text-right">Welcome</th>
              <th className="px-4 py-2.5 font-semibold text-right">Consumed</th>
              <th className="px-4 py-2.5 font-semibold">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--fg-muted)" }}>No students found.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.user_id} className="border-t hover:bg-[var(--fill-100)]" style={{ borderColor: "var(--line-200)" }}>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/credits/students/${r.user_id}`} className="hover:underline">
                    <span className="block font-semibold" style={{ color: "var(--ink-900)" }}>{r.full_name || "—"}</span>
                    <span className="block text-[12px]" style={{ color: "var(--fg-muted)" }}>
                      {r.email}{r.role !== "student" ? ` · ${r.role}` : ""}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums">{formatCredits(r.balance)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCredits(r.purchased)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCredits(r.welcome)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCredits(r.consumed)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--ink-700)" }}>{fmtDateTime(r.last_activity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))} totalCount={totalCount} pageSize={PAGE_SIZE} />
    </AdminShell>
  );
}
