import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { SearchInput } from "@/components/admin/SearchInput";
import { OACard } from "@/components/ui";
import { listProspects } from "@/lib/seo-agent/backlinks/data";
import { BACKLINK_STATUSES, OPPORTUNITY_TYPES } from "@/lib/seo-agent/backlinks/model";
import { humanizeStatus } from "@/lib/seo-agent/constants";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { cn } from "@/lib/utils";
import { ProspectsTable } from "./ProspectsTable";

export const metadata: Metadata = { title: "Backlink Opportunities | SEO Agent", description: "Legitimate backlink prospects for OlympiadIQ." };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function load(f: { status?: string; type?: string; q?: string }) {
  try {
    return await listProspects(f);
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function BacklinksPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (BACKLINK_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;
  const type = (OPPORTUNITY_TYPES as readonly string[]).includes(sp.type ?? "") ? sp.type : undefined;
  const rows = await load({ status, type, q: sp.q?.trim() || undefined });

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, type, q: sp.q, ...patch })) if (v) p.set(k, v);
    const qs = p.toString();
    return `/admin/seo-agent/backlinks${qs ? `?${qs}` : ""}`;
  };
  const chip = (active: boolean) => cn("px-2.5 py-1 rounded-full text-[12.5px] font-semibold border",
    active ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)] border-[var(--cobalt-200)]" : "text-[var(--ink-500)] border-[var(--line-200)]");

  return (
    <SeoAgentShell title="Backlink Opportunities" subtitle="Relevant sites that might genuinely link to OlympiadIQ. Evaluated from their real pages, with no invented metrics.">
      {!rows ? (
        <SchemaMissingNotice />
      ) : (
        <OACard className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div className="flex flex-wrap gap-1.5">
              {[undefined, ...BACKLINK_STATUSES].map((s) => (
                <Link key={s ?? "all"} href={href({ status: s })} className={chip(status === s)}>{s ? humanizeStatus(s) : "All"}</Link>
              ))}
            </div>
            <SearchInput placeholder="Search website, URL or topic…" />
          </div>
          {type && (
            <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
              Type: {humanizeStatus(type)} · <Link href={href({ type: undefined })} className="underline">clear</Link>
            </p>
          )}
          <ProspectsTable rows={rows} />
        </OACard>
      )}
    </SeoAgentShell>
  );
}
