import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { listPlansBetween, listUnscheduledPlans, type PlanSummary } from "@/lib/seo-agent/content-data";
import { buildMonthGrid, isValidMonth, shiftMonth } from "@/lib/seo-agent/content-plans";
import { addDays, getZonedParts, zonedDateString, zonedTimeToUtc } from "@/lib/seo-agent/datetime";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { CalendarGrid } from "./CalendarGrid";

export const metadata: Metadata = {
  title: "Content Calendar | SEO Agent",
  description: "Planned SEO articles by publication date.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function load(monthParam: string | undefined) {
  try {
    const settings = await getSeoSettings();
    const tz = settings.timezone;
    const today = zonedDateString(new Date(), tz);
    const month = isValidMonth(monthParam) ? monthParam : today.slice(0, 7);
    const weeks = buildMonthGrid(month);
    const first = weeks[0][0].date;
    const last = weeks[weeks.length - 1][6].date;

    const [plans, unscheduled] = await Promise.all([
      listPlansBetween(zonedTimeToUtc(first, "00:00", tz), zonedTimeToUtc(addDays(last, 1), "00:00", tz)),
      listUnscheduledPlans(),
    ]);

    const plansByDate: Record<string, (PlanSummary & { time: string })[]> = {};
    for (const p of plans) {
      const at = new Date(p.plannedPublishAt!);
      const parts = getZonedParts(at, tz);
      const time = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
      (plansByDate[zonedDateString(at, tz)] ??= []).push({ ...p, time });
    }
    return { tz, today, month, weeks, plansByDate, unscheduled, planCount: plans.length };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function CalendarPage({ searchParams }: PageProps) {
  await requireAdmin();
  const data = await load((await searchParams).month);

  const newPlan = (
    <Link href="/admin/seo-agent/calendar/new" className={buttonVariants({ size: "sm" })}>
      <Plus size={14} /> New plan
    </Link>
  );

  if (!data) {
    return <SeoAgentShell title="Content Calendar"><SchemaMissingNotice /></SeoAgentShell>;
  }

  const monthLabel = new Date(`${data.month}-15T12:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <SeoAgentShell title="Content Calendar" subtitle={`Publication dates in ${data.tz}`} actions={newPlan}>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">
        <OACard>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1">
              <Link href={`/admin/seo-agent/calendar?month=${shiftMonth(data.month, -1)}`} aria-label="Previous month"
                className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] border hover:bg-[var(--fill-100)]" style={{ borderColor: "var(--line-200)" }}>
                <ChevronLeft size={16} />
              </Link>
              <Link href={`/admin/seo-agent/calendar?month=${shiftMonth(data.month, 1)}`} aria-label="Next month"
                className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] border hover:bg-[var(--fill-100)]" style={{ borderColor: "var(--line-200)" }}>
                <ChevronRight size={16} />
              </Link>
              <h2 className="text-[17px] font-bold ml-2" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>{monthLabel}</h2>
            </div>
            {data.month !== data.today.slice(0, 7) && (
              <Link href="/admin/seo-agent/calendar" className="text-[13px] font-semibold" style={{ color: "var(--cobalt-700)" }}>Today</Link>
            )}
          </div>
          <CalendarGrid weeks={data.weeks} plansByDate={data.plansByDate} today={data.today} />
        </OACard>

        <OACard className="h-fit">
          <OACardHeader><OACardTitle>Unscheduled ideas</OACardTitle></OACardHeader>
          {data.unscheduled.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
              No ideas without a date. Plans from <Link href="/admin/seo-agent/opportunities" className="underline">Content Opportunities</Link> get a date automatically.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--line-200)]">
              {data.unscheduled.map((p) => (
                <li key={p.id} className="py-2">
                  <Link href={`/admin/seo-agent/calendar/${p.id}`} className="flex flex-col gap-1">
                    <span className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{p.title}</span>
                    <span className="flex items-center gap-2 text-[12px]" style={{ color: "var(--fg-muted)" }}>
                      <StatusBadge status={p.status} /> {p.primaryKeyword}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </OACard>
      </div>
    </SeoAgentShell>
  );
}
