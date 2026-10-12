import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { getProspect } from "@/lib/seo-agent/backlinks/data";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { ProspectDetail } from "./ProspectDetail";

export const metadata: Metadata = { title: "Backlink Opportunity | SEO Agent", description: "Evaluate a backlink prospect and draft outreach." };
export const dynamic = "force-dynamic";
// Evaluate / Generate outreach fetch a page and call the AI in server actions on this route.
export const maxDuration = 120;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function load(id: string) {
  try {
    const [settings, prospect] = await Promise.all([getSeoSettings(), getProspect(id)]);
    return { tz: settings.timezone, prospect };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function ProspectPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await load(id);
  if (!data) return <SeoAgentShell title="Backlink opportunity"><SchemaMissingNotice /></SeoAgentShell>;
  if (!data.prospect) notFound();
  return (
    <SeoAgentShell title={data.prospect.website} subtitle="Backlink opportunity" actions={<StatusBadge status={data.prospect.status} />}>
      <ProspectDetail prospect={data.prospect} timezone={data.tz} />
    </SeoAgentShell>
  );
}
