import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getCreditRole, hasCreditRole, profilesById } from "@/lib/credits/admin";
import { listFeaturePricing } from "@/lib/credits/pricing";
import { AdminShell } from "@/components/admin/AdminShell";
import { CreditsNav } from "@/components/admin/credits/CreditsNav";
import { PricingEditor } from "@/components/admin/credits/PricingEditor";

export const metadata: Metadata = { title: "Feature Pricing | OlympiadIQ Admin" };
export const dynamic = "force-dynamic";

export default async function AdminCreditPricingPage() {
  const admin = await requireAdmin();
  const service = createServiceClient();
  const [features, role] = await Promise.all([listFeaturePricing(service), getCreditRole(service, admin.id)]);
  const names = await profilesById(service, features.map((f) => f.updated_by));

  return (
    <AdminShell adminName={admin.fullName} title="Credit Management" subtitle="Feature pricing">
      <CreditsNav />
      <p className="text-[13px] mb-4 max-w-[720px]" style={{ color: "var(--fg-muted)" }}>
        A feature consumes credits only when <strong>Charging</strong> is on and it has a cost above 0. Otherwise it stays free.
        Credits are deducted when a session starts successfully. Every change is audit-logged.
      </p>
      <PricingEditor
        canEdit={hasCreditRole(role, "admin")}
        rows={features.map((f) => ({
          feature_key: f.feature_key, feature_name: f.feature_name, credit_cost: f.credit_cost, is_enabled: f.is_enabled,
          updated_at: f.updated_at, updated_by_name: f.updated_by ? names.get(f.updated_by)?.full_name ?? "Unknown" : null,
        }))}
      />
    </AdminShell>
  );
}
