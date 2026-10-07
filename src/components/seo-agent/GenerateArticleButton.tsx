"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateArticleFromPlan } from "@/actions/seo-agent/articles";

/** Runs the Content Writer Agent for a plan, then opens the new article in the editor. */
export function GenerateArticleButton({ planId, disabledReason }: { planId: string; disabledReason?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    const res = await generateArticleFromPlan(planId);
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      return;
    }
    router.push(`/admin/seo-agent/articles/${res.articleId}`);
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="outline" onClick={run} disabled={pending || Boolean(disabledReason)} title={disabledReason}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {pending ? "Writing article… (1–3 min)" : "Generate article"}
      </Button>
      {error && <span role="alert" className="text-[12.5px] max-w-md" style={{ color: "var(--danger-tx)" }}>{error}</span>}
    </span>
  );
}
