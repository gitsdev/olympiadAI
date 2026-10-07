"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, ExternalLink, Loader2, Rocket, Send, Undo2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Field, inputCls, inputStyle } from "@/components/seo-agent/FormField";
import {
  approveArticle, publishArticleNow, rejectArticle, reopenArticle, scheduleArticle, submitForReview,
  unscheduleArticle, withdrawApproval,
} from "@/actions/seo-agent/workflow";
import { addDays, formatZoned, getZonedParts, zonedDateString } from "@/lib/seo-agent/datetime";
import type { ValidationIssue } from "@/lib/seo-agent/publishing/rules";

interface Props {
  articleId: string;
  status: string;
  timezone: string;
  defaultPublishTime: string;
  plannedPublishAt: string | null;
  scheduledFor: string | null;
  publishedUrl: string | null;
  approvedLabel: string | null;
  blogUrl: string;
  /** Saves pending editor changes first; resolves false if the save failed. */
  saveFirst: () => Promise<boolean>;
}

type Busy = null | "review" | "approve" | "schedule" | "unschedule" | "publish" | "withdraw" | "reject" | "reopen";

export function WorkflowBar(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ text: string; issues?: ValidationIssue[] } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const base = p.scheduledFor ?? p.plannedPublishAt;
  const defaultDate = base && new Date(base) > new Date() ? zonedDateString(new Date(base), p.timezone) : addDays(zonedDateString(new Date(), p.timezone), 1);
  const baseParts = base ? getZonedParts(new Date(base), p.timezone) : null;
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(baseParts ? `${String(baseParts.hour).padStart(2, "0")}:${String(baseParts.minute).padStart(2, "0")}` : p.defaultPublishTime);

  async function run(kind: Busy, fn: () => Promise<{ ok: boolean; error?: string; issues?: ValidationIssue[] }>, needsSave = false) {
    setBusy(kind);
    setError(null);
    if (needsSave && !(await p.saveFirst())) { setBusy(null); return false; }
    const res = await fn();
    setBusy(null);
    if (!res.ok) { setError({ text: res.error ?? "Something went wrong.", issues: res.issues }); return false; }
    router.refresh();
    return true;
  }

  const s = p.status;
  const spin = (k: Busy) => busy === k && <Loader2 size={14} className="animate-spin" />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {s === "DRAFT" && (
          <Button variant="outline" onClick={() => run("review", () => submitForReview(p.articleId), true)} disabled={busy !== null}>
            {spin("review") || <Send size={14} />} Submit for review
          </Button>
        )}
        {["DRAFT", "REVIEW", "REVIEW_REQUIRED"].includes(s) && (
          <>
            <Button onClick={() => run("approve", () => approveArticle(p.articleId), true)} disabled={busy !== null}>
              {spin("approve") || <CheckCircle2 size={14} />} Approve
            </Button>
            <Button variant="ghost" onClick={() => run("reject", () => rejectArticle(p.articleId))} disabled={busy !== null}>
              {spin("reject") || <XCircle size={14} />} Reject
            </Button>
          </>
        )}
        {["APPROVED", "SCHEDULED"].includes(s) && (
          <>
            <Button onClick={() => setScheduleOpen(true)} disabled={busy !== null}>
              <CalendarClock size={14} /> {s === "SCHEDULED" ? "Reschedule" : "Schedule"}
            </Button>
            <Button variant="outline" onClick={() => setPublishOpen(true)} disabled={busy !== null}>
              {spin("publish") || <Rocket size={14} />} Publish now
            </Button>
            {s === "SCHEDULED" && (
              <Button variant="ghost" onClick={() => run("unschedule", () => unscheduleArticle(p.articleId))} disabled={busy !== null}>
                {spin("unschedule")} Unschedule
              </Button>
            )}
            <Button variant="ghost" onClick={() => run("withdraw", () => withdrawApproval(p.articleId))} disabled={busy !== null}>
              {spin("withdraw") || <Undo2 size={14} />} Withdraw approval to edit
            </Button>
          </>
        )}
        {s === "REJECTED" && (
          <Button variant="outline" onClick={() => run("reopen", () => reopenArticle(p.articleId))} disabled={busy !== null}>
            {spin("reopen") || <Undo2 size={14} />} Reopen as draft
          </Button>
        )}
        {s === "PUBLISHED" && p.publishedUrl && (
          <a href={p.publishedUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ background: "var(--success-bg)", color: "var(--success-tx)" }}>
            <ExternalLink size={14} /> Live: {p.publishedUrl.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>

      <div className="text-[12.5px] flex flex-wrap gap-x-4" style={{ color: "var(--fg-muted)" }}>
        {p.approvedLabel && <span>{p.approvedLabel}</span>}
        {s === "SCHEDULED" && p.scheduledFor && (
          <span style={{ color: "var(--cobalt-700)" }}>Publishes automatically {formatZoned(p.scheduledFor, p.timezone)}</span>
        )}
      </div>

      {error && (
        <div role="alert" className="text-[12.5px] p-2.5 rounded-[var(--r-md)] flex flex-col gap-1" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
          <span className="font-semibold">{error.text}</span>
          {error.issues && error.issues.length > 0 && <ul className="list-disc pl-5">{error.issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul>}
        </div>
      )}

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Schedule publication</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className={inputCls} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Time">
              <input type="time" className={inputCls} style={inputStyle} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <p className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
            Timezone: {p.timezone}. The scheduler publishes it at this time after re-running every check (Phase 7 adds the scheduler).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button disabled={busy !== null} onClick={async () => { if (await run("schedule", () => scheduleArticle(p.articleId, date, time))) setScheduleOpen(false); }}>
              {spin("schedule")} Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish now?"
        description={`This puts the article live at ${p.blogUrl} immediately, after re-running every publishing check.`}
        confirmLabel="Publish"
        onConfirm={async () => { await run("publish", () => publishArticleNow(p.articleId)); }}
      />
    </div>
  );
}

export function PublishChecklist({ errors, warnings }: { errors: ValidationIssue[]; warnings: ValidationIssue[] }) {
  if (!errors.length && !warnings.length) {
    return <p className="text-[13px] flex items-center gap-1.5" style={{ color: "var(--success-tx)" }}><CheckCircle2 size={15} /> Every publishing check passes.</p>;
  }
  return (
    <div className="flex flex-col gap-2 text-[12.5px]">
      {errors.length > 0 && (
        <div className="flex flex-col gap-1" style={{ color: "var(--danger-tx)" }}>
          <span className="font-semibold">Blocks publishing ({errors.length})</span>
          <ul className="list-disc pl-4">{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-1" style={{ color: "var(--warning-tx)" }}>
          <span className="font-semibold">Worth a look ({warnings.length})</span>
          <ul className="list-disc pl-4">{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
        </div>
      )}
      <span style={{ color: "var(--fg-muted)" }}>Reflects the last saved version; publishing re-runs every check.</span>
    </div>
  );
}
