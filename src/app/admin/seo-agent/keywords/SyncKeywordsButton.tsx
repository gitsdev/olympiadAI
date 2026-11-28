"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncKeywordsFromAdminSeo } from "@/actions/seo-agent/keywords";

/** Pulls in target keywords from /admin/seo that aren't here yet. The autopilot also does this daily. */
export function SyncKeywordsButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function sync() {
    setPending(true);
    setMessage(null);
    const r = await syncKeywordsFromAdminSeo();
    setPending(false);
    if (!r.ok) { setMessage({ ok: false, text: r.error }); return; }
    setMessage({ ok: true, text: r.added ? `Added ${r.added} keyword(s) from /admin/seo.` : `All ${r.total} /admin/seo keywords are already here.` });
    if (r.added) router.refresh();
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {message && (
        <span role="status" className="text-[12px]" style={{ color: message.ok ? "var(--fg-muted)" : "var(--danger-tx)" }}>{message.text}</span>
      )}
      <Button variant="outline" size="sm" onClick={sync} disabled={pending} title="Add the target keywords listed on /admin/seo">
        {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync from /admin/seo
      </Button>
    </div>
  );
}
