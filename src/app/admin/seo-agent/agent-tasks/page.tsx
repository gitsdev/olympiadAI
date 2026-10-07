import Link from "next/link";
import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { OACard } from "@/components/ui";
import { parsePage, totalPages } from "@/lib/admin/pagination";
import { AGENT_TASK_STATUSES, humanizeStatus } from "@/lib/seo-agent/constants";
import { formatZoned } from "@/lib/seo-agent/datetime";
import { formatUsd } from "@/lib/seo-agent/usage";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { listAgentTasks, TASKS_PAGE_SIZE, type AgentTaskRow } from "@/lib/seo-agent/tasks-data";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Agent Tasks | SEO Agent",
  description: "Log of every SEO Agent AI operation.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function load(f: { status?: string; agent?: string; page: number }) {
  try {
    const [settings, tasks] = await Promise.all([getSeoSettings(), listAgentTasks(f)]);
    return { tz: settings.timezone, ...tasks };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

function duration(t: AgentTaskRow): string {
  if (!t.started_at || !t.completed_at) return "—";
  const s = (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function cost(t: AgentTaskRow): string {
  if (t.estimated_cost === null) return t.input_tokens ? "unpriced" : "—";
  return formatUsd(Number(t.estimated_cost));
}

export default async function AgentTasksPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const filters = {
    status: sp.status && (AGENT_TASK_STATUSES as readonly string[]).includes(sp.status) ? sp.status : undefined,
    agent: sp.agent?.slice(0, 60) || undefined,
    page: parsePage(sp.page),
  };
  const data = await load(filters);

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status: filters.status, agent: filters.agent, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/admin/seo-agent/agent-tasks${qs ? `?${qs}` : ""}`;
  };

  return (
    <SeoAgentShell title="Agent Tasks" subtitle="Every AI operation, with its outcome, tokens and cost">
      {!data ? (
        <SchemaMissingNotice />
      ) : (
        <OACard className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5" aria-label="Filter by status">
            {[undefined, ...AGENT_TASK_STATUSES].map((s) => (
              <Link key={s ?? "all"} href={href({ status: s })}
                className={cn("px-2.5 py-1 rounded-full text-[12.5px] font-semibold border",
                  filters.status === s ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)] border-[var(--cobalt-200)]" : "text-[var(--ink-500)] border-[var(--line-200)]")}>
                {s ? humanizeStatus(s) : "All"}
              </Link>
            ))}
            {data.agents.length > 1 && <span className="w-px mx-1" style={{ background: "var(--line-200)" }} />}
            {data.agents.length > 1 && [undefined, ...data.agents].map((a) => (
              <Link key={a ?? "all-agents"} href={href({ agent: a })}
                className={cn("px-2.5 py-1 rounded-full text-[12.5px] font-semibold border",
                  filters.agent === a ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)] border-[var(--cobalt-200)]" : "text-[var(--ink-500)] border-[var(--line-200)]")}>
                {a ?? "All agents"}
              </Link>
            ))}
          </div>

          {data.rows.length === 0 ? (
            <EmptyState Icon={Bot} title="No agent tasks" description="Tasks appear here when you run an agent, e.g. Analyze keywords." />
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-[13px] min-w-[900px]">
                <thead>
                  <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)" }}>
                    <th className="py-2 pr-3 font-medium">Started</th>
                    <th className="py-2 pr-3 font-medium">Agent · task</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Details</th>
                    <th className="py-2 pr-3 font-medium text-right">Tokens in / out</th>
                    <th className="py-2 pr-3 font-medium text-right">Cost</th>
                    <th className="py-2 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-200)]">
                  {data.rows.map((t) => (
                    <tr key={t.id} className="align-top">
                      <td className="py-2.5 pr-3 whitespace-nowrap" style={{ color: "var(--ink-700)" }}>{formatZoned(t.created_at, data.tz)}</td>
                      <td className="py-2.5 pr-3">
                        <span className="font-semibold" style={{ color: "var(--ink-900)" }}>{t.agent_type}</span>
                        <span className="block text-[12px]" style={{ color: "var(--fg-muted)" }}>{t.task_type} · {humanizeStatus(t.triggered_by)}</span>
                      </td>
                      <td className="py-2.5 pr-3"><StatusBadge status={t.status} /></td>
                      <td className="py-2.5 pr-3 max-w-[420px]">
                        <details>
                          <summary className="cursor-pointer line-clamp-2" style={{ color: t.error ? "var(--danger-tx)" : "var(--ink-700)" }}>
                            {t.error ?? t.output_summary ?? t.input_summary ?? "—"}
                          </summary>
                          <dl className="mt-2 flex flex-col gap-1.5 text-[12.5px]" style={{ color: "var(--ink-700)" }}>
                            {t.input_summary && <><dt className="font-semibold">Input</dt><dd className="whitespace-pre-wrap">{t.input_summary}</dd></>}
                            {t.output_summary && <><dt className="font-semibold">Output</dt><dd className="whitespace-pre-wrap">{t.output_summary}</dd></>}
                            {t.error && <><dt className="font-semibold">Error</dt><dd className="whitespace-pre-wrap" style={{ color: "var(--danger-tx)" }}>{t.error}</dd></>}
                            {t.model && <><dt className="font-semibold">Model</dt><dd>{t.model}</dd></>}
                          </dl>
                        </details>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: "var(--ink-700)" }}>
                        {t.input_tokens || t.output_tokens ? `${(t.input_tokens ?? 0).toLocaleString("en-IN")} / ${(t.output_tokens ?? 0).toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: "var(--ink-700)" }}>{cost(t)}</td>
                      <td className="py-2.5 text-right tabular-nums" style={{ color: "var(--ink-700)" }}>{duration(t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={filters.page} totalPages={totalPages(data.count, TASKS_PAGE_SIZE)} totalCount={data.count} pageSize={TASKS_PAGE_SIZE} />
        </OACard>
      )}
    </SeoAgentShell>
  );
}
