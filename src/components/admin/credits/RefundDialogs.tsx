"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { postAdmin } from "./actions";

/** Refund a Razorpay purchase (money back + credits removed). Super admins only. */
export function RefundPurchaseDialog({ purchaseId, refundableCredits, studentName }: {
  purchaseId: string; refundableCredits: number; studentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(String(refundableCredits));
  const [reason, setReason] = useState("");
  const [allowShortfall, setAllowShortfall] = useState(false);
  const [needsShortfall, setNeedsShortfall] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = Number(credits);
  const valid = Number.isInteger(n) && n >= 1 && n <= refundableCredits && reason.trim().length >= 3;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await postAdmin("/api/admin/credits/refund", { purchaseId, credits: n, reason: reason.trim(), allowShortfall });
      setOpen(false);
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (/already spent/i.test(msg)) setNeedsShortfall(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <RotateCcw size={13} /> Refund
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Refund purchase</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3 text-[13px]">
          <p style={{ color: "var(--fg-muted)" }}>
            Refunds ₹{n > 0 ? n.toLocaleString("en-IN") : 0} to {studentName} through Razorpay and removes the same number of credits.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rf-credits">Credits to refund (max {refundableCredits})</Label>
            <Input id="rf-credits" inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/[^\d]/g, ""))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rf-reason">Reason (required)</Label>
            <Textarea id="rf-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {needsShortfall && (
            <label className="flex items-start gap-2" style={{ color: "var(--ink-700)" }}>
              <input type="checkbox" checked={allowShortfall} onChange={(e) => setAllowShortfall(e.target.checked)} className="mt-0.5" />
              Refund the money anyway and remove only the credits that are left.
            </label>
          )}
          {error && <p style={{ color: "var(--danger-tx)" }}>{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={!valid || pending}>
            {pending && <Loader2 size={14} className="animate-spin" />} Refund ₹{n > 0 ? n.toLocaleString("en-IN") : 0}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Give back one feature charge (no money moves). */
export function RefundUsageDialog({ transactionId, credits }: { transactionId: string; credits: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await postAdmin("/api/admin/credits/refund", { usageTransactionId: transactionId, reason: reason.trim() });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Refund</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Refund {credits} credits</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-1.5 text-[13px]">
          <Label htmlFor="ru-reason">Reason (required)</Label>
          <Textarea id="ru-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <p style={{ color: "var(--danger-tx)" }}>{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={reason.trim().length < 3 || pending}>
            {pending && <Loader2 size={14} className="animate-spin" />} Refund credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
