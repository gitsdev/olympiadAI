import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import type { StoredSiteAudit } from "@/lib/admin/site-audit";
import type { IssueSeverity } from "@/lib/admin/site-audit-checks";
import { UpdateScoreButton } from "./UpdateScoreButton";

const SEVERITY: Record<IssueSeverity, { Icon: typeof AlertTriangle; color: string; label: string }> = {
  high: { Icon: CircleAlert, color: "var(--danger-tx)", label: "High" },
  medium: { Icon: AlertTriangle, color: "var(--warning-tx)", label: "Medium" },
  low: { Icon: Info, color: "var(--fg-muted)", label: "Low" },
};

function barColor(score: number) {
  return score >= 80 ? "var(--success)" : score >= 50 ? "var(--gold-500)" : "var(--danger-tx)";
}

const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "");

/** Breakdown of the latest on-site SEO audit. */
export function SiteAuditCard({ audit, tableMissing, asOf }: { audit: StoredSiteAudit | null; tableMissing: boolean; asOf: string | null }) {
  return (
    <OACard className="flex flex-col gap-4">
      <OACardHeader className="mb-0 gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <OACardTitle>Site SEO audit</OACardTitle>
          <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
            {audit ? `${audit.pagesChecked} pages from the sitemap · checked ${asOf}` : "Measures your own pages. Not domain authority."}
          </span>
        </div>
        {!tableMissing && <UpdateScoreButton />}
      </OACardHeader>

      {tableMissing && (
        <p className="text-[13px] p-3 rounded-[var(--r-md)]" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
          Run <code>supabase/migrations/026_seo_autopilot.sql</code> in Supabase to turn on the site audit.
        </p>
      )}
      {!tableMissing && !audit && (
        <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          No audit yet. <strong>Update score</strong> checks up to 45 sitemap pages for titles, meta descriptions, headings, canonical tags,
          image alt text, internal and broken links, social tags, structured data and server response time.
        </p>
      )}

      {audit && (
        <>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {audit.result.categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-[13px]">
                <span className="w-[190px] shrink-0" style={{ color: "var(--ink-700)" }}>{c.label}</span>
                <div className="h-2 flex-1 rounded-full overflow-hidden" style={{ background: "var(--fill-200)" }}>
                  <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: barColor(c.score) }} />
                </div>
                <span className="w-[30px] text-right tabular-nums font-semibold" style={{ color: "var(--ink-900)" }}>{c.score}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>
              What to fix {audit.result.issues.length ? `(${audit.result.issues.length})` : ""}
            </p>
            {audit.result.issues.length === 0 && <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Nothing found. Nice.</p>}
            <ul className="flex flex-col gap-2">
              {audit.result.issues.slice(0, 15).map((i) => {
                const s = SEVERITY[i.severity];
                return (
                  <li key={`${i.category}-${i.message}`} className="flex gap-2 text-[13px]">
                    <s.Icon size={15} className="shrink-0 mt-0.5" style={{ color: s.color }} aria-label={s.label} />
                    <div className="flex flex-col min-w-0">
                      <span style={{ color: "var(--ink-900)" }}>{i.message} <span style={{ color: "var(--fg-muted)" }}>· {i.count}</span></span>
                      <span className="text-[12px] break-all" style={{ color: "var(--fg-subtle)" }}>
                        {i.examples.map(shortUrl).join(" · ")}{i.count > i.examples.length ? " …" : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </OACard>
  );
}
