"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { sendReengagementBatch, sendReengagementTest } from "@/actions/admin/campaigns";
import { cn } from "@/lib/utils";

interface EmailPreview { subject: string; html: string; text: string }

interface ReengagementPanelProps {
  due: number;
  adminEmail: string;
  previews: { neverStarted: EmailPreview; lapsed: EmailPreview; parent: EmailPreview };
}

const TABS = [
  { key: "neverStarted", label: "Never started" },
  { key: "lapsed", label: "Lapsed (had streak)" },
  { key: "parent", label: "Parent" },
] as const;

export function ReengagementPanel({ due, adminEmail, previews }: ReengagementPanelProps) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("neverStarted");
  const [includeParents, setIncludeParents] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ students: number; parents: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    const result = await sendReengagementTest(includeParents);
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
        const result = await sendReengagementBatch(includeParents);
        students += result.studentsSent;
        parents += result.parentsSent;
        setProgress({ students, parents });
        if (result.error) {
          setMessage({ tone: "error", text: `${result.error}. ${students} sent so far. Fix the issue and press Send again to resume.` });
          break;
        }
        if (result.remaining === 0 || result.studentsSent === 0) {
          setMessage({ tone: "ok", text: `Done. Emailed ${students} student${students === 1 ? "" : "s"}${includeParents ? ` and ${parents} parent${parents === 1 ? "" : "s"}` : ""}.` });
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

  const preview = previews[tab];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-2.5 cursor-pointer max-w-xl">
          <Checkbox checked={includeParents} onCheckedChange={(v) => setIncludeParents(v === true)} disabled={sending} className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <Label className="cursor-pointer">Also email linked parents</Label>
            <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
              Parents linked to an inactive student get the parent version. Unsubscribed parents are skipped.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || sending}>
            {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
            Send test to me
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={due === 0 || sending || testing}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Sending…" : `Send to ${due} student${due === 1 ? "" : "s"}`}
          </Button>
        </div>

        {sending && progress && (
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
            Sent {progress.students} of ~{due} students{includeParents ? `, ${progress.parents} parents` : ""}… keep this tab open.
          </p>
        )}
        {message && (
          <p className="text-[13px] font-medium" style={{ color: message.tone === "error" ? "oklch(0.55 0.18 25)" : "var(--cobalt-700)" }}>
            {message.text}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "text-[12.5px] font-medium px-3 py-1.5 rounded-[var(--r-md)] border transition-colors",
                tab === t.key ? "bg-[var(--cobalt-50)] border-[var(--cobalt-200)] text-[var(--cobalt-700)]" : "border-[var(--line-200)] hover:bg-[var(--fill-100)]",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[13px]" style={{ color: "var(--ink-900)" }}>
          <span style={{ color: "var(--fg-muted)" }}>Subject:</span> <strong>{preview.subject}</strong>
        </p>
        <iframe
          title="Email preview"
          srcDoc={preview.html}
          sandbox=""
          className="w-full rounded-[var(--r-lg)] border"
          style={{ height: 720, borderColor: "var(--line-200)", background: "#F3F4F8" }}
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Email ${due} inactive student${due === 1 ? "" : "s"}?`}
        description={`This sends the re-engagement email${includeParents ? " to each student and their linked parents" : ""} now. Students who get it won't be emailed again for 14 days. Brevo's free plan allows 300 emails a day; if the limit is hit, sending stops and you can resume tomorrow.`}
        confirmLabel="Send now"
        onConfirm={() => { setConfirmOpen(false); void handleSendAll(); }}
      />
    </div>
  );
}
