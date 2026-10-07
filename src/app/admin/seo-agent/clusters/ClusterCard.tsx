"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OABadge, OACard } from "@/components/ui";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { CreatePlanButton } from "@/components/seo-agent/CreatePlanButton";
import { setClusterStatus } from "@/actions/seo-agent/clusters";
import { humanizeStatus } from "@/lib/seo-agent/constants";
import type { ClusterView } from "@/lib/seo-agent/clusters-data";

function Chips({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-muted)" }}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {items.map((s) => <OABadge key={s} tone="neutral" className="font-medium">{s}</OABadge>)}
      </div>
    </div>
  );
}

export function ClusterCard({ cluster }: { cluster: ClusterView }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archived = cluster.status === "ARCHIVED";

  async function toggleArchive() {
    setPending(true);
    setError(null);
    const res = await setClusterStatus(cluster.id, archived ? "ACTIVE" : "ARCHIVED");
    setPending(false);
    if (!res.ok) setError(res.error ?? "Failed");
    else router.refresh();
  }

  const opp = cluster.opportunity;

  return (
    <OACard id={cluster.id} className="flex flex-col gap-4 scroll-mt-24">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-[17px] font-bold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>{cluster.name}</h2>
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
            Primary: <span className="font-semibold" style={{ color: "var(--ink-700)" }}>{cluster.primaryKeyword}</span>
            {cluster.searchIntent && <> · {humanizeStatus(cluster.searchIntent)} intent</>}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={toggleArchive} disabled={pending} aria-label={archived ? "Restore cluster" : "Archive cluster"}>
          {archived ? <ArchiveRestore size={15} /> : <Archive size={15} />} {archived ? "Restore" : "Archive"}
        </Button>
      </div>

      {cluster.recommendedTitle && (
        <div className="flex flex-col gap-2 p-3 rounded-[var(--r-md)]" style={{ background: "var(--paper-2)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <Lightbulb size={15} style={{ color: "var(--gold-700)" }} aria-hidden />
            <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-muted)" }}>Recommended article</span>
            {opp && <StatusBadge status={opp.type} />}
            {opp && opp.cannibalizationRisk !== "NONE" && (
              <OABadge tone={opp.cannibalizationRisk === "HIGH" ? "red" : opp.cannibalizationRisk === "MEDIUM" ? "amber" : "neutral"}>
                Cannibalization risk: {humanizeStatus(opp.cannibalizationRisk)}
              </OABadge>
            )}
          </div>
          <p className="text-[15px] font-semibold" style={{ color: "var(--ink-900)" }}>{cluster.recommendedTitle}</p>
          {opp && <p className="text-[13px]" style={{ color: "var(--ink-700)" }}>{opp.reason}</p>}
          {opp && opp.relatedPosts.length > 0 && (
            <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
              Related existing content:{" "}
              {opp.relatedPosts.map((p, i) => (
                <span key={p.slug}>
                  {i > 0 && ", "}
                  <Link href={`/blog/${p.slug}`} target="_blank" className="underline">{p.title}</Link>
                </span>
              ))}
            </p>
          )}
          {opp?.type === "NEW_ARTICLE" && cluster.plans.length === 0 && !archived && (
            <div className="pt-1"><CreatePlanButton opportunityId={opp.id} /></div>
          )}
        </div>
      )}

      {cluster.plans.length > 0 && (
        <p className="text-[13px] flex items-center gap-2 flex-wrap" style={{ color: "var(--ink-700)" }}>
          Content plan:
          {cluster.plans.map((p) => (
            <Link key={p.id} href={`/admin/seo-agent/calendar/${p.id}`} className="inline-flex items-center gap-1.5 font-semibold underline">
              {p.title} <StatusBadge status={p.status} />
            </Link>
          ))}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-muted)" }}>Your keywords ({cluster.members.length})</span>
        <div className="flex flex-wrap gap-1">
          {cluster.members.length === 0 && <span className="text-[13px]" style={{ color: "var(--fg-subtle)" }}>None</span>}
          {cluster.members.map((m) => (
            <OABadge key={m.id} tone={m.role === "PRIMARY" ? "cobalt" : m.role === "QUESTION" ? "gold" : "outline"} title={humanizeStatus(m.role)}>
              {m.keyword}
            </OABadge>
          ))}
        </div>
      </div>
      <Chips label="Suggested variants" items={cluster.secondaryKeywords} />
      <Chips label="Questions people ask" items={cluster.questionKeywords} />

      {error && <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger-tx)" }}>{error}</p>}
    </OACard>
  );
}
