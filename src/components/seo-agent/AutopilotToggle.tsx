"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setAutopilotEnabled } from "@/actions/seo-agent/automation";

/** On/off switch for the daily autopilot. */
export function AutopilotToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function toggle() {
    const next = !on;
    setPending(true);
    setMessage(null);
    const r = await setAutopilotEnabled(next);
    setPending(false);
    if (!r.ok) { setMessage({ ok: false, text: r.error }); return; }
    setOn(next);
    setMessage({ ok: true, text: r.message });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Autopilot"
        onClick={toggle}
        disabled={pending}
        className="inline-flex items-center gap-2.5 rounded-full pl-1 pr-3.5 py-1 text-[13px] font-semibold transition-colors disabled:opacity-60"
        style={{
          background: on ? "var(--cobalt-500)" : "var(--fill-200)",
          color: on ? "white" : "var(--ink-700)",
        }}
      >
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-full transition-transform"
          style={{ background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
        >
          {pending && <Loader2 size={13} className="animate-spin" style={{ color: "var(--cobalt-700)" }} />}
        </span>
        Autopilot {on ? "on" : "off"}
      </button>
      {message && (
        <span role="status" className="text-[12px] text-right max-w-[320px]" style={{ color: message.ok ? "var(--fg-muted)" : "var(--danger-tx)" }}>
          {message.text}
        </span>
      )}
    </div>
  );
}
