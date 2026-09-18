import { requireAdmin } from "@/lib/admin/auth";
import { listStudents } from "@/lib/admin/students";
import { parsePage, ADMIN_PAGE_SIZE, totalPages } from "@/lib/admin/pagination";
import { parseTestCountFilter } from "@/components/admin/StudentFilters";
import { AdminShell } from "@/components/admin/AdminShell";
import { StudentTable } from "@/components/admin/StudentTable";
import { StudentFilters } from "@/components/admin/StudentFilters";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { StudentsExportButton } from "./StudentsExportButton";
import type { AdminStudentFilters } from "@/types/admin";
import type { Board, StudentAccountStatus } from "@/types/database";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminStudentsPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const { min: testCountMin, max: testCountMax } = parseTestCountFilter(sp.tests);

  const filters: AdminStudentFilters = {
    q: sp.q,
    classLevel: sp.class ? Number(sp.class) : undefined,
    board: sp.board as Board | undefined,
    status: sp.status as StudentAccountStatus | undefined,
    activity: sp.activity as AdminStudentFilters["activity"],
    registeredFrom: sp.regFrom,
    registeredTo: sp.regTo,
    testCountMin,
    testCountMax,
    sort: sp.sort,
  };

  const { rows, totalCount } = await listStudents(filters, page);

  return (
    <AdminShell
      adminName={admin.fullName}
      title="Students"
      subtitle={`${totalCount} student${totalCount === 1 ? "" : "s"}`}
      actions={<StudentsExportButton filters={filters} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SearchInput placeholder="Search by name, email, or ID…" />
          <StudentFilters />
        </div>

        <div className="rounded-[var(--r-lg)] border overflow-hidden" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
          <StudentTable rows={rows} />
        </div>

        <Pagination page={page} totalPages={totalPages(totalCount)} totalCount={totalCount} pageSize={ADMIN_PAGE_SIZE} />
      </div>
    </AdminShell>
  );
}
