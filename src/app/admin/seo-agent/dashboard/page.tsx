import {
  KeyRound, Network, CalendarDays, FilePen, Eye, CalendarClock, FileCheck2, Link2, Gauge, Coins,
} from "lucide-react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { TomorrowArticleCard } from "@/components/seo-agent/TomorrowArticleCard";
import { AgentActivityList } from "@/components/seo-agent/AgentActivityList";
import { StatCard } from "@/components/admin/StatCard";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { getSeoDashboardData } from "@/lib/seo-agent/dashboard-data";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { formatUsd, type UsageSummary } from "@/lib/seo-agent/usage";
import { AI_USAGE_CATEGORIES, humanizeStatus } from "@/lib/seo-agent/constants";

export const metadata: Metadata = {
  title: "SEO Agent | OlympiadIQ Admin",
  description: "Automated SEO content planning, review and publishing for OlympiadIQ.",
};

export const dynamic = "force-dynamic";

function costLabel(u: UsageSummary): string {
  if (u.calls === 0) return formatUsd(0);
  return formatUsd(u.cost) + (u.unpricedCalls > 0 ? "+" : "");
}

function costHint(u: UsageSummary): string {
  if (u.unpricedCalls > 0) return `${u.unpricedCalls} call(s) unpriced. Set model pricing in Settings.`;
  return `${u.calls} call(s) · ${u.tokens.toLocaleString("en-IN")} tokens`;
}

/** Null when migration 013 hasn't been applied yet. */
async function loadDashboard() {
  try {
    const settings = await getSeoSettings();
    const data = await getSeoDashboardData(settings.timezone);
    return { settings, data };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function SeoAgentDashboardPage() {
  await requireAdmin();
  const loaded = await loadDashboard();

  return (
    <SeoAgentShell title="SEO Agent" subtitle="Keyword → article → review → publish → measure">
      {loaded ? <DashboardBody {...loaded} /> : <SchemaMissingNotice />}
    </SeoAgentShell>
  );
}

function DashboardBody({ settings, data }: NonNullable<Awaited<ReturnType<typeof loadDashboard>>>) {
  const c = data.counts;
  return (
    <div className="flex flex-col gap-5">
      <TomorrowArticleCard article={data.tomorrow} tomorrowDate={data.tomorrowDate} timezone={settings.timezone} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Keywords" value={String(c.keywords)} hint="Not archived" Icon={KeyRound} />
        <StatCard label="Active clusters" value={String(c.activeClusters)} Icon={Network} />
        <StatCard label="Planned articles" value={String(c.plannedArticles)} hint="Ideas + planned" Icon={CalendarDays} />
        <StatCard label="Draft articles" value={String(c.draftArticles)} Icon={FilePen} />
        <StatCard label="Awaiting review" value={String(c.awaitingReview)} Icon={Eye} tone={c.awaitingReview > 0 ? "warning" : "default"} />
        <StatCard label="Scheduled" value={String(c.scheduledArticles)} Icon={CalendarClock} />
        <StatCard label="Published" value={String(c.publishedArticles)} Icon={FileCheck2} />
        <StatCard label="Backlink opportunities" value={String(c.backlinkOpportunities)} Icon={Link2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="flex flex-col gap-3">
          <StatCard
            label="Avg content score"
            value={data.avgContentScore === null ? "—" : `${data.avgContentScore}/100`}
            hint="Internal quality score of published articles. Not a Google metric."
            Icon={Gauge}
          />
          <StatCard label="AI cost today" value={costLabel(data.usageToday)} hint={costHint(data.usageToday)} Icon={Coins} />
          <StatCard label="AI cost this month" value={costLabel(data.usageMonth)} hint={costHint(data.usageMonth)} Icon={Coins} />
          <OACard>
            <p className="text-[12.5px] font-medium mb-2" style={{ color: "var(--fg-muted)" }}>This month by area</p>
            <ul className="flex flex-col gap-1 text-[13px]">
              {AI_USAGE_CATEGORIES.map((cat) => (
                <li key={cat} className="flex justify-between">
                  <span style={{ color: "var(--ink-700)" }}>{humanizeStatus(cat)}</span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--ink-900)" }}>
                    {formatUsd(data.usageMonth.byCategory[cat])}
                  </span>
                </li>
              ))}
            </ul>
          </OACard>
        </div>

        <OACard className="lg:col-span-2">
          <OACardHeader><OACardTitle>Recent agent activity</OACardTitle></OACardHeader>
          <AgentActivityList tasks={data.recentTasks} timezone={settings.timezone} />
        </OACard>
      </div>
    </div>
  );
}
