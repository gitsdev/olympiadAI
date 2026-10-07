import Link from "next/link";
import type { Metadata } from "next";
import { Network } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { EmptyState } from "@/components/admin/EmptyState";
import { OACard } from "@/components/ui";
import { CLUSTERS_LIMIT, listClusters } from "@/lib/seo-agent/clusters-data";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { cn } from "@/lib/utils";
import { ClusterCard } from "./ClusterCard";

export const metadata: Metadata = {
  title: "Keyword Clusters | SEO Agent",
  description: "Keyword clusters and article recommendations from the Keyword Analysis Agent.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function load(status: "ACTIVE" | "ARCHIVED") {
  try {
    return await listClusters(status);
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function ClustersPage({ searchParams }: PageProps) {
  await requireAdmin();
  const status = (await searchParams).status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
  const clusters = await load(status);

  return (
    <SeoAgentShell title="Keyword Clusters" subtitle="Groups of keywords one article can serve, with the agent's recommendation">
      {!clusters ? (
        <SchemaMissingNotice />
      ) : (
        <div className="flex flex-col gap-4">
          <nav className="flex gap-1 p-1 rounded-[var(--r-md)] w-fit" style={{ background: "var(--fill-100)" }} aria-label="Cluster status">
            {(["ACTIVE", "ARCHIVED"] as const).map((s) => (
              <Link key={s} href={s === "ACTIVE" ? "/admin/seo-agent/clusters" : "/admin/seo-agent/clusters?status=ARCHIVED"}
                aria-current={status === s ? "page" : undefined}
                className={cn("px-3 py-1 rounded-[var(--r-sm)] text-[13px] font-semibold", status === s ? "bg-[var(--surface)] text-[var(--ink-900)]" : "text-[var(--ink-500)]")}>
                {s === "ACTIVE" ? "Active" : "Archived"}
              </Link>
            ))}
          </nav>

          {clusters.length === 0 ? (
            <OACard>
              <EmptyState
                Icon={Network}
                title={status === "ACTIVE" ? "No clusters yet" : "No archived clusters"}
                description={status === "ACTIVE" ? "Go to Keywords, select some keywords and click Analyze keywords." : undefined}
                action={status === "ACTIVE" ? <Link href="/admin/seo-agent/keywords" className="text-[13px] font-semibold" style={{ color: "var(--cobalt-700)" }}>Go to Keywords →</Link> : undefined}
              />
            </OACard>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {clusters.map((c) => <ClusterCard key={c.id} cluster={c} />)}
            </div>
          )}
          {clusters.length >= CLUSTERS_LIMIT && (
            <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>Showing the {CLUSTERS_LIMIT} most recently updated clusters.</p>
          )}
        </div>
      )}
    </SeoAgentShell>
  );
}
