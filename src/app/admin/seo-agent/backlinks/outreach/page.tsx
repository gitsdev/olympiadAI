import Link from "next/link";
import type { Metadata } from "next";
import { Send } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { OACard } from "@/components/ui";
import { listOutreachMessages } from "@/lib/seo-agent/backlinks/data";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { formatZoned } from "@/lib/seo-agent/datetime";
import { humanizeStatus } from "@/lib/seo-agent/constants";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Outreach | SEO Agent", description: "Outreach email drafts for backlink opportunities." };
export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "APPROVED", "COPIED"] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function load(status?: string) {
  try {
    const [settings, rows] = await Promise.all([getSeoSettings(), listOutreachMessages(status)]);
    return { tz: settings.timezone, rows };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function OutreachPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const data = await load(status);
  const chip = (active: boolean) => cn("px-2.5 py-1 rounded-full text-[12.5px] font-semibold border",
    active ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)] border-[var(--cobalt-200)]" : "text-[var(--ink-500)] border-[var(--line-200)]");

  return (
    <SeoAgentShell title="Outreach" subtitle="Drafts are never sent automatically. Approve one, copy it, and send it from your own email.">
      {!data ? (
        <SchemaMissingNotice />
      ) : (
        <OACard className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {[undefined, ...STATUSES].map((s) => (
              <Link key={s ?? "all"} href={s ? `/admin/seo-agent/backlinks/outreach?status=${s}` : "/admin/seo-agent/backlinks/outreach"} className={chip(status === s)}>
                {s ? humanizeStatus(s) : "All"}
              </Link>
            ))}
          </div>
          {data.rows.length === 0 ? (
            <EmptyState Icon={Send} title="No outreach drafts" description="Open a backlink opportunity and click Generate outreach." />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--line-200)]">
              {data.rows.map((m) => (
                <li key={m.id} className="py-3 flex items-start justify-between gap-3 text-[13px]">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-semibold" style={{ color: "var(--ink-900)" }}>{m.subject}</span>
                    <span className="line-clamp-2" style={{ color: "var(--fg-muted)" }}>{m.body}</span>
                    <span className="text-[12px]" style={{ color: "var(--fg-subtle)" }}>
                      {m.prospect ? <Link href={`/admin/seo-agent/backlinks/${m.prospect.id}`} className="underline">{m.prospect.website}</Link> : "Deleted prospect"}
                      {" "}· {formatZoned(m.createdAt, data.tz)}
                    </span>
                  </div>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </OACard>
      )}
    </SeoAgentShell>
  );
}
