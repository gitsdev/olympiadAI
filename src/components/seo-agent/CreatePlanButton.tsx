"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPlanFromOpportunity } from "@/actions/seo-agent/content";

/** Runs the Content Planner Agent for an opportunity, then opens the new plan. */
export function CreatePlanButton({ opportunityId, size = "sm" }: { opportunityId: string; size?: "sm" | "default" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    const res = await createPlanFromOpportunity(opportunityId);
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      return;
    }
    const q = res.warnings.length ? `?notes=${encodeURIComponent(res.warnings.join("\n"))}` : "";
    router.push(`/admin/seo-agent/calendar/${res.planId}${q}`);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button size={size} onClick={run} disabled={pending}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
        {pending ? "Planning… (10–60s)" : "Create content plan"}
      </Button>
      {error && <p role="alert" className="text-[12.5px] max-w-md" style={{ color: "var(--danger-tx)" }}>{error}</p>}
    </div>
  );
}
