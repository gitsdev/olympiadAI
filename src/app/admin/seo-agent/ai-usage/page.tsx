import Link from "next/link";
import type { Metadata } from "next";
import { Coins, TriangleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { StatCard } from "@/components/admin/StatCard";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { AI_USAGE_CATEGORIES, humanizeStatus } from "@/lib/seo-agent/constants";
import { formatZoned } from "@/lib/seo-agent/datetime";
import { formatUsd, type UsageSummary } from "@/lib/seo-agent/usage";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { getUsageReport } from "@/lib/seo-agent/tasks-data";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";

export const metadata: Metadata = {
  title: "AI Usage | SEO Agent",
  description: "SEO Agent AI token usage and estimated cost.",
};

export const dynamic = "force-dynamic";

async function load() {
  try {
    const settings = await getSeoSettings();
    return { settings, report: await getUsageReport(settings.timezone) };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

const costLabel = (cost: number, unpriced: number) => `${formatUsd(cost)}${unpriced ? "+" : ""}`;
const hint = (u: UsageSummary) => `${u.calls} call(s) · ${u.tokens.toLocaleString("en-IN")} tokens${u.unpricedCalls ? ` · ${u.unpricedCalls} unpriced` : ""}`;

export default async function AiUsagePage() {
  await requireAdmin();
  const data = await load();

  return (
    <SeoAgentShell title="AI Usage" subtitle="Token usage and cost, estimated from the model pricing you set">
      {!data ? <SchemaMissingNotice /> : <UsageBody {...data} />}
    </SeoAgentShell>
  );
}

function UsageBody({ settings, report }: NonNullable<Awaited<ReturnType<typeof load>>>) {
  const tz = settings.timezone;
  const unpricedModels = report.byModel.filter((m) => m.unpriced > 0).map((m) => m.model);

  return (
    <div className="flex flex-col gap-5">
      {unpricedModels.length > 0 && (
        <p className="flex items-start gap-2 text-[13px] p-3 rounded-[var(--r-md)]" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
          <TriangleAlert size={15} className="shrink-0 mt-0.5" aria-hidden />
          <span>
            No pricing is set for {unpricedModels.join(", ")}, so those calls aren&apos;t included in the costs below.{" "}
            <Link href="/admin/seo-agent/settings" className="underline font-semibold">Add model pricing in Settings</Link>.
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard label="Today" value={costLabel(report.today.cost, report.today.unpricedCalls)} hint={hint(report.today)} Icon={Coins} />
        <StatCard label="This month" value={costLabel(report.month.cost, report.month.unpricedCalls)} hint={hint(report.month)} Icon={Coins} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <OACard>
          <OACardHeader><OACardTitle>This month by area</OACardTitle></OACardHeader>
          <table className="w-full text-[13px]">
            <tbody className="divide-y divide-[var(--line-200)]">
              {AI_USAGE_CATEGORIES.map((c) => (
                <tr key={c}>
                  <td className="py-2" style={{ color: "var(--ink-700)" }}>{humanizeStatus(c)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums" style={{ color: "var(--ink-900)" }}>{formatUsd(report.month.byCategory[c])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </OACard>

        <OACard>
          <OACardHeader><OACardTitle>This month by model</OACardTitle></OACardHeader>
          {report.byModel.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>No AI calls this month.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)" }}>
                  <th className="py-1.5 font-medium">Model</th><th className="py-1.5 font-medium text-right">Calls</th>
                  <th className="py-1.5 font-medium text-right">Tokens</th><th className="py-1.5 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-200)]">
                {report.byModel.map((m) => (
                  <tr key={m.model}>
                    <td className="py-2 font-mono text-[12.5px]" style={{ color: "var(--ink-900)" }}>{m.model}</td>
                    <td className="py-2 text-right tabular-nums">{m.calls}</td>
                    <td className="py-2 text-right tabular-nums">{m.tokens.toLocaleString("en-IN")}</td>
                    <td className="py-2 text-right tabular-nums">{m.unpriced === m.calls ? "unpriced" : costLabel(m.cost, m.unpriced)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </OACard>
      </div>

      <OACard>
        <OACardHeader><OACardTitle>Last 30 days</OACardTitle></OACardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[420px]">
            <thead>
              <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)" }}>
                <th className="py-1.5 font-medium">Date ({tz})</th><th className="py-1.5 font-medium text-right">Calls</th>
                <th className="py-1.5 font-medium text-right">Tokens</th><th className="py-1.5 font-medium text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-200)]">
              {report.daily.filter((d) => d.calls > 0).map((d) => (
                <tr key={d.date}>
                  <td className="py-2" style={{ color: "var(--ink-700)" }}>{formatZoned(new Date(`${d.date}T12:00:00Z`), tz, { dateOnly: true })}</td>
                  <td className="py-2 text-right tabular-nums">{d.calls}</td>
                  <td className="py-2 text-right tabular-nums">{d.tokens.toLocaleString("en-IN")}</td>
                  <td className="py-2 text-right tabular-nums">{costLabel(d.cost, d.unpriced)}</td>
                </tr>
              ))}
              {report.daily.every((d) => d.calls === 0) && (
                <tr><td colSpan={4} className="py-3 text-center" style={{ color: "var(--fg-muted)" }}>No AI usage in the last 30 days.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </OACard>
    </div>
  );
}
