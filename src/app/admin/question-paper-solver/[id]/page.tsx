import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileCheck2, ListChecks, Flag, Coins, Timer, RotateCcw } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getQpsJobDetail } from "@/lib/admin/question-paper";
import { estimateCostUsd } from "@/lib/admin/question-paper-stats";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { QpsStatusBadge, formatUsd } from "@/components/admin/QpsJobTable";
import { OABadge, OACard, OACardHeader, OACardTitle } from "@/components/ui";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { QUESTION_TYPE_LABELS, detailLevelLabel, examTypeLabel, formatBytes, type QuestionType } from "@/lib/question-paper/constants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Question Paper | OlympiadIQ Admin",
  description: "Processing details for one AI Question Paper Solver job.",
};

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
}

const LEVEL_TONE = { info: "neutral", warn: "amber", error: "red" } as const;

export default async function AdminQpsJobPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const detail = await getQpsJobDetail(id).catch(() => null);
  if (!detail) notFound();
  const { job, user, logs, questions, regenerations } = detail;

  const minutes = job.started_at && job.completed_at
    ? (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 60_000
    : null;
  const cost = estimateCostUsd(job.ai_model, job.ai_input_tokens, job.ai_output_tokens);
  const meta: Array<[string, string]> = [
    ["User", `${user.name}${user.email ? ` (${user.email})` : ""}`],
    ["File", `${job.file_ext === "docx" ? "Word" : job.is_scanned ? "Scanned PDF" : "PDF"} · ${formatBytes(job.file_size)}${job.page_count ? ` · ${job.page_count} pages` : ""}`],
    ["Class / board", `${job.class_level ? `Class ${job.class_level}` : "—"} · ${job.board ?? "—"}`],
    ["Subject / exam", `${job.subject ?? "—"} · ${examTypeLabel(job.exam_type)}`],
    ["Answer style", detailLevelLabel(job.detail_level)],
    ["Auto-detect", job.auto_detect ? "On" : "Off"],
    ["Model", job.ai_model ?? "—"],
    ["Uploaded", formatDateTime(job.created_at)],
    ["Started", formatDateTime(job.started_at)],
    ["Completed", formatDateTime(job.completed_at)],
    ["Source files", job.source_deleted_at ? `Deleted ${formatDateTime(job.source_deleted_at)} (retention)` : "Stored"],
  ];

  return (
    <AdminShell
      adminName={admin.fullName}
      title={job.file_name}
      subtitle="Question Paper Solver job"
      actions={
        <Link href="/admin/question-paper-solver" className="inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline" style={{ color: "var(--ink-700)" }}>
          <ArrowLeft size={15} /> All papers
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 flex-wrap">
          <QpsStatusBadge status={job.status} startedAt={job.started_at} />
          <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            {job.status} · stage {job.stage} · {job.progress}%
          </span>
        </div>
        {job.last_error && (
          <OACard className="text-[13px]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)", borderColor: "var(--danger)" }}>
            <strong>Shown to the user:</strong> {job.last_error}
          </OACard>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Questions" value={String(job.total_questions)} hint={`${job.solved_questions} processed`} Icon={ListChecks} />
          <StatCard label="Flagged" value={String(job.flagged_questions)} Icon={Flag} tone={job.flagged_questions ? "warning" : "default"} />
          <StatCard label="Processing time" value={minutes === null ? "—" : `${minutes.toFixed(1)} min`} Icon={Timer} />
          <StatCard label="Est. AI cost" value={formatUsd(cost)} hint={`${job.ai_input_tokens.toLocaleString("en-IN")} in · ${job.ai_output_tokens.toLocaleString("en-IN")} out`} Icon={Coins} />
          <StatCard label="Regenerations" value={String(regenerations.answers + regenerations.sheets)} hint={`${regenerations.answers} answers · ${regenerations.sheets} sheets`} Icon={RotateCcw} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <OACard>
            <OACardHeader><OACardTitle>Details</OACardTitle></OACardHeader>
            <dl className="grid grid-cols-[130px_1fr] gap-y-2 text-[13px]">
              {meta.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt style={{ color: "var(--fg-muted)" }}>{k}</dt>
                  <dd className="break-words" style={{ color: "var(--ink-900)" }}>{v}</dd>
                </div>
              ))}
            </dl>
          </OACard>

          <OACard>
            <OACardHeader><OACardTitle>Event log</OACardTitle></OACardHeader>
            {logs.length === 0 ? (
              <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>No events recorded.</p>
            ) : (
              <ol className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                {logs.map((l) => (
                  <li key={l.id} className="text-[12.5px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <OABadge tone={LEVEL_TONE[l.level as keyof typeof LEVEL_TONE] ?? "neutral"}>{l.level}</OABadge>
                      <code className="font-semibold" style={{ color: "var(--ink-900)" }}>{l.event}</code>
                      <span style={{ color: "var(--fg-subtle)" }}>{formatDateTime(l.created_at)}</span>
                    </div>
                    {l.detail && Object.keys(l.detail).length > 0 && (
                      <pre className="mt-1 text-[11.5px] whitespace-pre-wrap break-words rounded-[var(--r-sm)] p-2" style={{ background: "var(--fill-100)", color: "var(--ink-700)" }}>
                        {JSON.stringify(l.detail, null, 1)}
                      </pre>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </OACard>
        </div>

        <OACard noPadding>
          <div className="px-5 pt-4 pb-3"><OACardTitle>Questions</OACardTitle></div>
          {questions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10" style={{ color: "var(--fg-muted)" }}>
              <FileCheck2 size={22} />
              <p className="text-[13px]">No questions were extracted.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Answer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-semibold whitespace-nowrap">{q.number_label}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{q.section ?? "—"}</TableCell>
                    <TableCell>{QUESTION_TYPE_LABELS[q.type as QuestionType] ?? q.type}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={q.answer_short ?? ""}>{q.answer_short ?? "—"}</TableCell>
                    <TableCell>
                      <OABadge tone={q.answer_status === "answered" ? "green" : q.answer_status === "pending" ? "cobalt" : "red"}>
                        {q.answer_status.replace("_", " ")}
                      </OABadge>
                      {q.edited_by_user && <span className="text-[11px] ml-1" style={{ color: "var(--fg-subtle)" }}>edited</span>}
                      {q.regen_count > 0 && <span className="text-[11px] ml-1" style={{ color: "var(--fg-subtle)" }}>×{q.regen_count} regen</span>}
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      {q.needs_review ? (
                        <span className="text-[12px]" style={{ color: "var(--warning-tx)" }} title={q.review_reason ?? ""}>
                          ⚑ {q.review_source}: {(q.review_reason ?? "").slice(0, 90)}{(q.review_reason ?? "").length > 90 ? "…" : ""}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </OACard>
      </div>
    </AdminShell>
  );
}
