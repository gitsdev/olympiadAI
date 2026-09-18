import Link from "next/link";
import { Users } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { OABadge, OAProgressBar } from "@/components/ui";
import { EmptyState } from "./EmptyState";
import { StudentRowActions } from "./StudentRowActions";
import type { AdminStudentListRow } from "@/types/admin";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isRecentlyActive(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 7 * 86_400_000;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function StudentTable({ rows }: { rows: AdminStudentListRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        Icon={Users}
        title="No students match these filters"
        description="Try widening your search or clearing a filter."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Registered</TableHead>
          <TableHead>Last Active</TableHead>
          <TableHead>Mock Tests</TableHead>
          <TableHead>Avg Score</TableHead>
          <TableHead>AI Sessions</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.student_id}>
            <TableCell>
              <Link href={`/admin/students/${r.student_id}`} className="font-semibold hover:underline" style={{ color: "var(--ink-900)" }}>
                {r.full_name}
              </Link>
              <div className="text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>{r.email}</div>
            </TableCell>
            <TableCell>{r.board} · Class {r.class_level}</TableCell>
            <TableCell>{formatDate(r.registered_at)}</TableCell>
            <TableCell>{formatRelative(r.last_active_at)}</TableCell>
            <TableCell>{r.mock_tests_taken}</TableCell>
            <TableCell>{r.mock_tests_taken > 0 ? `${r.avg_score.toFixed(0)}%` : "—"}</TableCell>
            <TableCell>{r.ai_sessions}</TableCell>
            <TableCell className="w-[110px]">
              <div className="flex items-center gap-2">
                <OAProgressBar value={r.overall_progress} height={6} className="w-16" />
                <span className="text-[11.5px] tabular-nums" style={{ color: "var(--fg-muted)" }}>{Math.round(r.overall_progress)}%</span>
              </div>
            </TableCell>
            <TableCell>
              {r.account_status === "suspended" ? (
                <OABadge tone="red">Suspended</OABadge>
              ) : isRecentlyActive(r.last_active_at) ? (
                <OABadge tone="green">Active</OABadge>
              ) : (
                <OABadge tone="neutral">Inactive</OABadge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <StudentRowActions studentId={r.student_id} status={r.account_status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
