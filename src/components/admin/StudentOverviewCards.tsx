import { FileText, Target, Trophy, Sparkles, ListChecks, Clock, Gauge } from "lucide-react";
import { StatCard } from "./StatCard";
import type { AdminStudentStats } from "@/types/admin";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${(mins / 60).toFixed(1)} hr`;
}

export function StudentOverviewCards({ stats }: { stats: AdminStudentStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Overall Progress" value={`${Math.round(stats.overall_progress)}%`} Icon={Gauge} hint="Avg. topic mastery" />
      <StatCard label="Mock Tests" value={String(stats.mock_tests_taken)} Icon={FileText} />
      <StatCard label="Average Score" value={stats.mock_tests_taken > 0 ? `${stats.avg_score.toFixed(0)}%` : "—"} Icon={Target} />
      <StatCard label="Best Score" value={stats.mock_tests_taken > 0 ? `${stats.best_score.toFixed(0)}%` : "—"} Icon={Trophy} />
      <StatCard label="AI Tutor Sessions" value={String(stats.ai_sessions)} Icon={Sparkles} />
      <StatCard label="Questions Attempted" value={String(stats.questions_attempted)} Icon={ListChecks} />
      <StatCard
        label="Test Time"
        value={stats.total_test_time_seconds > 0 ? formatDuration(stats.total_test_time_seconds) : "—"}
        Icon={Clock}
        hint="Time spent in tests/practice only"
      />
    </div>
  );
}
