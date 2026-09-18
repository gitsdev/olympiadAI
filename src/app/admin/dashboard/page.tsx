import Link from "next/link";
import { Users, UserCheck, FileText, Target, Sparkles, AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getDashboardStats, getActivitySeries, getPlatformSubjectPerformance, getStudentsNeedingAttention } from "@/lib/admin/dashboard";
import { getAdminSettings } from "@/lib/admin/settings";
import { resolveDateRange } from "@/lib/admin/date-range";
import { AdminShell } from "@/components/admin/AdminShell";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { StatCard } from "@/components/admin/StatCard";
import { TrendChart } from "@/components/admin/TrendChart";
import { PlatformSubjectPerformance } from "@/components/admin/SubjectProgress";
import { AttentionStudentsTable } from "@/components/admin/AttentionStudentsTable";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const { from, to, label } = resolveDateRange(sp);
  const settings = await getAdminSettings();

  const [stats, series, subjectPerf, attention] = await Promise.all([
    getDashboardStats(from, to),
    getActivitySeries(from, to),
    getPlatformSubjectPerformance(from, to),
    getStudentsNeedingAttention(settings.inactive_days_warning, settings.low_score_threshold, settings.low_ai_engagement_sessions, 1),
  ]);

  const formatDay = (x: string) => new Date(x).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <AdminShell adminName={admin.fullName} title="Dashboard" subtitle={`OlympiadIQ platform overview — ${label}`}>
      <div className="flex flex-col gap-5">
        <DateRangeFilter />

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Total Students" value={stats.total_students.toLocaleString()} Icon={Users} />
          <StatCard label="Active Students" value={stats.active_students.toLocaleString()} Icon={UserCheck} hint={label} />
          <StatCard label="Mock Tests Taken" value={stats.mock_tests_taken.toLocaleString()} Icon={FileText} hint={label} />
          <StatCard label="Avg Mock Test Score" value={stats.mock_tests_taken > 0 ? `${stats.avg_score.toFixed(0)}%` : "—"} Icon={Target} />
          <StatCard label="AI Tutor Sessions" value={stats.ai_sessions.toLocaleString()} Icon={Sparkles} hint={label} />
          <StatCard
            label="Needing Attention"
            value={String(attention.totalCount)}
            Icon={AlertTriangle}
            tone={attention.totalCount > 0 ? "warning" : "default"}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <OACard>
            <OACardHeader><OACardTitle>Student Registrations</OACardTitle></OACardHeader>
            <TrendChart data={series.map((s) => ({ x: s.day, y: s.registrations }))} formatX={formatDay} formatY={(y) => `${y} new`} variant="bar" />
          </OACard>
          <OACard>
            <OACardHeader><OACardTitle>Student Activity</OACardTitle></OACardHeader>
            <TrendChart data={series.map((s) => ({ x: s.day, y: s.active_students }))} formatX={formatDay} formatY={(y) => `${y} active`} />
          </OACard>
          <OACard>
            <OACardHeader><OACardTitle>Mock Test Activity</OACardTitle></OACardHeader>
            <TrendChart data={series.map((s) => ({ x: s.day, y: s.mock_tests }))} formatX={formatDay} formatY={(y) => `${y} tests`} variant="bar" />
          </OACard>
          <OACard>
            <OACardHeader><OACardTitle>Mock Test Performance</OACardTitle></OACardHeader>
            <TrendChart data={series.map((s) => ({ x: s.day, y: Math.round(s.avg_score) }))} formatX={formatDay} formatY={(y) => `${y}%`} />
          </OACard>
          <OACard>
            <OACardHeader><OACardTitle>AI Tutor Usage</OACardTitle></OACardHeader>
            <TrendChart data={series.map((s) => ({ x: s.day, y: s.ai_sessions }))} formatX={formatDay} formatY={(y) => `${y} sessions`} />
          </OACard>
          <OACard>
            <OACardHeader><OACardTitle>Subject Performance</OACardTitle></OACardHeader>
            <PlatformSubjectPerformance rows={subjectPerf} />
          </OACard>
        </div>

        <OACard>
          <OACardHeader className="flex-wrap gap-2">
            <OACardTitle>Students Needing Attention</OACardTitle>
            <Link href="/admin/progress" className="text-[12.5px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
              View all →
            </Link>
          </OACardHeader>
          <AttentionStudentsTable rows={attention.rows.slice(0, 5)} />
        </OACard>
      </div>
    </AdminShell>
  );
}
