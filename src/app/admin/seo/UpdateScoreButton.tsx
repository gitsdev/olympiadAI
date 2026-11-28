"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateSiteSeoScore } from "@/actions/admin/seo";

/** Re-runs the on-site SEO audit against the live site. */
export function UpdateScoreButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function update() {
    setPending(true);
    setMessage(null);
    const r = await updateSiteSeoScore();
    setPending(false);
    if (!r.ok) { setMessage({ ok: false, text: r.error }); return; }
    setMessage({ ok: true, text: `Score updated: ${r.score}/100 across ${r.pages} pages, ${r.issues} issue type(s) found.` });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {message && (
        <span role="status" className="text-[12.5px]" style={{ color: message.ok ? "var(--fg-muted)" : "var(--danger-tx)" }}>{message.text}</span>
      )}
      <Button variant="outline" size="sm" onClick={update} disabled={pending}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {pending ? "Checking the site… (~30 s)" : "Update score"}
      </Button>
    </div>
  );
}
