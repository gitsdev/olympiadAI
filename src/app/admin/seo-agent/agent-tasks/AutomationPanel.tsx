"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Rocket, Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OACard } from "@/components/ui";
import { runDailyArticleNow, runPublishDueNow } from "@/actions/seo-agent/automation";
import type { JobResult } from "@/lib/seo-agent/cron/jobs";

/** Shows the cron schedule and lets the admin run either job now. */
export function AutomationPanel({ schedule }: { schedule: { daily: string; publish: string; mode: string; frequency: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "daily" | "publish">(null);
  const [result, setResult] = useState<JobResult | null>(null);

  async function run(kind: "daily" | "publish") {
    setBusy(kind);
    setResult(null);
    const r = kind === "daily" ? await runDailyArticleNow() : await runPublishDueNow();
    setBusy(null);
    setResult(r);
    router.refresh();
  }

  return (
    <OACard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1 text-[13px]" style={{ color: "var(--ink-700)" }}>
          <span className="font-semibold text-[14px] flex items-center gap-1.5" style={{ color: "var(--ink-900)" }}><CalendarClock size={15} /> Automation</span>
          <span>Tomorrow&apos;s article: daily around <strong>{schedule.daily}</strong> (generation: {schedule.frequency.toLowerCase()}, mode: {schedule.mode === "AUTO_PUBLISH" ? "auto-publish" : "manual approval"}).</span>
          <span>Scheduled publishing: around <strong>{schedule.publish}</strong>, and again with the daily article run.</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => run("daily")} disabled={busy !== null}>
            {busy === "daily" ? <Loader2 size={14} className="animate-spin" /> : <Sunrise size={14} />}
            {busy === "daily" ? "Preparing… (2–4 min)" : "Prepare tomorrow's article now"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => run("publish")} disabled={busy !== null}>
            {busy === "publish" ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Publish due articles now
          </Button>
        </div>
      </div>
      {result && (
        <p role="status" className="text-[12.5px] p-2.5 rounded-[var(--r-md)]"
          style={{ background: result.ok ? "var(--paper-2)" : "var(--danger-bg)", color: result.ok ? "var(--ink-700)" : "var(--danger-tx)" }}>
          {result.summary}
        </p>
      )}
    </OACard>
  );
}
