import { requireAdmin } from "@/lib/admin/auth";
import { listAiTutorUsage, getAiTutorAnalytics } from "@/lib/admin/ai-tutor";
import { getActivitySeries } from "@/lib/admin/dashboard";
import { resolveDateRange } from "@/lib/admin/date-range";
import { parsePage, ADMIN_PAGE_SIZE, totalPages } from "@/lib/admin/pagination";
import { AdminShell } from "@/components/admin/AdminShell";
import { AITutorUsageTable } from "@/components/admin/AITutorUsageTable";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { TrendChart } from "@/components/admin/TrendChart";
import { StatCard } from "@/components/admin/StatCard";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { Sparkles, Users, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminAiTutorPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const { from, to } = resolveDateRange(sp);

  const [{ rows, totalCount }, analytics, series] = await Promise.all([
    listAiTutorUsage(sp.q, sp.sort, page),
    getAiTutorAnalytics(from, to),
    getActivitySeries(from, to),
  ]);

  const totalSessionsInRange = analytics.reduce((sum, a) => sum + a.session_count, 0);
  const totalMessages = rows.reduce((sum, r) => sum + r.messages, 0);

  return (
    <AdminShell adminName={admin.fullName} title="AI Tutor" subtitle="Usage and engagement across the platform">
      <div className="flex flex-col gap-5">
        <DateRangeFilter />

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Sessions in period" value={String(totalSessionsInRange)} Icon={Sparkles} />
          <StatCard label="Students using AI Tutor (all-time)" value={String(totalCount)} Icon={Users} />
          <StatCard label="Messages (this page)" value={String(totalMessages)} Icon={MessageSquare} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <OACard>
            <OACardHeader><OACardTitle>Usage Trend</OACardTitle></OACardHeader>
            <TrendChart
              data={series.map((s) => ({ x: s.day, y: s.ai_sessions }))}
              formatX={(x) => new Date(x).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              formatY={(y) => `${y} session${y === 1 ? "" : "s"}`}
              emptyLabel="No AI Tutor sessions in this period"
            />
          </OACard>
          <OACard>
            <OACardHeader><OACardTitle>Most Asked Subjects</OACardTitle></OACardHeader>
            {analytics.length === 0 ? (
              <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>No sessions in this period.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {analytics.map((a) => (
                  <li key={a.subject} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: "var(--ink-900)" }}>{a.subject}</span>
                    <span style={{ color: "var(--fg-muted)" }}>{a.session_count} session{a.session_count === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            )}
          </OACard>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SearchInput placeholder="Search by student name or email…" />
        </div>

        <div className="rounded-[var(--r-lg)] border overflow-hidden" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
          <AITutorUsageTable rows={rows} />
        </div>

        <Pagination page={page} totalPages={totalPages(totalCount)} totalCount={totalCount} pageSize={ADMIN_PAGE_SIZE} />
      </div>
    </AdminShell>
  );
}
