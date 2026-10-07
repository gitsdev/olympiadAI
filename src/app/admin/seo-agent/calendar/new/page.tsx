import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { PlanForm } from "../PlanForm";

export const metadata: Metadata = { title: "New Content Plan | SEO Agent", description: "Create a content plan by hand." };
export const dynamic = "force-dynamic";

async function load() {
  try {
    return await getSeoSettings();
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function NewPlanPage() {
  await requireAdmin();
  const settings = await load();

  return (
    <SeoAgentShell title="New content plan" subtitle="Plan an article by hand. AI plans come from Content Opportunities.">
      {!settings ? (
        <SchemaMissingNotice />
      ) : (
        <PlanForm
          editable
          timezone={settings.timezone}
          initial={{
            title: "", primaryKeyword: "", secondaryKeywords: [], searchIntent: "", contentType: "", targetAudience: "",
            outline: [], recommendedCta: settings.defaultCta, internalLinks: [], plannedDate: "",
            plannedTime: settings.defaultPublishTime, status: "IDEA", notes: "",
          }}
        />
      )}
    </SeoAgentShell>
  );
}
