import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { OABadge } from "@/components/ui";
import { EmptyState } from "./EmptyState";
import type { AdminAttentionStudentRow } from "@/types/admin";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function AttentionStudentsTable({ rows }: { rows: AdminAttentionStudentRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        Icon={CheckCircle2}
        title="No students need attention right now"
        description="Everyone is within the configured activity and performance thresholds."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Last Active</TableHead>
          <TableHead>Last Mock Test</TableHead>
          <TableHead>Avg Score</TableHead>
          <TableHead>AI Sessions</TableHead>
          <TableHead>Reasons</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.student_id}>
            <TableCell>
              <Link href={`/admin/students/${r.student_id}`} className="font-semibold hover:underline" style={{ color: "var(--ink-900)" }}>
                {r.full_name}
              </Link>
              <div className="text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>Class {r.class_level}</div>
            </TableCell>
            <TableCell>{r.days_since_active === null ? "Never" : `${r.days_since_active}d ago`}</TableCell>
            <TableCell>{formatDate(r.last_mock_test_at)}</TableCell>
            <TableCell>{r.avg_score > 0 ? `${r.avg_score.toFixed(0)}%` : "—"}</TableCell>
            <TableCell>{r.ai_sessions}</TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                {r.reasons.map((reason) => <OABadge key={reason} tone="amber" className="w-fit">{reason}</OABadge>)}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
