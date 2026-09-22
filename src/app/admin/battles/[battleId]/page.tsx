import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getBattleDetail } from "@/lib/admin/battles";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { OACard, OACardHeader, OACardTitle, OABadge } from "@/components/ui";
import { Target, Trophy, CheckCircle2, XCircle, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ battleId: string }>;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function BattleDetailPage({ params }: PageProps) {
  const admin = await requireAdmin();
  const { battleId } = await params;
  const detail = await getBattleDetail(battleId);
  if (!detail) notFound();

  const { battle, studentName, studentId, humanParticipant, aiParticipant, questions } = detail;

  return (
    <AdminShell adminName={admin.fullName} title={`${battle.subject} Battle`} subtitle={`${studentName} vs AI opponent`}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link href={`/admin/students/${studentId}`} className="text-[13px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
            ← Back to {studentName}&apos;s profile
          </Link>
          <div className="flex items-center gap-2">
            <OABadge tone={battle.status === "completed" ? "green" : battle.status === "cancelled" ? "neutral" : "amber"}>
              {battle.status}
            </OABadge>
            {humanParticipant.result && (
              <OABadge tone={humanParticipant.result === "win" ? "green" : humanParticipant.result === "draw" ? "amber" : "neutral"}>
                {humanParticipant.result}
              </OABadge>
            )}
          </div>
        </div>

        <OACard>
          <OACardHeader><OACardTitle>Battle Information</OACardTitle></OACardHeader>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
            <div><span style={{ color: "var(--fg-muted)" }}>Subject</span><p className="font-semibold" style={{ color: "var(--ink-900)" }}>{battle.subject}</p></div>
            <div><span style={{ color: "var(--fg-muted)" }}>Difficulty</span><p className="font-semibold" style={{ color: "var(--ink-900)" }}>{battle.difficulty}</p></div>
            <div><span style={{ color: "var(--fg-muted)" }}>Started</span><p className="font-semibold" style={{ color: "var(--ink-900)" }}>{formatDateTime(battle.started_at)}</p></div>
            <div><span style={{ color: "var(--fg-muted)" }}>Completed</span><p className="font-semibold" style={{ color: "var(--ink-900)" }}>{formatDateTime(battle.completed_at)}</p></div>
          </div>
        </OACard>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Student Score" value={String(humanParticipant.score)} Icon={Target} />
          <StatCard label="AI Score" value={aiParticipant ? String(aiParticipant.score) : "—"} Icon={Trophy} />
          <StatCard label="Correct" value={String(humanParticipant.correct_count)} Icon={CheckCircle2} />
          <StatCard label="Incorrect" value={String(humanParticipant.incorrect_count)} Icon={XCircle} />
          <StatCard
            label="Rating Change"
            value={humanParticipant.rating_delta !== null ? `${humanParticipant.rating_delta >= 0 ? "+" : ""}${humanParticipant.rating_delta}` : "—"}
            Icon={TrendingUp}
          />
        </div>

        <OACard>
          <OACardHeader><OACardTitle>Question-Level Analysis</OACardTitle></OACardHeader>
          <ol className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <li key={q.id} className="rounded-[var(--r-lg)] border p-4" style={{ borderColor: "var(--line-200)" }}>
                <p className="text-[13.5px] font-medium mb-2.5" style={{ color: "var(--ink-900)" }}>
                  <span style={{ color: "var(--fg-muted)" }}>Q{i + 1}.</span> {q.question_text}
                </p>
                <div className="grid sm:grid-cols-2 gap-1.5 mb-2">
                  {[...q.options].sort((a, b) => a.index - b.index).map((opt) => {
                    const isCorrectOption = opt.index === q.correct_option_index;
                    const studentPicked = opt.index === q.humanAnswer?.selected_option_index;
                    const aiPicked = opt.index === q.aiAnswer?.selected_option_index;
                    return (
                      <div
                        key={opt.index}
                        className="text-[12.5px] px-2.5 py-1.5 rounded-[var(--r-sm)] border"
                        style={{
                          borderColor: isCorrectOption ? "var(--success)" : (studentPicked || aiPicked) ? "var(--danger)" : "var(--line-200)",
                          background: isCorrectOption ? "var(--success-bg)" : (studentPicked || aiPicked) ? "var(--danger-bg)" : "transparent",
                          color: isCorrectOption ? "var(--success-tx)" : (studentPicked || aiPicked) ? "var(--danger-tx)" : "var(--ink-700)",
                        }}
                      >
                        {opt.text}
                        {studentPicked && " · Student"}
                        {aiPicked && " · AI"}
                        {isCorrectOption && !studentPicked && !aiPicked && " · Correct"}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>
                  <span>{q.difficulty} · {q.topic_name ?? battle.subject}</span>
                  <span>Student {q.humanAnswer?.time_taken_seconds ?? "—"}s · AI {q.aiAnswer?.time_taken_seconds ?? "—"}s</span>
                </div>
              </li>
            ))}
          </ol>
        </OACard>
      </div>
    </AdminShell>
  );
}
