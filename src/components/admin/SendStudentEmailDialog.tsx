"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmailPreview } from "./EmailPreview";
import { getStudentEmailInfo, sendCampaignToStudent, type StudentEmailInfo } from "@/actions/admin/campaigns";
import { CAMPAIGNS, CAMPAIGN_IDS, isCampaignId, type CampaignId } from "@/lib/email/campaign-templates";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Lets an admin send any campaign template to one student. Controlled
 * (open/onOpenChange) so it can be opened from a button or a dropdown item.
 */
export function SendStudentEmailDialog({ studentId, open, onOpenChange }: {
  studentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Mounted only while open, so every open starts with fresh state. */}
        {open && <SendStudentEmailBody studentId={studentId} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SendStudentEmailBody({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const [info, setInfo] = useState<StudentEmailInfo | null>(null);
  const [campaignId, setCampaignId] = useState<CampaignId>("reengagement");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStudentEmailInfo(studentId).then((data) => { if (!cancelled) setInfo(data); });
    return () => { cancelled = true; };
  }, [studentId]);

  async function handleSend() {
    setPending(true);
    setResult(null);
    const res = await sendCampaignToStudent(studentId, campaignId);
    setPending(false);
    if (res.error) {
      setResult({ tone: "error", text: res.error });
      return;
    }
    setResult({ tone: "ok", text: `Sent "${CAMPAIGNS[campaignId].label}" to ${info?.email}.` });
    setInfo((prev) => prev && {
      ...prev,
      history: [{ campaign: campaignId, sent_at: new Date().toISOString(), within_cooldown: true }, ...prev.history],
    });
  }

  const lastSent = info?.history.find((h) => h.campaign === campaignId);

  return (
    <>
    <DialogHeader>
      <DialogTitle>Send email{info?.fullName ? ` to ${info.fullName}` : ""}</DialogTitle>
    </DialogHeader>

    {!info ? (
      <div className="flex items-center gap-2 py-8 justify-center text-[13px]" style={{ color: "var(--fg-muted)" }}>
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    ) : info.error ? (
      <p className="text-[13px]" style={{ color: "var(--danger-tx)" }}>{info.error}</p>
    ) : (
      <div className="flex flex-col gap-4">
        <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          To: <strong style={{ color: "var(--ink-900)" }}>{info.email}</strong>
        </p>

        {info.optedOut && (
          <p className="text-[13px] font-medium rounded-[var(--r-md)] px-3 py-2" style={{ background: "oklch(0.96 0.03 25)", color: "oklch(0.55 0.18 25)" }}>
            This student has unsubscribed from emails, so nothing can be sent.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-template">Template</Label>
          <Select value={campaignId} onValueChange={(v) => { if (isCampaignId(v)) { setCampaignId(v); setResult(null); } }}>
            <SelectTrigger id="email-template" className="w-full sm:w-80"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CAMPAIGN_IDS.map((id) => (
                <SelectItem key={id} value={id}>{CAMPAIGNS[id].emoji} {CAMPAIGNS[id].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lastSent && (
            <span className="text-[12.5px]" style={{ color: lastSent.within_cooldown ? "oklch(0.55 0.15 70)" : "var(--fg-muted)" }}>
              {lastSent.within_cooldown ? "Heads up: " : ""}Last sent this template on {formatDate(lastSent.sent_at)}.
            </span>
          )}
        </div>

        <EmailPreview
          key={campaignId}
          campaignId={campaignId}
          height={560}
          samples={[{
            label: "Student",
            recipient: {
              audience: "student",
              studentName: info.fullName,
              classLevel: info.classLevel,
              lastActiveAt: info.lastActiveAt,
              streakDays: info.streakDays,
            },
          }]}
        />

        {result && (
          <p className="text-[13px] font-medium" style={{ color: result.tone === "error" ? "var(--danger-tx)" : "var(--cobalt-700)" }}>
            {result.text}
          </p>
        )}
      </div>
    )}

    <DialogFooter>
      <Button variant="outline" onClick={onClose} disabled={pending}>Close</Button>
      <Button onClick={handleSend} disabled={pending || !info || !!info.error || info.optedOut}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {pending ? "Sending…" : "Send email"}
      </Button>
    </DialogFooter>
    </>
  );
}
