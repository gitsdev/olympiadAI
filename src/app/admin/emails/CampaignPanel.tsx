"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmailPreview } from "@/components/admin/EmailPreview";
import { sendCampaignBatch, sendCampaignTest } from "@/actions/admin/campaigns";
import { CAMPAIGNS, sampleRecipients, type CampaignId, type CampaignSegment } from "@/lib/email/campaign-templates";

interface CampaignPanelProps {
  campaignId: CampaignId;
  segment: CampaignSegment;
  due: number;
  adminEmail: string;
  cooldownDays: number;
}

export function CampaignPanel({ campaignId, segment, due, adminEmail, cooldownDays }: CampaignPanelProps) {
  const router = useRouter();
  const campaign = CAMPAIGNS[campaignId];
  const [includeParents, setIncludeParents] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ students: number; parents: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const withParents = includeParents && campaign.supportsParents;
  const samples = sampleRecipients(campaignId).filter((s) => campaign.supportsParents || s.recipient.audience !== "parent");
  const audienceLabel = segment === "all" ? "student" : "inactive student";

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    const result = await sendCampaignTest(campaignId, withParents);
    setTesting(false);
    setMessage(result.error
      ? { tone: "error", text: result.error }
      : { tone: "ok", text: `Sent ${result.sent} test email${result.sent === 1 ? "" : "s"} to ${adminEmail}.` });
  }

  async function handleSendAll() {
    setSending(true);
    setMessage(null);
    let students = 0;
    let parents = 0;
    setProgress({ students, parents });
    try {
      // Each call sends one batch and records it, so looping until
      // `remaining` hits 0 is safe to interrupt and resume later.
      for (;;) {
        const result = await sendCampaignBatch(campaignId, segment, withParents);
        students += result.studentsSent;
        parents += result.parentsSent;
        setProgress({ students, parents });
        if (result.error) {
          setMessage({ tone: "error", text: `${result.error}. ${students} sent so far. Fix the issue and press Send again to resume.` });
          break;
        }
        if (result.remaining === 0 || result.studentsSent === 0) {
          setMessage({ tone: "ok", text: `Done. Emailed ${students} student${students === 1 ? "" : "s"}${withParents ? ` and ${parents} parent${parents === 1 ? "" : "s"}` : ""}.` });
          break;
        }
      }
    } catch {
      setMessage({ tone: "error", text: `Sending was interrupted after ${students} emails. Press Send again to resume.` });
    } finally {
      setSending(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {campaign.supportsParents && (
          <label className="flex items-start gap-2.5 cursor-pointer max-w-xl">
            <Checkbox checked={includeParents} onCheckedChange={(v) => setIncludeParents(v === true)} disabled={sending} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <Label className="cursor-pointer">Also email linked parents</Label>
              <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
                Parents linked to each student get the parent version. Unsubscribed parents are skipped.
              </span>
            </span>
          </label>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || sending}>
            {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
            Send test to me
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={due === 0 || sending || testing}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Sending…" : `Send to ${due} ${audienceLabel}${due === 1 ? "" : "s"}`}
          </Button>
        </div>

        {sending && progress && (
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
            Sent {progress.students} of ~{due} students{withParents ? `, ${progress.parents} parents` : ""}… keep this tab open.
          </p>
        )}
        {message && (
          <p className="text-[13px] font-medium" style={{ color: message.tone === "error" ? "oklch(0.55 0.18 25)" : "var(--cobalt-700)" }}>
            {message.text}
          </p>
        )}
      </div>

      <EmailPreview campaignId={campaignId} samples={samples} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Email ${due} ${audienceLabel}${due === 1 ? "" : "s"}?`}
        description={`This sends "${campaign.label}"${withParents ? " to each student and their linked parents" : ""} now. Students who get it won't get this template again for ${cooldownDays} days. Brevo's free plan allows 300 emails a day; if the limit is hit, sending stops and you can resume tomorrow.`}
        confirmLabel="Send now"
        onConfirm={() => { setConfirmOpen(false); void handleSendAll(); }}
      />
    </div>
  );
}
