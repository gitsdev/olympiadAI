"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { setMaintenanceMode } from "@/actions/admin/maintenance";
import type { MaintenanceState } from "@/lib/maintenance";

export function MaintenanceToggle({ state }: { state: MaintenanceState }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(state.message ?? "");
  const [error, setError] = useState<string | null>(null);
  const enabling = !state.enabled;

  async function handleConfirm() {
    setError(null);
    const res = await setMaintenanceMode(enabling, message);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-[var(--r-lg)] border p-4"
      style={{
        borderColor: state.enabled ? "var(--warning)" : "var(--line-200)",
        background: state.enabled ? "var(--warning-bg)" : "var(--surface)",
      }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Wrench size={18} className="mt-0.5 shrink-0" style={{ color: state.enabled ? "var(--warning-tx)" : "var(--fg-muted)" }} />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>
            Maintenance mode: {state.enabled ? "ON" : "Off"}
          </p>
          <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            {state.enabled
              ? "The site is closed to everyone except admins. Students see the maintenance page."
              : "When on, every visitor except admins sees the maintenance page and APIs return 503."}
          </p>
          <div className="mt-2 max-w-xl">
              <label htmlFor="maintenance-message" className="block text-[12px] font-medium" style={{ color: "var(--fg-muted)" }}>
                Message shown to users (optional)
              </label>
              <textarea
                id="maintenance-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={2}
                className="mt-1 w-full rounded-[var(--r-md)] border px-2.5 py-1.5 text-[13px]"
                style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}
              />
              {state.enabled && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={async () => {
                    setError(null);
                    const res = await setMaintenanceMode(true, message);
                    if (res.error) setError(res.error);
                    else router.refresh();
                  }}
                >
                  Save message
                </Button>
              )}
          </div>
          {error && <p className="text-[12.5px] mt-1" style={{ color: "var(--danger-tx)" }}>{error}</p>}
        </div>
      </div>
      <Button
        variant={enabling ? "destructive" : "default"}
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        {enabling ? "Put site under maintenance" : "Bring site back online"}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={enabling ? "Put the site under maintenance?" : "Bring the site back online?"}
        description={
          enabling
            ? "All students and visitors will be sent to the maintenance page until you turn this off. Admins keep full access. It can take up to 10 seconds to apply everywhere."
            : "Everyone will be able to use OlympiadIQ again. It can take up to 10 seconds to apply everywhere."
        }
        confirmLabel={enabling ? "Turn on maintenance" : "Go back online"}
        destructive={enabling}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
