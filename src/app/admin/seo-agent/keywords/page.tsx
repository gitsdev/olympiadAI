import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { OACard } from "@/components/ui";
import { parsePage, totalPages } from "@/lib/admin/pagination";
import { KEYWORDS_PAGE_SIZE, listKeywords, type KeywordFilters as Filters } from "@/lib/seo-agent/keywords-data";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { KEYWORD_STATUSES } from "@/lib/seo-agent/constants";
import { KeywordFilters } from "./KeywordFilters";
import { KeywordTable } from "./KeywordTable";
import { ImportKeywordsDialog } from "./ImportKeywordsDialog";

export const metadata: Metadata = {
  title: "Keywords | SEO Agent",
  description: "Manage SEO target keywords and run the Keyword Analysis Agent.",
};

export const dynamic = "force-dynamic";
// Keyword analysis runs an AI call inside a server action on this route.
export const maxDuration = 120;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function parseFilters(sp: Record<string, string | undefined>): Filters {
  const cls = Number(sp.class);
  return {
    q: sp.q?.trim() || undefined,
    status: sp.status && (KEYWORD_STATUSES as readonly string[]).includes(sp.status) ? sp.status : undefined,
    priority: sp.priority && ["HIGH", "MEDIUM", "LOW"].includes(sp.priority) ? sp.priority : undefined,
    subject: sp.subject || undefined,
    targetClass: Number.isInteger(cls) && cls >= 1 && cls <= 12 ? cls : undefined,
    clustered: sp.clustered === "yes" || sp.clustered === "no" ? sp.clustered : undefined,
    page: parsePage(sp.page),
  };
}

async function load(filters: Filters) {
  try {
    return await listKeywords(filters);
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function KeywordsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const filters = parseFilters(await searchParams);
  const result = await load(filters);

  return (
    <SeoAgentShell
      title="Keywords"
      subtitle={result ? `${result.count} keyword${result.count === 1 ? "" : "s"}. Select some and click Analyze to build clusters.` : undefined}
      actions={result ? <ImportKeywordsDialog /> : undefined}
    >
      {!result ? (
        <SchemaMissingNotice />
      ) : (
        <OACard className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <SearchInput placeholder="Search keywords…" />
            <KeywordFilters />
          </div>
          <KeywordTable rows={result.rows} />
          <Pagination page={filters.page} totalPages={totalPages(result.count, KEYWORDS_PAGE_SIZE)} totalCount={result.count} pageSize={KEYWORDS_PAGE_SIZE} />
        </OACard>
      )}
    </SeoAgentShell>
  );
}
