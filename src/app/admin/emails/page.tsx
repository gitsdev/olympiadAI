import Link from "next/link";
import { UserX, Clock, UserCheck, MailCheck, MailX } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminSettings } from "@/lib/admin/settings";
import { getCampaignCounts, dueCount, CAMPAIGN_COOLDOWN_DAYS } from "@/lib/admin/campaigns";
import { CAMPAIGNS, CAMPAIGN_IDS, isCampaignId, type CampaignSegment } from "@/lib/email/campaign-templates";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CampaignPanel } from "./CampaignPanel";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminEmailsPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const sp = await searchParams;

  const campaignId = isCampaignId(sp.template) ? sp.template : "reengagement";
  const campaign = CAMPAIGNS[campaignId];
  const segment: CampaignSegment = campaign.segments.includes(sp.audience as CampaignSegment)
    ? (sp.audience as CampaignSegment)
    : campaign.segments[0];

  const settings = await getAdminSettings();
  const inactiveDays = settings.inactive_days_warning;
  const counts = await getCampaignCounts(campaignId, segment, inactiveDays);

  const href = (template: string, audience?: string) =>
    `/admin/emails?template=${template}${audience ? `&audience=${audience}` : ""}`;

  return (
    <AdminShell
      adminName={admin.fullName}
      title="Emails"
      subtitle="Send nudge emails to students in bulk. To email one student, use Send Email on their profile."
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CAMPAIGN_IDS.map((id) => {
            const c = CAMPAIGNS[id];
            const selected = id === campaignId;
            return (
              <Link
                key={id}
                href={href(id)}
                className={cn(
                  "rounded-[var(--r-lg)] border p-4 flex flex-col gap-1.5 transition-colors",
                  selected ? "border-[var(--cobalt-400)] bg-[var(--cobalt-50)]" : "border-[var(--line-200)] bg-[var(--surface)] hover:bg-[var(--fill-100)]",
                )}
                aria-current={selected ? "page" : undefined}
              >
                <span className="text-[22px] leading-none">{c.emoji}</span>
                <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>{c.label}</span>
                <span className="text-[12px] leading-[1.45]" style={{ color: "var(--fg-muted)" }}>{c.description}</span>
              </Link>
            );
          })}
        </div>

        {campaign.segments.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap text-[13px]">
            <span style={{ color: "var(--fg-muted)" }}>Send to:</span>
            {campaign.segments.map((s) => (
              <Link
                key={s}
                href={href(campaignId, s)}
                className={cn(
                  "px-3 py-1.5 rounded-[var(--r-md)] border font-medium transition-colors",
                  s === segment ? "bg-[var(--cobalt-50)] border-[var(--cobalt-200)] text-[var(--cobalt-700)]" : "border-[var(--line-200)] hover:bg-[var(--fill-100)]",
                )}
              >
                {s === "all" ? "All students" : `Inactive ${inactiveDays}+ days`}
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Never started" value={String(counts.neverStarted)} hint="Signed up, never practised" Icon={UserX} tone="warning" />
          <StatCard label="Lapsed" value={String(counts.lapsed)} hint={`Inactive ${inactiveDays}+ days`} Icon={Clock} tone="warning" />
          {segment === "all" && (
            <StatCard label="Active" value={String(counts.active)} hint={`Active in last ${inactiveDays} days`} Icon={UserCheck} />
          )}
          <StatCard label="Recently emailed" value={String(counts.recentlyEmailed)} hint={`Got this email in last ${CAMPAIGN_COOLDOWN_DAYS} days`} Icon={MailCheck} />
          <StatCard label="Unsubscribed" value={String(counts.optedOut)} hint="Never emailed" Icon={MailX} />
        </div>

        <OACard>
          <OACardHeader><OACardTitle>{campaign.emoji} {campaign.label}</OACardTitle></OACardHeader>
          <CampaignPanel
            key={`${campaignId}-${segment}`}
            campaignId={campaignId}
            segment={segment}
            due={dueCount(counts)}
            adminEmail={admin.email}
            cooldownDays={CAMPAIGN_COOLDOWN_DAYS}
          />
        </OACard>
      </div>
    </AdminShell>
  );
}
