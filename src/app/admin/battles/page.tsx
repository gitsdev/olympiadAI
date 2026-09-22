import { requireAdmin } from "@/lib/admin/auth";
import { listBattles } from "@/lib/admin/battles";
import { parsePage, ADMIN_PAGE_SIZE, totalPages } from "@/lib/admin/pagination";
import { AdminShell } from "@/components/admin/AdminShell";
import { BattleTable } from "@/components/admin/BattleTable";
import { BattleFilters } from "@/components/admin/BattleFilters";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import type { AdminBattleFilters } from "@/types/admin";
import type { BattleStatus, BattleMode, BattleOutcome, Subject } from "@/types/database";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminBattlesPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const filters: AdminBattleFilters = {
    studentId: sp.q, // search box filters by exact student id — name search happens on the Students page
    status: sp.status as BattleStatus | undefined,
    mode: sp.mode as BattleMode | undefined,
    subject: sp.subject as Subject | undefined,
    classLevel: sp.class ? Number(sp.class) : undefined,
    result: sp.result as BattleOutcome | undefined,
    dateFrom: sp.from,
    dateTo: sp.to,
    sort: sp.sort,
  };

  const { rows, totalCount } = await listBattles(filters, page);

  return (
    <AdminShell adminName={admin.fullName} title="Battles" subtitle={`${totalCount} battle${totalCount === 1 ? "" : "s"}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SearchInput placeholder="Filter by student ID…" />
          <BattleFilters />
        </div>

        <div className="rounded-[var(--r-lg)] border overflow-hidden" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
          <BattleTable rows={rows} />
        </div>

        <Pagination page={page} totalPages={totalPages(totalCount)} totalCount={totalCount} pageSize={ADMIN_PAGE_SIZE} />
      </div>
    </AdminShell>
  );
}
