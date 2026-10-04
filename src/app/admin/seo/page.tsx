import { KeyRound, Flame, Target, Trophy } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { SEO_KEYWORDS, SEO_COMPETITORS, OUR_SITE, SEO_DATA_AS_OF } from "@/lib/admin/seo-data";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { CompetitorTable } from "./CompetitorTable";
import { KeywordExplorer } from "./KeywordExplorer";

export default async function AdminSeoPage() {
  const admin = await requireAdmin();

  const p1 = SEO_KEYWORDS.filter((kw) => kw.priority === "P1").length;
  const easyWins = SEO_KEYWORDS.filter((kw) => kw.difficulty === "low").length;
  const avgCompetitorScore = Math.round(
    SEO_COMPETITORS.reduce((sum, c) => sum + c.seoScore, 0) / SEO_COMPETITORS.length,
  );
  const asOf = new Date(SEO_DATA_AS_OF).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <AdminShell
      adminName={admin.fullName}
      title="SEO"
      subtitle={`Target keywords and the top 10 competitors. Estimates as of ${asOf}. Update them in src/lib/admin/seo-data.ts.`}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Tracked keywords" value={String(SEO_KEYWORDS.length)} hint="Across 8 topic clusters" Icon={KeyRound} />
          <StatCard label="P1 keywords" value={String(p1)} hint="Go after these first" Icon={Flame} tone="warning" />
          <StatCard label="Easy wins" value={String(easyWins)} hint="Low difficulty" Icon={Target} />
          <StatCard
            label="Your SEO score"
            value={`${OUR_SITE.seoScore} / 100`}
            hint={`Competitor avg ${avgCompetitorScore}`}
            Icon={Trophy}
            tone="danger"
          />
        </div>

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
