import { requireAdmin } from "@/lib/admin/auth";
import { listTestAttempts } from "@/lib/admin/mock-tests";
import { parsePage, ADMIN_PAGE_SIZE, totalPages } from "@/lib/admin/pagination";
import { AdminShell } from "@/components/admin/AdminShell";
import { MockTestTable } from "@/components/admin/MockTestTable";
import { MockTestFilters } from "@/components/admin/MockTestFilters";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { MockTestsExportButton } from "./MockTestsExportButton";
import type { AdminTestAttemptFilters, MockTestAttemptStatus } from "@/types/admin";
import type { Subject } from "@/types/database";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminMockTestsPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const filters: AdminTestAttemptFilters = {
    studentId: sp.q, // search box here filters by exact student id; name search happens on Students page
    classLevel: sp.class ? Number(sp.class) : undefined,
    subject: sp.subject as Subject | undefined,
    status: sp.status as MockTestAttemptStatus | undefined,
    dateFrom: sp.from,
    dateTo: sp.to,
    sort: sp.sort,
  };

  const { rows, totalCount } = await listTestAttempts(filters, page);

  return (
    <AdminShell
      adminName={admin.fullName}
      title="Mock Tests"
      subtitle={`${totalCount} attempt${totalCount === 1 ? "" : "s"}`}
      actions={<MockTestsExportButton filters={filters} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SearchInput placeholder="Filter by student ID…" />
          <MockTestFilters />
        </div>

        <div className="rounded-[var(--r-lg)] border overflow-hidden" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
          <MockTestTable rows={rows} />
        </div>

        <Pagination page={page} totalPages={totalPages(totalCount)} totalCount={totalCount} pageSize={ADMIN_PAGE_SIZE} />
      </div>
    </AdminShell>
  );
}
