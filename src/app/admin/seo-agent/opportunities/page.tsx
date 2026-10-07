import Link from "next/link";
import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { EmptyState } from "@/components/admin/EmptyState";
import { OACard } from "@/components/ui";
import { countOpenOpportunities, listOpportunities } from "@/lib/seo-agent/content-data";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { humanizeStatus } from "@/lib/seo-agent/constants";
import { OPPORTUNITY_TYPES } from "@/lib/seo-agent/agents/keyword-analysis";
import { cn } from "@/lib/utils";
import { OpportunityCard } from "./OpportunityCard";

export const metadata: Metadata = {
  title: "Content Opportunities | SEO Agent",
  description: "Article recommendations from keyword analysis, ready to turn into content plans.",
};

export const dynamic = "force-dynamic";
// "Create content plan" runs the Content Planner Agent in a server action on this route.
export const maxDuration = 120;

const STATUSES = ["OPEN", "ACCEPTED", "DISMISSED"] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function load(status: string, type?: string) {
  try {
    const [settings, opps, counts] = await Promise.all([getSeoSettings(), listOpportunities({ status, type }), countOpenOpportunities()]);
    return { tz: settings.timezone, opps, counts };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) ?? "OPEN";
  const type = (OPPORTUNITY_TYPES as readonly string[]).includes(sp.type ?? "") ? sp.type : undefined;
  const data = await load(status, type);

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, type, ...patch })) if (v && !(k === "status" && v === "OPEN")) p.set(k, v);
    const qs = p.toString();
    return `/admin/seo-agent/opportunities${qs ? `?${qs}` : ""}`;
  };
  const chip = (active: boolean) => cn("px-2.5 py-1 rounded-full text-[12.5px] font-semibold border",
    active ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)] border-[var(--cobalt-200)]" : "text-[var(--ink-500)] border-[var(--line-200)]");

  return (
    <SeoAgentShell title="Content Opportunities" subtitle="Recommendations from keyword analysis. Turn the good ones into content plans.">
      {!data ? (
        <SchemaMissingNotice />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5 items-center">
            {STATUSES.map((s) => (
              <Link key={s} href={href({ status: s })} className={chip(status === s)}>
                {humanizeStatus(s)} ({data.counts[s] ?? 0})
              </Link>
            ))}
            <span className="w-px h-5 mx-1" style={{ background: "var(--line-200)" }} />
            {[undefined, ...OPPORTUNITY_TYPES].map((t) => (
              <Link key={t ?? "all"} href={href({ type: t })} className={chip(type === t)}>{t ? humanizeStatus(t) : "All types"}</Link>
            ))}
          </div>

          {data.opps.length === 0 ? (
            <OACard>
              <EmptyState
                Icon={Lightbulb}
                title={status === "OPEN" ? "No open recommendations" : `No ${status.toLowerCase()} recommendations`}
                description={status === "OPEN" ? "Analyse keywords to get article recommendations." : undefined}
                action={status === "OPEN" ? <Link href="/admin/seo-agent/keywords" className="text-[13px] font-semibold" style={{ color: "var(--cobalt-700)" }}>Go to Keywords →</Link> : undefined}
              />
            </OACard>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {data.opps.map((o) => <OpportunityCard key={o.id} opp={o} timezone={data.tz} />)}
            </div>
          )}
        </div>
      )}
    </SeoAgentShell>
  );
}
