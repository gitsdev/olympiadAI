import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { getPlan } from "@/lib/seo-agent/content-data";
import { DELETABLE_PLAN_STATUSES } from "@/lib/seo-agent/content-plans";
import { formatZoned, getZonedParts, zonedDateString } from "@/lib/seo-agent/datetime";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { PlanForm } from "../PlanForm";

export const metadata: Metadata = { title: "Content Plan | SEO Agent", description: "Edit a content plan." };
export const dynamic = "force-dynamic";
// "Generate article" runs the Content Writer Agent (a full article) in a server action on this route.
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

async function load(id: string) {
  try {
    const [settings, plan] = await Promise.all([getSeoSettings(), getPlan(id)]);
    return { settings, plan };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function PlanPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await load(id);
  if (data && !data.plan) notFound();
  // Validation notes passed from "Create content plan" (links the planner tried to invent, etc.).
  const notes = (await searchParams).notes?.split("\n").filter(Boolean).slice(0, 10) ?? [];

  if (!data) return <SeoAgentShell title="Content plan"><SchemaMissingNotice /></SeoAgentShell>;
  const { settings, plan } = data;
  const p = plan!;
  const tz = settings.timezone;
  const at = p.plannedPublishAt ? new Date(p.plannedPublishAt) : null;
  const parts = at ? getZonedParts(at, tz) : null;

  return (
    <SeoAgentShell
      title="Content plan"
      subtitle={at ? `Publishes ${formatZoned(at, tz)}` : "Not scheduled"}
      actions={<StatusBadge status={p.status} />}
    >
      <div className="flex flex-col gap-4">
        <div className="text-[13px] flex flex-col gap-1 max-w-4xl" style={{ color: "var(--ink-700)" }}>
          {p.cluster && (
            <span>From cluster <Link href={`/admin/seo-agent/clusters#${p.cluster.id}`} className="underline font-semibold">{p.cluster.name}</Link></span>
          )}
          {p.opportunity && <span style={{ color: "var(--fg-muted)" }}>Why: {p.opportunity.reason}</span>}
        </div>

        {notes.length > 0 && (
          <div role="status" className="flex gap-2 items-start text-[12.5px] p-3 rounded-[var(--r-md)] max-w-4xl" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
            <TriangleAlert size={15} className="shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">The planner&apos;s draft was corrected:</p>
              <ul className="list-disc pl-5">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          </div>
        )}

        <PlanForm
          planId={p.id}
          editable={DELETABLE_PLAN_STATUSES.includes(p.status)}
          timezone={tz}
          article={p.article}
          initial={{
            title: p.title,
            primaryKeyword: p.primaryKeyword,
            secondaryKeywords: p.secondaryKeywords,
            searchIntent: p.searchIntent ?? "",
            contentType: p.contentType ?? "",
            targetAudience: p.targetAudience ?? "",
            outline: p.outline,
            recommendedCta: p.recommendedCta ?? "",
            internalLinks: p.internalLinks,
            plannedDate: at ? zonedDateString(at, tz) : "",
            plannedTime: parts ? `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}` : settings.defaultPublishTime,
            status: p.status,
            notes: p.notes ?? "",
          }}
        />
      </div>
    </SeoAgentShell>
  );
}
