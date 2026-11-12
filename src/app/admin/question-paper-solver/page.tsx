import { requireAdmin } from "@/lib/admin/auth";
import { getQpsOverview, listQpsJobs } from "@/lib/admin/question-paper";
import { resolveDateRange } from "@/lib/admin/date-range";
import { parsePage, ADMIN_PAGE_SIZE, totalPages } from "@/lib/admin/pagination";
import { AdminShell } from "@/components/admin/AdminShell";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { StatCard } from "@/components/admin/StatCard";
import { TrendChart } from "@/components/admin/TrendChart";
import { BreakdownList } from "@/components/admin/BreakdownList";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { QpsStatusFilter } from "@/components/admin/QpsStatusFilter";
import { QpsJobTable, formatUsd } from "@/components/admin/QpsJobTable";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import {
  FileCheck2, Users, CheckCircle2, ListChecks, Flag, Timer, RotateCcw, Coins, Database, AlertTriangle,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Question Paper Solver | OlympiadIQ Admin",
  description: "Usage, outcomes and AI cost of the AI Question Paper Solver.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const compact = (n: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** True when migration 019 hasn't been applied yet. */
function isSchemaMissing(err: unknown): boolean {
  const m = (err as Error)?.message ?? "";
  return /qps_|does not exist|schema cache/i.test(m);
}

export default async function AdminQuestionPaperSolverPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const { from, to, label } = resolveDateRange(sp);

  let overview: Awaited<ReturnType<typeof getQpsOverview>>;
  let jobs: Awaited<ReturnType<typeof listQpsJobs>>;
  try {
    [overview, jobs] = await Promise.all([
      getQpsOverview(from, to),
      listQpsJobs({ q: sp.q, status: sp.status, page, from, to }),
    ]);
  } catch (err) {
    if (!isSchemaMissing(err)) throw err;
    return (
      <AdminShell adminName={admin.fullName} title="Question Paper Solver" subtitle="Usage, outcomes and AI cost">
        <OACard className="flex items-start gap-3">
          <Database size={20} style={{ color: "var(--warning-tx)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="font-semibold text-[14px]" style={{ color: "var(--ink-900)" }}>The Question Paper Solver tables don&apos;t exist yet</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--ink-700)" }}>
              Run <code>supabase/migrations/019_question_paper_solver.sql</code> in the Supabase SQL editor, then reload this page.
            </p>
          </div>
        </OACard>
      </AdminShell>
    );
  }

  const { buckets } = overview;
  const problems = buckets.failed + buckets.rejected;

  return (
    <AdminShell adminName={admin.fullName} title="Question Paper Solver" subtitle="Usage, outcomes and AI cost">
      <div className="flex flex-col gap-5">
        <DateRangeFilter />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Papers submitted" value={String(overview.submitted)} hint={`${label} · ${overview.pages} pages`} Icon={FileCheck2} />
          <StatCard label="Unique users" value={String(overview.uniqueUsers)} hint="Submitted at least one paper" Icon={Users} />
          <StatCard
            label="Completion rate"
            value={pct(overview.successRate)}
            hint={`${buckets.completed} completed · ${buckets.failed} failed${buckets.processing ? ` · ${buckets.processing} running` : ""}`}
            Icon={CheckCircle2}
            tone={overview.successRate !== null && overview.successRate < 0.9 ? "warning" : "default"}
          />
          <StatCard
            label="Upload problems"
            value={String(problems + buckets.abandoned)}
            hint={`${buckets.rejected} rejected · ${buckets.abandoned} abandoned`}
            Icon={AlertTriangle}
            tone={problems > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Questions solved"
            value={String(overview.questions)}
            hint={overview.avgQuestionsPerPaper !== null ? `${overview.avgQuestionsPerPaper.toFixed(1)} per paper` : "—"}
            Icon={ListChecks}
          />
          <StatCard label="Flagged for review" value={pct(overview.flaggedRate)} hint={`${overview.flagged} questions`} Icon={Flag} />
          <StatCard
            label="Median processing time"
            value={overview.medianMinutes === null ? "—" : `${overview.medianMinutes.toFixed(1)} min`}
            hint="Upload accepted → sheet ready"
            Icon={Timer}
          />
          <StatCard
            label="Regenerations"
            value={String(overview.regenerations.answers + overview.regenerations.sheets)}
            hint={`${overview.regenerations.answers} answers · ${overview.regenerations.sheets} full sheets`}
            Icon={RotateCcw}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <OACard className="lg:col-span-2">
            <OACardHeader><OACardTitle>Papers per day</OACardTitle></OACardHeader>
            <TrendChart
              data={overview.series.map((s) => ({ x: s.day, y: s.papers }))}
              xFormat="day"
              yFormat="count"
              variant="bar"
              emptyLabel="No papers submitted in this period"
            />
          </OACard>
          <OACard>
            <OACardHeader><OACardTitle>AI usage</OACardTitle></OACardHeader>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-[var(--r-md)] flex items-center justify-center" style={{ background: "var(--gold-50)" }}>
                <Coins size={17} style={{ color: "var(--gold-700)" }} />
              </span>
              <div>
                <p className="font-black text-[24px] leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
                  {formatUsd(overview.estimatedCostUsd)}
                </p>
                <p className="text-[11.5px] mt-1" style={{ color: "var(--fg-muted)" }}>Estimated spend · {label}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
              <dt style={{ color: "var(--fg-muted)" }}>Input tokens</dt><dd className="text-right tabular-nums">{compact(overview.inputTokens)}</dd>
              <dt style={{ color: "var(--fg-muted)" }}>Output tokens</dt><dd className="text-right tabular-nums">{compact(overview.outputTokens)}</dd>
              <dt style={{ color: "var(--fg-muted)" }}>Per completed paper</dt><dd className="text-right tabular-nums">{formatUsd(overview.costPerPaperUsd)}</dd>
            </dl>
            <p className="text-[11px] mt-3 leading-snug" style={{ color: "var(--fg-subtle)" }}>
              Based on Anthropic list prices; cached input is billed lower, so actual spend is at or below this.
            </p>
          </OACard>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <OACard><OACardHeader><OACardTitle>Subjects</OACardTitle></OACardHeader><BreakdownList items={overview.breakdowns.subject} /></OACard>
          <OACard><OACardHeader><OACardTitle>Classes</OACardTitle></OACardHeader><BreakdownList items={overview.breakdowns.classLevel} /></OACard>
          <OACard><OACardHeader><OACardTitle>Exam types</OACardTitle></OACardHeader><BreakdownList items={overview.breakdowns.examType} /></OACard>
          <OACard><OACardHeader><OACardTitle>File types</OACardTitle></OACardHeader><BreakdownList items={overview.breakdowns.format} /></OACard>
          <OACard><OACardHeader><OACardTitle>Answer styles</OACardTitle></OACardHeader><BreakdownList items={overview.breakdowns.detailLevel} /></OACard>
          <OACard>
            <OACardHeader><OACardTitle>Top users</OACardTitle></OACardHeader>
            {overview.topUsers.length === 0 ? (
              <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>No papers in this period.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {overview.topUsers.map((u) => (
                  <li key={u.userId} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0">
                      <span className="block truncate" style={{ color: "var(--ink-900)" }}>{u.name}</span>
                      <span className="block truncate text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>{u.email}</span>
                    </span>
                    <span className="shrink-0 tabular-nums" style={{ color: "var(--fg-muted)" }}>
                      {u.papers} paper{u.papers === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </OACard>
        </div>

        {overview.truncated && (
          <p className="text-[12px]" style={{ color: "var(--warning-tx)" }}>
            Showing statistics for the most recent 10,000 papers in this range. Narrow the date range for exact totals.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SearchInput placeholder="Search by user name, email or file name…" />
          <QpsStatusFilter />
        </div>

        <div className="rounded-[var(--r-lg)] border overflow-hidden" style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
          <QpsJobTable rows={jobs.rows} />
        </div>

        <Pagination page={page} totalPages={totalPages(jobs.totalCount)} totalCount={jobs.totalCount} pageSize={ADMIN_PAGE_SIZE} />

        <p className="text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>
          Papers a user deletes are removed entirely and aren&apos;t counted here.
        </p>
      </div>
    </AdminShell>
  );
}
