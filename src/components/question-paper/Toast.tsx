"use client";

import { useCallback, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface ToastMsg { id: number; kind: "success" | "error"; text: string }

/** Minimal toast queue for the solver screens (the app has no global toaster). */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const push = useCallback((kind: ToastMsg["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);
  return { toasts, push };
}

export function Toasts({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[min(92vw,420px)] qps-no-print" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className="flex items-start gap-2 rounded-[var(--r-md)] px-3.5 py-2.5 text-[13.5px] shadow-[var(--shadow-md)] border"
          style={t.kind === "error"
            ? { background: "var(--danger-bg)", color: "var(--danger-tx)", borderColor: "var(--danger)" }
            : { background: "var(--surface)", color: "var(--ink-900)", borderColor: "var(--line-200)" }}
        >
          {t.kind === "error" ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
