import { requireAdmin } from "@/lib/admin/auth";
import { getPlatformSubjectPerformance, getStudentsNeedingAttention } from "@/lib/admin/dashboard";
import { getAdminSettings } from "@/lib/admin/settings";
import { resolveDateRange } from "@/lib/admin/date-range";
import { AdminShell } from "@/components/admin/AdminShell";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { PlatformSubjectPerformance } from "@/components/admin/SubjectProgress";
import { AttentionStudentsTable } from "@/components/admin/AttentionStudentsTable";
import { InactivityThresholdSelect } from "./InactivityThresholdSelect";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminProgressPage({ searchParams }: PageProps) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const { from, to } = resolveDateRange(sp);
  const settings = await getAdminSettings();
  const inactiveDays = sp.inactiveDays ? Number(sp.inactiveDays) : settings.inactive_days_warning;

  const [subjectPerf, attention] = await Promise.all([
    getPlatformSubjectPerformance(from, to),
    getStudentsNeedingAttention(inactiveDays, settings.low_score_threshold, settings.low_ai_engagement_sessions),
  ]);

  return (
    <AdminShell adminName={admin.fullName} title="Student Progress" subtitle="Platform-wide performance and engagement">
      <div className="flex flex-col gap-5">
        <DateRangeFilter />

        <OACard>
          <OACardHeader><OACardTitle>Subject Performance</OACardTitle></OACardHeader>
          <PlatformSubjectPerformance rows={subjectPerf} />
        </OACard>

        <OACard>
          <OACardHeader className="flex-wrap gap-2">
            <div>
              <OACardTitle>Students Needing Attention</OACardTitle>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                Based on thresholds set in <Link href="/admin/settings" className="hover:underline" style={{ color: "var(--brand)" }}>Settings</Link>
              </p>
            </div>
            <InactivityThresholdSelect defaultDays={settings.inactive_days_warning} />
          </OACardHeader>
          <AttentionStudentsTable rows={attention.rows} />
        </OACard>
      </div>
    </AdminShell>
  );
}
