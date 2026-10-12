import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { OACard } from "@/components/ui";
import { listBacklinks } from "@/lib/seo-agent/backlinks/data";
import { BACKLINK_STATUSES } from "@/lib/seo-agent/backlinks/model";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { humanizeStatus } from "@/lib/seo-agent/constants";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { cn } from "@/lib/utils";
import { TrackerTable } from "./TrackerTable";

export const metadata: Metadata = { title: "Backlink Tracker | SEO Agent", description: "Backlinks to OlympiadIQ and whether they're still live." };
export const dynamic = "force-dynamic";
// "Check all" fetches up to 25 pages in a server action on this route.
export const maxDuration = 300;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function load(status?: string) {
  try {
    const [settings, rows] = await Promise.all([getSeoSettings(), listBacklinks(status)]);
    return { tz: settings.timezone, frequency: settings.backlinkCheckFrequency, rows };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function TrackerPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (BACKLINK_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;
  const data = await load(status);
  const chip = (active: boolean) => cn("px-2.5 py-1 rounded-full text-[12.5px] font-semibold border",
    active ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)] border-[var(--cobalt-200)]" : "text-[var(--ink-500)] border-[var(--line-200)]");

  return (
    <SeoAgentShell
      title="Backlink Tracker"
      subtitle={data ? `Live links to OlympiadIQ, rechecked ${data.frequency === "OFF" ? "only when you click Check" : `automatically (${data.frequency.toLowerCase()})`}` : undefined}
    >
      {!data ? (
        <SchemaMissingNotice />
      ) : (
        <OACard className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {[undefined, ...BACKLINK_STATUSES].map((s) => (
              <Link key={s ?? "all"} href={s ? `/admin/seo-agent/backlinks/tracker?status=${s}` : "/admin/seo-agent/backlinks/tracker"} className={chip(status === s)}>
                {s ? humanizeStatus(s) : "All"}
              </Link>
            ))}
          </div>
          <TrackerTable rows={data.rows} timezone={data.tz} />
        </OACard>
      )}
    </SeoAgentShell>
  );
}
