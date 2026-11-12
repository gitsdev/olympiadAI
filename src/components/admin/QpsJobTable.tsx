import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { OABadge } from "@/components/ui";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./EmptyState";
import { bucketOf, estimateCostUsd, type QpsBucket } from "@/lib/admin/question-paper-stats";
import type { AdminQpsJobRow } from "@/lib/admin/question-paper";

const BUCKET_BADGE: Record<QpsBucket, { tone: "green" | "cobalt" | "red" | "amber" | "neutral"; label: string }> = {
  completed: { tone: "green", label: "Completed" },
  processing: { tone: "cobalt", label: "Processing" },
  failed: { tone: "red", label: "Failed" },
  rejected: { tone: "amber", label: "Rejected" },
  abandoned: { tone: "neutral", label: "Abandoned" },
};

export function QpsStatusBadge({ status, startedAt }: { status: string; startedAt: string | null }) {
  const b = BUCKET_BADGE[bucketOf({ status, started_at: startedAt })];
  return <OABadge tone={b.tone}>{b.label}</OABadge>;
}

export function formatUsd(n: number | null): string {
  if (n === null) return "—";
  return n < 0.01 && n > 0 ? "<$0.01" : `$${n.toFixed(2)}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 0) return "—";
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function QpsJobTable({ rows }: { rows: AdminQpsJobRow[] }) {
  if (rows.length === 0) {
    return <EmptyState Icon={FileCheck2} title="No question papers in this period" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Paper</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Questions</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Est. cost</TableHead>
          <TableHead>Uploaded</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <div className="font-semibold" style={{ color: "var(--ink-900)" }}>{r.user_name}</div>
              <div className="text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>{r.user_email}</div>
            </TableCell>
            <TableCell className="max-w-[260px]">
              <Link href={`/admin/question-paper-solver/${r.id}`} className="font-semibold hover:underline block truncate" style={{ color: "var(--ink-900)" }} title={r.file_name}>
                {r.file_name}
              </Link>
              <div className="text-[11.5px] truncate" style={{ color: "var(--fg-subtle)" }}>
                {[
                  r.file_ext === "docx" ? "Word" : r.is_scanned ? "Scanned PDF" : "PDF",
                  r.page_count ? `${r.page_count} pp` : null,
                  r.subject,
                  r.class_level ? `Class ${r.class_level}` : null,
                ].filter(Boolean).join(" · ")}
              </div>
            </TableCell>
            <TableCell>
              <QpsStatusBadge status={r.status} startedAt={r.started_at} />
              {r.last_error && (r.status === "failed") && (
                <div className="text-[11px] mt-1 max-w-[220px] truncate" style={{ color: "var(--danger-tx)" }} title={r.last_error}>{r.last_error}</div>
              )}
            </TableCell>
            <TableCell>
              {r.total_questions || "—"}
              {r.flagged_questions > 0 && (
                <span className="text-[11.5px] ml-1" style={{ color: "var(--warning-tx)" }}>({r.flagged_questions} flagged)</span>
              )}
            </TableCell>
            <TableCell>{duration(r.started_at, r.completed_at)}</TableCell>
            <TableCell>{formatUsd(estimateCostUsd(r.ai_model, r.ai_input_tokens, r.ai_output_tokens))}</TableCell>
            <TableCell>{formatDateTime(r.created_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
