import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./EmptyState";
import type { AdminAiTutorUsageRow } from "@/types/admin";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function AITutorUsageTable({ rows }: { rows: AdminAiTutorUsageRow[] }) {
  if (rows.length === 0) {
    return <EmptyState Icon={Sparkles} title="No AI Tutor usage yet" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Sessions</TableHead>
          <TableHead>Messages</TableHead>
          <TableHead>Subjects Discussed</TableHead>
          <TableHead>Last Session</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.student_id}>
            <TableCell>
              <Link href={`/admin/students/${r.student_id}`} className="font-semibold hover:underline" style={{ color: "var(--ink-900)" }}>
                {r.student_name}
              </Link>
              <div className="text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>{r.email}</div>
            </TableCell>
            <TableCell>{r.sessions}</TableCell>
            <TableCell>{r.messages}</TableCell>
            <TableCell>{r.subjects.length > 0 ? r.subjects.join(", ") : "—"}</TableCell>
            <TableCell>{formatDateTime(r.last_session_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
