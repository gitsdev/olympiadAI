import { requireAdmin } from "@/lib/admin/auth";
import { getAdminSettings } from "@/lib/admin/settings";
import { listRecentAuditLog } from "@/lib/admin/audit";
import { AdminShell } from "@/components/admin/AdminShell";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { EmptyState } from "@/components/admin/EmptyState";
import { ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

const ACTION_LABELS: Record<string, string> = {
  student_updated: "Updated student",
  student_suspended: "Suspended student",
  student_activated: "Activated student",
  password_reset_sent: "Sent password reset",
  data_exported: "Exported data",
  settings_updated: "Updated settings",
};

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const [settings, auditLog] = await Promise.all([
    getAdminSettings(),
    listRecentAuditLog(25),
  ]);

  return (
    <AdminShell adminName={admin.fullName} title="Settings" subtitle="Configurable thresholds and admin activity log">
      <div className="flex flex-col gap-5">
        <OACard>
          <OACardHeader><OACardTitle>Dashboard Thresholds</OACardTitle></OACardHeader>
          <SettingsForm settings={settings} />
        </OACard>

        <OACard>
          <OACardHeader><OACardTitle>Recent Admin Activity</OACardTitle></OACardHeader>
          {auditLog.length === 0 ? (
            <EmptyState Icon={ClipboardList} title="No admin actions recorded yet" />
          ) : (
            <ul className="flex flex-col divide-y" style={{ borderColor: "var(--line-200)" }}>
              {auditLog.map((entry) => (
                <li key={entry.id} className="py-2.5 flex items-center justify-between gap-3 text-[13px]">
                  <span style={{ color: "var(--ink-900)" }}>
                    <span className="font-semibold">{entry.admin_name ?? "Unknown admin"}</span>
                    {" "}{ACTION_LABELS[entry.action] ?? entry.action}
                    {entry.target_type !== "admin_settings" && entry.target_id ? ` (${entry.target_type} ${entry.target_id.slice(0, 8)})` : ""}
                  </span>
                  <span className="shrink-0" style={{ color: "var(--fg-muted)" }}>{formatDateTime(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </OACard>
      </div>
    </AdminShell>
  );
}
