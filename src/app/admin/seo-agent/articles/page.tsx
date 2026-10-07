import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { OACard } from "@/components/ui";
import { parsePage, totalPages } from "@/lib/admin/pagination";
import { ARTICLES_PAGE_SIZE, listArticles } from "@/lib/seo-agent/articles-data";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { formatZoned } from "@/lib/seo-agent/datetime";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Articles | SEO Agent", description: "AI-drafted and edited SEO articles." };
export const dynamic = "force-dynamic";

/** Tabs map to one or more article statuses. */
const TABS: { key: string; label: string; statuses?: string[] }[] = [
  { key: "", label: "All" },
  { key: "DRAFT", label: "Drafts", statuses: ["DRAFT", "GENERATING"] },
  { key: "REVIEW", label: "In review", statuses: ["REVIEW", "REVIEW_REQUIRED"] },
  { key: "SCHEDULED", label: "Approved and scheduled", statuses: ["APPROVED", "SCHEDULED"] },
  { key: "PUBLISHED", label: "Published", statuses: ["PUBLISHED"] },
  { key: "ARCHIVED", label: "Archived", statuses: ["ARCHIVED", "REJECTED"] },
];

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function load(statuses: string[] | undefined, q: string | undefined, page: number) {
  try {
    const [settings, res] = await Promise.all([getSeoSettings(), listArticles({ statuses, q, page })]);
    return { tz: settings.timezone, ...res };
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function ArticlesPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === (sp.status ?? "")) ?? TABS[0];
  const page = parsePage(sp.page);
  const data = await load(tab.statuses, sp.q?.trim() || undefined, page);

  return (
    <SeoAgentShell title="Articles" subtitle="Generate articles from content plans, then edit and review them here">
      {!data ? (
        <SchemaMissingNotice />
      ) : (
        <OACard className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <nav className="flex flex-wrap gap-1.5" aria-label="Article status">
              {TABS.map((t) => (
                <Link key={t.key || "all"} href={t.key ? `/admin/seo-agent/articles?status=${t.key}` : "/admin/seo-agent/articles"}
                  aria-current={tab.key === t.key ? "page" : undefined}
                  className={cn("px-2.5 py-1 rounded-full text-[12.5px] font-semibold border",
                    tab.key === t.key ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)] border-[var(--cobalt-200)]" : "text-[var(--ink-500)] border-[var(--line-200)]")}>
                  {t.label}
                </Link>
              ))}
            </nav>
            <SearchInput placeholder="Search title or keyword…" />
          </div>

          {data.rows.length === 0 ? (
            <EmptyState
              Icon={FileText}
              title="No articles here yet"
              description="Open a plan in the Content Calendar and click Generate article."
              action={<Link href="/admin/seo-agent/calendar" className="text-[13px] font-semibold" style={{ color: "var(--cobalt-700)" }}>Go to Content Calendar →</Link>}
            />
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-[13px] min-w-[760px]">
                <thead>
                  <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)" }}>
                    <th className="py-2 pr-3 font-medium">Article</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Publishes</th>
                    <th className="py-2 pr-3 font-medium text-right" title="Internal content-quality score, not a Google metric">Score</th>
                    <th className="py-2 pr-3 font-medium text-right">Version</th>
                    <th className="py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-200)]">
                  {data.rows.map((a) => {
                    const when = a.publishedAt ?? a.scheduledFor ?? a.plannedPublishAt;
                    return (
                      <tr key={a.id} className="align-top">
                        <td className="py-2.5 pr-3">
                          <Link href={`/admin/seo-agent/articles/${a.id}`} className="font-semibold hover:underline" style={{ color: "var(--ink-900)" }}>{a.title}</Link>
                          <span className="block text-[12px]" style={{ color: "var(--fg-muted)" }}>
                            {a.primaryKeyword ?? "—"}{a.slug ? ` · /blog/${a.slug}` : ""}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3"><StatusBadge status={a.status} /></td>
                        <td className="py-2.5 pr-3 whitespace-nowrap" style={{ color: "var(--ink-700)" }}>
                          {when ? formatZoned(when, data.tz) : "—"}
                          {!a.publishedAt && !a.scheduledFor && a.plannedPublishAt && <span className="block text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>planned</span>}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{a.seoScore ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">v{a.currentVersion}</td>
                        <td className="py-2.5 whitespace-nowrap" style={{ color: "var(--fg-muted)" }}>{formatZoned(a.updatedAt, data.tz)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages(data.count, ARTICLES_PAGE_SIZE)} totalCount={data.count} pageSize={ARTICLES_PAGE_SIZE} />
        </OACard>
      )}
    </SeoAgentShell>
  );
}
