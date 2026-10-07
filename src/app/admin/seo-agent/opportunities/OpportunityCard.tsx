"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OABadge, OACard } from "@/components/ui";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { CreatePlanButton } from "@/components/seo-agent/CreatePlanButton";
import { setOpportunityStatus } from "@/actions/seo-agent/content";
import { humanizeStatus } from "@/lib/seo-agent/constants";
import { formatZoned } from "@/lib/seo-agent/datetime";
import type { OpportunityView } from "@/lib/seo-agent/content-data";

export function OpportunityCard({ opp, timezone }: { opp: OpportunityView; timezone: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: "OPEN" | "DISMISSED") {
    setPending(true);
    setError(null);
    const res = await setOpportunityStatus(opp.id, status);
    setPending(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <OACard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={opp.type} />
            {opp.cannibalizationRisk !== "NONE" && (
              <OABadge tone={opp.cannibalizationRisk === "HIGH" ? "red" : opp.cannibalizationRisk === "MEDIUM" ? "amber" : "neutral"}>
                Cannibalization risk: {humanizeStatus(opp.cannibalizationRisk)}
              </OABadge>
            )}
            <span className="text-[12px]" style={{ color: "var(--fg-subtle)" }}>{formatZoned(opp.createdAt, timezone, { dateOnly: true })}</span>
          </div>
          <h2 className="text-[16px] font-bold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
            {opp.title ?? opp.cluster?.name ?? "Untitled recommendation"}
          </h2>
          {opp.cluster && (
            <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
              Cluster: <Link href={`/admin/seo-agent/clusters#${opp.cluster.id}`} className="underline">{opp.cluster.name}</Link>
              {" "}· primary keyword &ldquo;{opp.cluster.primaryKeyword}&rdquo;
            </p>
          )}
        </div>
      </div>

      <p className="text-[13.5px]" style={{ color: "var(--ink-700)" }}>{opp.reason}</p>

      {opp.relatedPosts.length > 0 && (
        <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          Existing content:{" "}
          {opp.relatedPosts.map((p, i) => (
            <span key={p.slug}>{i > 0 && ", "}<Link href={`/blog/${p.slug}`} target="_blank" className="underline">{p.title}</Link></span>
          ))}
        </p>
      )}

      {opp.plans.length > 0 && (
        <p className="text-[13px] flex items-center gap-2 flex-wrap" style={{ color: "var(--ink-700)" }}>
          Content plan:
          {opp.plans.map((p) => (
            <Link key={p.id} href={`/admin/seo-agent/calendar/${p.id}`} className="inline-flex items-center gap-1.5 font-semibold underline">
              {p.title} <StatusBadge status={p.status} />
            </Link>
          ))}
        </p>
      )}

      <div className="flex items-start gap-2 flex-wrap pt-1">
        {opp.status === "OPEN" && opp.type === "NEW_ARTICLE" && <CreatePlanButton opportunityId={opp.id} />}
        {opp.status === "OPEN" && (opp.type === "UPDATE_EXISTING" || opp.type === "MERGE_ARTICLES") && (
          <p className="text-[12.5px] max-w-md self-center" style={{ color: "var(--fg-muted)" }}>
            Edit the existing post in <Link href="/admin/blog" className="underline">Blog</Link>. AI-assisted updates come in a later phase.
          </p>
        )}
        {opp.status === "OPEN" && (
          <Button size="sm" variant="outline" onClick={() => setStatus("DISMISSED")} disabled={pending}>Dismiss</Button>
        )}
        {opp.status === "DISMISSED" && (
          <Button size="sm" variant="outline" onClick={() => setStatus("OPEN")} disabled={pending}>Reopen</Button>
        )}
      </div>
      {error && <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger-tx)" }}>{error}</p>}
    </OACard>
  );
}
