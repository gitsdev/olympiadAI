import Link from "next/link";
import { FileText } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { OABadge } from "@/components/ui";
import { EmptyState } from "./EmptyState";
import type { AdminTestAttemptRow, MockTestAttemptStatus } from "@/types/admin";

const STATUS_TONE: Record<MockTestAttemptStatus, "green" | "amber" | "neutral"> = {
  completed: "green",
  in_progress: "amber",
  abandoned: "neutral",
};
const STATUS_LABEL: Record<MockTestAttemptStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  abandoned: "Abandoned",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function MockTestTable({ rows, showStudent = true }: { rows: AdminTestAttemptRow[]; showStudent?: boolean }) {
  if (rows.length === 0) {
    return <EmptyState Icon={FileText} title="No mock tests match these filters" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showStudent && <TableHead>Student</TableHead>}
          <TableHead>Test</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Correct/Attempted</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.attempt_id}>
            {showStudent && (
              <TableCell>
                <Link href={`/admin/students/${r.student_id}`} className="font-medium hover:underline" style={{ color: "var(--ink-900)" }}>
                  {r.student_name}
                </Link>
              </TableCell>
            )}
            <TableCell>
              <Link href={`/admin/mock-tests/${r.attempt_id}`} className="font-medium hover:underline" style={{ color: "var(--ink-900)" }}>
                {r.test_title}
              </Link>
            </TableCell>
            <TableCell>{r.subject}</TableCell>
            <TableCell>Class {r.class_level}</TableCell>
            <TableCell>{formatDateTime(r.started_at)}</TableCell>
            <TableCell>{r.status === "completed" ? `${r.score.toFixed(0)}%` : "—"}</TableCell>
            <TableCell>{r.questions_correct}/{r.questions_attempted}</TableCell>
            <TableCell>{formatDuration(r.total_time_seconds)}</TableCell>
            <TableCell><OABadge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</OABadge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
