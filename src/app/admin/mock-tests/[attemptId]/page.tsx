import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getAttemptDetail } from "@/lib/admin/mock-tests";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { QuestionAnalysis } from "@/components/admin/QuestionAnalysis";
import { OACard, OACardHeader, OACardTitle, OABadge } from "@/components/ui";
import { Target, CheckCircle2, XCircle, MinusCircle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ attemptId: string }>;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export default async function MockTestAttemptPage({ params }: PageProps) {
  const admin = await requireAdmin();
  const { attemptId } = await params;
  const detail = await getAttemptDetail(attemptId);
  if (!detail) notFound();

  const { attempt, studentId, studentName, mockTest, answers } = detail;
  const unanswered = attempt.questions_attempted - answers.filter((a) => a.selected_option_index !== null).length;

  return (
    <AdminShell adminName={admin.fullName} title={mockTest?.title ?? `${attempt.subject} Practice`} subtitle={`Attempt by ${studentName}`}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link href={`/admin/students/${studentId}`} className="text-[13px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
            ← Back to {studentName}&apos;s profile
          </Link>
          <OABadge tone={attempt.completed_at ? "green" : "amber"}>{attempt.completed_at ? "Completed" : "Incomplete"}</OABadge>
        </div>

        <OACard>
          <OACardHeader><OACardTitle>Test Information</OACardTitle></OACardHeader>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
            <div><span style={{ color: "var(--fg-muted)" }}>Subject</span><p className="font-semibold" style={{ color: "var(--ink-900)" }}>{attempt.subject}</p></div>
            <div><span style={{ color: "var(--fg-muted)" }}>Topic</span><p className="font-semibold" style={{ color: "var(--ink-900)" }}>{attempt.topic_name ?? mockTest?.topic_name ?? "—"}</p></div>
            <div><span style={{ color: "var(--fg-muted)" }}>Started</span><p className="font-semibold" style={{ color: "var(--ink-900)" }}>{formatDateTime(attempt.started_at)}</p></div>
            <div><span style={{ color: "var(--fg-muted)" }}>Completed</span><p className="font-semibold" style={{ color: "var(--ink-900)" }}>{formatDateTime(attempt.completed_at)}</p></div>
          </div>
        </OACard>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Score" value={`${attempt.score.toFixed(0)}%`} Icon={Target} />
          <StatCard label="Correct" value={String(attempt.questions_correct)} Icon={CheckCircle2} />
          <StatCard label="Incorrect" value={String(attempt.questions_attempted - attempt.questions_correct - Math.max(unanswered, 0))} Icon={XCircle} />
          <StatCard label="Unanswered" value={String(Math.max(unanswered, 0))} Icon={MinusCircle} />
          <StatCard label="Time Taken" value={formatDuration(attempt.total_time_seconds)} Icon={Clock} />
        </div>

        <OACard>
          <OACardHeader><OACardTitle>Question-Level Analysis</OACardTitle></OACardHeader>
          <QuestionAnalysis answers={answers} />
        </OACard>
      </div>
    </AdminShell>
  );
}
