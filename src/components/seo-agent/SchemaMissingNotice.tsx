import { DatabaseZap } from "lucide-react";
import { OACard } from "@/components/ui";

/** Shown instead of page content until migration 013 has been applied. */
export function SchemaMissingNotice() {
  return (
    <OACard className="flex gap-4 items-start">
      <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--warning-bg)" }}>
        <DatabaseZap size={20} style={{ color: "var(--warning-tx)" }} aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5 text-[13.5px]" style={{ color: "var(--ink-700)" }}>
        <p className="font-semibold text-[15px]" style={{ color: "var(--ink-900)" }}>SEO Agent database not set up yet</p>
        <p>
          Run <code className="font-mono text-[12.5px]">supabase/migrations/013_seo_agent.sql</code> in the Supabase SQL editor,
          then reload this page.
        </p>
      </div>
    </OACard>
  );
}
