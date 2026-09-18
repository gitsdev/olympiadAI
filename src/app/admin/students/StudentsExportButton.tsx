"use client";

import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { exportStudentsCsv } from "@/actions/admin/export";
import type { AdminStudentFilters } from "@/types/admin";

export function StudentsExportButton({ filters }: { filters: AdminStudentFilters }) {
  return (
    <ExportCsvButton
      filename={`olympiadiq-students-${new Date().toISOString().slice(0, 10)}.csv`}
      onExport={() => exportStudentsCsv(filters)}
    />
  );
}
