import Link from "next/link";
import { Swords } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { OABadge } from "@/components/ui";
import { EmptyState } from "./EmptyState";
import type { AdminBattleRow } from "@/types/admin";
import type { BattleOutcome, BattleStatus } from "@/types/database";

const STATUS_TONE: Record<BattleStatus, "green" | "amber" | "neutral" | "red"> = {
  pending: "amber", active: "amber", completed: "green", cancelled: "neutral",
};
const RESULT_TONE: Record<BattleOutcome, "green" | "amber" | "neutral"> = {
  win: "green", loss: "neutral", draw: "amber",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function BattleTable({ rows }: { rows: AdminBattleRow[] }) {
  if (rows.length === 0) {
    return <EmptyState Icon={Swords} title="No battles match these filters" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Mode</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Difficulty</TableHead>
          <TableHead>Score (You–AI)</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Rating Δ</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.battle_id}>
            <TableCell>
              <Link href={`/admin/students/${r.student_id}`} className="font-medium hover:underline" style={{ color: "var(--ink-900)" }}>
                {r.student_name}
              </Link>
            </TableCell>
            <TableCell className="capitalize">{r.mode.replace("_", " ")}</TableCell>
            <TableCell>{r.subject}</TableCell>
            <TableCell>Class {r.class_level}</TableCell>
            <TableCell>{r.difficulty}</TableCell>
            <TableCell>
              <Link href={`/admin/battles/${r.battle_id}`} className="hover:underline" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}>
                {r.student_score} – {r.ai_score ?? "–"}
              </Link>
            </TableCell>
            <TableCell>{r.result ? <OABadge tone={RESULT_TONE[r.result]}>{r.result}</OABadge> : "—"}</TableCell>
            <TableCell style={{ fontFamily: "var(--font-mono)" }}>
              {r.rating_delta !== null ? `${r.rating_delta >= 0 ? "+" : ""}${r.rating_delta}` : "—"}
            </TableCell>
            <TableCell><OABadge tone={STATUS_TONE[r.status]}>{r.status}</OABadge></TableCell>
            <TableCell>{formatDateTime(r.started_at ?? r.created_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
