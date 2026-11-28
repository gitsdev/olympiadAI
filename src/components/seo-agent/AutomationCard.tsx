import Link from "next/link";
import { AlertTriangle, CalendarClock, KeyRound } from "lucide-react";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { formatZoned } from "@/lib/seo-agent/datetime";
import type { AutomationRun, AutomationStatus } from "@/lib/seo-agent/dashboard-data";
import { formatUsd } from "@/lib/seo-agent/usage";
import { StatusBadge } from "./StatusBadge";
import { AutopilotToggle } from "./AutopilotToggle";

function Run({ label, run, timezone }: { label: string; run: AutomationRun | null; timezone: string }) {
  return (
    <div className="flex flex-col gap-1 text-[13px] min-w-0">
      <span className="font-semibold" style={{ color: "var(--ink-900)" }}>{label}</span>
      {!run ? (
        <span style={{ color: "var(--fg-muted)" }}>Hasn&apos;t run yet.</span>
      ) : (
        <>
          <span className="flex items-center gap-2 flex-wrap" style={{ color: "var(--fg-muted)" }}>
            {formatZoned(run.at, timezone)} · {run.triggeredBy === "CRON" ? "scheduled" : "run by hand"} <StatusBadge status={run.status} />
          </span>
          <span style={{ color: run.error ? "var(--danger-tx)" : "var(--ink-700)" }}>{run.error ?? run.summary}</span>
        </>
      )}
    </div>
  );
}

export interface AutopilotInfo {
  enabled: boolean;
  model: string;
  budgetUsd: number;
}

/** Shows whether the scheduled jobs are running and what's stopping them from producing anything. */
export function AutomationCard({ status, timezone, autopilot }: { status: AutomationStatus; timezone: string; autopilot: AutopilotInfo }) {
  const topicsLeft = status.openRecommendations + status.unanalysedKeywords;
  const spent = status.autopilotSpentToday;
  return (
    <OACard className="flex flex-col gap-4">
      <OACardHeader className="mb-0 items-start gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <OACardTitle className="flex items-center gap-2"><CalendarClock size={18} /> Automation</OACardTitle>
          <Link href="/admin/seo-agent/agent-tasks" className="text-[12.5px] font-semibold" style={{ color: "var(--cobalt-700)" }}>Run now / history →</Link>
        </div>
        <AutopilotToggle enabled={autopilot.enabled} />
      </OACardHeader>

      <p className="text-[13px] p-3 rounded-[var(--r-md)]" style={{ background: "var(--paper-2)", color: "var(--ink-700)" }}>
        {autopilot.enabled ? (
          <>
            <strong>Autopilot is on.</strong> Every evening it picks a keyword (syncing new ones from{" "}
            <Link href="/admin/seo" className="underline">/admin/seo</Link>), groups it into a cluster, plans and writes an article with a cover
            image, checks it, and schedules it to publish the next morning, but only if every quality check passes. Otherwise it waits in Review.
          </>
        ) : (
          <><strong>Autopilot is off.</strong> Nothing is written or published automatically. Turn it on to publish one article a day.</>
        )}
        <span className="block mt-1.5" style={{ color: "var(--fg-muted)" }}>
          Model {autopilot.model} · budget {formatUsd(autopilot.budgetUsd)}/day · spent today {spent === null ? "unknown" : formatUsd(spent)}
          {" · "}<Link href="/admin/seo-agent/settings" className="underline">change</Link>
        </span>
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Run label="Tomorrow's article (daily, ~8 pm)" run={status.lastDaily} timezone={timezone} />
        <Run label="Scheduled publishing (daily, ~10 am)" run={status.lastPublish} timezone={timezone} />
      </div>

      {topicsLeft === 0 && (
        <p className="flex items-start gap-2 text-[13px] p-3 rounded-[var(--r-md)]" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
          <KeyRound size={15} className="shrink-0 mt-0.5" />
          <span>
            The daily job has nothing left to write about: every keyword has been analysed and no new-article recommendations are open.{" "}
            <Link href="/admin/seo-agent/keywords" className="underline font-semibold">Add keywords</Link> to keep tomorrow&apos;s article coming.
          </span>
        </p>
      )}
      {topicsLeft > 0 && (
        <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          Topics queued for the daily job: {status.openRecommendations} open recommendation(s), {status.unanalysedKeywords} keyword(s) not yet analysed.
        </p>
      )}

      {status.approvedUnscheduled.length > 0 && (
        <div className="flex items-start gap-2 text-[13px] p-3 rounded-[var(--r-md)]" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span>Approved but not scheduled, so these won&apos;t publish by themselves. Open each one and Schedule it or Publish now:</span>
            <ul className="list-disc pl-5">
              {status.approvedUnscheduled.map((a) => (
                <li key={a.id}><Link href={`/admin/seo-agent/articles/${a.id}`} className="underline">{a.title}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </OACard>
  );
}
