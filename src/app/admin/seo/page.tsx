import { KeyRound, Flame, Target, Trophy } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { SEO_KEYWORDS, SEO_COMPETITORS, OUR_SITE, SEO_DATA_AS_OF } from "@/lib/admin/seo-data";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getLatestSiteAudit } from "@/lib/admin/site-audit";
import { CompetitorTable } from "./CompetitorTable";
import { KeywordExplorer } from "./KeywordExplorer";
import { SiteAuditCard } from "./SiteAuditCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SEO | OlympiadIQ Admin",
  description: "Track OlympiadIQ target keywords and competitors.",
};

export const dynamic = "force-dynamic";
// "Update score" crawls up to 45 pages inside a server action on this route.
export const maxDuration = 120;

export default async function AdminSeoPage() {
  const admin = await requireAdmin();
  const { audit, tableMissing } = await getLatestSiteAudit(await createClient());
  const auditAsOf = audit
    ? new Date(audit.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : null;

  const p1 = SEO_KEYWORDS.filter((kw) => kw.priority === "P1").length;
  const easyWins = SEO_KEYWORDS.filter((kw) => kw.difficulty === "low").length;
  const asOf = new Date(SEO_DATA_AS_OF).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <AdminShell
      adminName={admin.fullName}
      title="SEO"
      subtitle={`Your measured site SEO score, target keywords and the top 10 competitors. Keyword and competitor figures are estimates as of ${asOf} (src/lib/admin/seo-data.ts). The SEO Agent picks up these keywords automatically.`}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Tracked keywords" value={String(SEO_KEYWORDS.length)} hint="Across 8 topic clusters" Icon={KeyRound} />
          <StatCard label="P1 keywords" value={String(p1)} hint="Go after these first" Icon={Flame} tone="warning" />
          <StatCard label="Easy wins" value={String(easyWins)} hint="Low difficulty" Icon={Target} />
          <StatCard
            label="Your SEO score"
            value={audit ? `${audit.score} / 100` : "Not measured"}
            hint={audit ? `On-site audit · ${auditAsOf}` : "Click Update score below"}
            Icon={Trophy}
            tone={!audit ? "default" : audit.score >= 80 ? "default" : audit.score >= 50 ? "warning" : "danger"}
          />
        </div>

        <SiteAuditCard audit={audit} tableMissing={tableMissing} asOf={auditAsOf} />

        <OACard>
          <OACardHeader><OACardTitle>Top 10 competitors</OACardTitle></OACardHeader>
          <CompetitorTable competitors={SEO_COMPETITORS} ours={OUR_SITE} />
        </OACard>

        <OACard>
          <OACardHeader><OACardTitle>SEO keywords</OACardTitle></OACardHeader>
          <KeywordExplorer keywords={SEO_KEYWORDS} />
        </OACard>
      </div>
    </AdminShell>
  );
}
