"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { newIdempotencyKey, postAdmin } from "./actions";

/** Manual add/deduct with a mandatory reason. Every submit writes a ledger entry. */
export function AdjustCreditsForm({ userId, balance }: { userId: string; balance: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // One key per intended adjustment: a double-click or network retry can't apply it twice.
  const keyRef = useRef(newIdempotencyKey());

  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0 && reason.trim().length >= 3 && (mode === "add" || n <= balance);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await postAdmin<{ balance: number }>("/api/admin/credits/adjust", {
        userId, amount: mode === "add" ? n : -n, reason: reason.trim(), idempotencyKey: keyRef.current,
      });
      setMessage({ ok: true, text: `Done. New balance: ${res.balance.toLocaleString("en-IN")} credits.` });
      setAmount("");
      setReason("");
      keyRef.current = newIdempotencyKey();
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[var(--r-lg)] border p-4 flex flex-col gap-3"
      style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}>
      <h3 className="text-[14px] font-bold" style={{ color: "var(--ink-900)" }}>Manual adjustment</h3>
      <div className="grid grid-cols-2 gap-1 p-1 rounded-[var(--r-md)]" style={{ background: "var(--fill-100)" }} role="radiogroup" aria-label="Adjustment type">
        {(["add", "deduct"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
            className={cn("flex items-center justify-center gap-1.5 py-1.5 rounded-[var(--r-sm)] text-[13px] font-semibold transition-colors",
              mode === m ? "bg-[var(--surface)] shadow-[var(--shadow-xs)] text-[var(--ink-900)]" : "text-[var(--ink-500)]")}>
            {m === "add" ? <Plus size={14} /> : <Minus size={14} />} {m === "add" ? "Add" : "Deduct"}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adj-amount">Credits</Label>
        <Input id="adj-amount" inputMode="numeric" value={amount} placeholder="e.g. 50"
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 7))} />
        {mode === "deduct" && n > balance && (
          <p className="text-[12px]" style={{ color: "var(--danger-tx)" }}>Can&apos;t deduct more than the balance ({balance}).</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adj-reason">Reason (required)</Label>
        <Textarea id="adj-reason" value={reason} maxLength={500} rows={2} placeholder="Shown in the ledger and audit log"
          onChange={(e) => setReason(e.target.value)} />
      </div>
      {message && <p className="text-[12.5px]" style={{ color: message.ok ? "var(--success-tx)" : "var(--danger-tx)" }}>{message.text}</p>}
      <Button type="submit" disabled={!valid || pending}>
        {pending && <Loader2 size={14} className="animate-spin" />}
        {mode === "add" ? "Add credits" : "Deduct credits"}
      </Button>
    </form>
  );
}
