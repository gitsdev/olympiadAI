"use client";

import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { exportMockTestsCsv } from "@/actions/admin/export";
import type { AdminTestAttemptFilters } from "@/types/admin";

export function MockTestsExportButton({ filters }: { filters: AdminTestAttemptFilters }) {
  return (
    <ExportCsvButton
      filename={`olympiadiq-mock-tests-${new Date().toISOString().slice(0, 10)}.csv`}
      onExport={() => exportMockTestsCsv(filters)}
    />
  );
}
