"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { newIdempotencyKey, postAdmin } from "./actions";

const QUICK_AMOUNTS = [25, 50, 100, 250];

/**
 * Manually add credits to one student (an admin_adjustment ledger entry with
 * a mandatory reason, audit-logged). Deductions live on the wallet page.
 */
export function AddCreditsDialog({
  userId, studentName, open, onOpenChange,
}: { userId: string; studentName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  // One key per intended grant: a double-click or retry can't add twice.
  const keyRef = useRef(newIdempotencyKey());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/admin/credits/students?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { summary?: { balance: number } } | null) => { if (!cancelled) setBalance(d?.summary?.balance ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, userId]);

  function reset() {
    setAmount(""); setReason(""); setError(null); setDone(null); setBalance(null);
    keyRef.current = newIdempotencyKey();
  }

  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0 && n <= 1_000_000 && reason.trim().length >= 3;

  async function submit() {
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await postAdmin<{ balance: number }>("/api/admin/credits/adjust", {
        userId, amount: n, reason: reason.trim(), idempotencyKey: keyRef.current,
      });
      setDone(res.balance);
      setBalance(res.balance);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add credits</DialogTitle>
          <DialogDescription>
            {studentName}{balance !== null ? ` · current balance ${balance.toLocaleString("en-IN")} credits` : ""}
          </DialogDescription>
        </DialogHeader>

        {done !== null ? (
          <p className="text-[13.5px] rounded-[var(--r-md)] px-3 py-2.5" style={{ background: "var(--success-bg)", color: "var(--success-tx)" }}>
            Added {n.toLocaleString("en-IN")} credits. New balance: {done.toLocaleString("en-IN")} credits.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-credits-amount">Credits to add</Label>
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_AMOUNTS.map((q) => (
                  <button key={q} type="button" onClick={() => setAmount(String(q))}
                    className="px-2.5 py-1 rounded-full text-[12px] font-semibold border transition-colors"
                    style={amount === String(q)
                      ? { background: "var(--cobalt-50)", color: "var(--cobalt-700)", borderColor: "var(--cobalt-200)" }
                      : { color: "var(--ink-700)", borderColor: "var(--line-300)" }}>
                    +{q}
                  </button>
                ))}
              </div>
              <Input id="add-credits-amount" inputMode="numeric" placeholder="e.g. 50" value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 7))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-credits-reason">Reason (required)</Label>
              <Textarea id="add-credits-reason" rows={2} maxLength={500} value={reason}
                placeholder="e.g. Compensation for a failed mock test" onChange={(e) => setReason(e.target.value)} />
              <p className="text-[11.5px]" style={{ color: "var(--fg-muted)" }}>Saved in the student&apos;s credit history and the admin audit log.</p>
            </div>
            {error && <p className="text-[12.5px]" style={{ color: "var(--danger-tx)" }}>{error}</p>}
          </div>
        )}

        <DialogFooter>
          {done !== null ? (
            <Button onClick={() => { onOpenChange(false); reset(); }}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
              <Button onClick={submit} disabled={!valid || pending}>
                {pending && <Loader2 size={14} className="animate-spin" />}
                Add {n > 0 ? n.toLocaleString("en-IN") : ""} credits
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
