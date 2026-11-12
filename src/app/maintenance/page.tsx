import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { Logo } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { readMaintenanceState } from "@/lib/maintenance";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Under Maintenance | OlympiadIQ",
  description: "OlympiadIQ is briefly down for maintenance.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const supabase = await createClient();
  const state = await readMaintenanceState(supabase);
  if (!state.enabled) redirect("/");

  return (
    <div
      className="min-h-screen flex items-center justify-center relative graph-bg px-4"
      style={{ background: "var(--paper)", backgroundSize: "26px 26px" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(80% 60% at 50% 0%, oklch(0.52 0.195 259 / 0.10), transparent 60%)" }}
      />

      <div
        className="oa-fade relative w-full max-w-[420px] rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] p-8 text-center"
        style={{ background: "var(--surface)" }}
      >
        <div className="inline-block w-fit">
          <Logo size={32} />
        </div>

        <div
          className="w-16 h-16 mx-auto mt-7 mb-4 rounded-full flex items-center justify-center"
          style={{ background: "var(--cobalt-50)" }}
        >
          <Wrench size={30} style={{ color: "var(--brand)" }} />
        </div>

        <p
          className="text-[13px] font-semibold tracking-wide mb-1"
          style={{ fontFamily: "var(--font-mono)", color: "var(--brand)" }}
        >
          UNDER MAINTENANCE
        </p>
        <h1
          className="font-bold text-[24px] tracking-tight mb-2"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          We&apos;ll be right back.
        </h1>
        <p className="text-[14px] leading-[1.6] whitespace-pre-line" style={{ color: "var(--fg-muted)" }}>
          {state.message?.trim() || "OlympiadIQ is getting a few improvements. Please check back shortly — your progress is safe."}
        </p>
      </div>
    </div>
  );
}
