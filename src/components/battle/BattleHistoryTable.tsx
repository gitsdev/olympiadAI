"use client";

import Link from "next/link";
import { Swords } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  OACard, OASubjectDot,
} from "@/components/ui";
import type { BattleHistoryItem } from "@/lib/battle/battle-data";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function wonBy(b: BattleHistoryItem, studentName: string): string {
  if (b.result === "win") return studentName;
  if (b.result === "loss") return b.opponentName;
  if (b.result === "draw") return "Draw";
  return "—";
}

interface BattleHistoryTableProps {
  history: BattleHistoryItem[];
  studentName: string;
}

export function BattleHistoryTable({ history, studentName }: BattleHistoryTableProps) {
  if (history.length === 0) {
    return (
      <OACard style={{ padding: "18px 20px", textAlign: "center" }}>
        <Swords size={26} style={{ color: "var(--fg-subtle)", margin: "0 auto 8px" }} />
        <p className="text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
          No battles yet — head to Battle AI or Challenge a Friend to fight your first one.
        </p>
      </OACard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <OACard noPadding className="overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>My Score</TableHead>
              <TableHead>Opponent Score</TableHead>
              <TableHead>Won By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((b) => (
              <TableRow key={b.battleId}>
                <TableCell>{formatDate(b.completedAt ?? b.createdAt)}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <OASubjectDot subject={b.subject} size={8} />
                    {b.subject}
                  </span>
                </TableCell>
                <TableCell>{b.questionCount}</TableCell>
                <TableCell style={{ fontFamily: "var(--font-mono)" }}>{b.studentScore}</TableCell>
                <TableCell style={{ fontFamily: "var(--font-mono)" }}>{b.opponentScore ?? "—"}</TableCell>
                <TableCell className="font-semibold">{wonBy(b, studentName)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </OACard>

      <Link href="/battle/history" className="text-[13px] font-medium text-center hover:underline" style={{ color: "var(--brand)" }}>
        View full battle history →
      </Link>
    </div>
  );
}
