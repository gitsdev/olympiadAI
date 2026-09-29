import { UserX, Clock, MailCheck, MailX } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getReengagementCounts, getReengagementPreviews, REENGAGEMENT_COOLDOWN_DAYS } from "@/lib/admin/campaigns";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/admin/StatCard";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { ReengagementPanel } from "./ReengagementPanel";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  const admin = await requireAdmin();
  const previews = await getReengagementPreviews();
  const counts = await getReengagementCounts(previews.inactiveDays);
  const due = counts.neverStarted + counts.lapsed;

  return (
    <AdminShell
      adminName={admin.fullName}
      title="Emails"
      subtitle={`Re-engage students inactive for ${previews.inactiveDays}+ days (threshold set in Settings)`}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Never started" value={String(counts.neverStarted)} hint="Signed up, never practised" Icon={UserX} tone="warning" />
          <StatCard label="Lapsed" value={String(counts.lapsed)} hint={`Inactive ${previews.inactiveDays}+ days`} Icon={Clock} tone="warning" />
          <StatCard label="Recently emailed" value={String(counts.recentlyEmailed)} hint={`Skipped for ${REENGAGEMENT_COOLDOWN_DAYS} days`} Icon={MailCheck} />
          <StatCard label="Unsubscribed" value={String(counts.optedOut)} hint="Never emailed" Icon={MailX} />
        </div>

        <OACard>
          <OACardHeader><OACardTitle>&ldquo;What are you still waiting for?&rdquo; campaign</OACardTitle></OACardHeader>
          <ReengagementPanel
            due={due}
            adminEmail={previews.adminEmail}
            previews={{
              neverStarted: previews.neverStarted,
              lapsed: previews.lapsed,
              parent: previews.parent,
            }}
          />
        </OACard>
      </div>
    </AdminShell>
  );
}
