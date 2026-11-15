"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postAdmin } from "./actions";

/** Asks Razorpay about unsettled purchases (last 72h) and fulfils any that were paid. */
export function ReconcileButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setResult(null);
    try {
      const r = await postAdmin<{ checked: number; fulfilled: number; failed: number; errors: number }>("/api/admin/credits/reconcile", {});
      setResult(`Checked ${r.checked} · fulfilled ${r.fulfilled} · closed ${r.failed}${r.errors ? ` · ${r.errors} errors` : ""}`);
      router.refresh();
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-[12px] hidden sm:inline" style={{ color: "var(--fg-muted)" }}>{result}</span>}
      <Button variant="outline" size="sm" onClick={run} disabled={pending}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reconcile payments
      </Button>
    </div>
  );
}
