import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { SeoAgentShell } from "@/components/seo-agent/SeoAgentShell";
import { SchemaMissingNotice } from "@/components/seo-agent/SchemaMissingNotice";
import { getSecretStatus, getSeoSettings } from "@/lib/seo-agent/settings-data";
import { SeoSchemaMissingError } from "@/lib/seo-agent/db";
import { SeoSettingsForm } from "./SeoSettingsForm";

export const metadata: Metadata = {
  title: "SEO Agent Settings | OlympiadIQ Admin",
  description: "AI, publishing, scheduling, Search Console and brand settings for the SEO Agent.",
};

export const dynamic = "force-dynamic";

async function loadSettings() {
  try {
    return await getSeoSettings();
  } catch (err) {
    if (err instanceof SeoSchemaMissingError) return null;
    throw err;
  }
}

export default async function SeoAgentSettingsPage() {
  await requireAdmin();
  const settings = await loadSettings();

  return (
    <SeoAgentShell title="Settings" subtitle="AI, publishing, schedules, Search Console and brand profile">
      {settings ? <SeoSettingsForm initial={settings} secrets={getSecretStatus()} /> : <SchemaMissingNotice />}
    </SeoAgentShell>
  );
}
