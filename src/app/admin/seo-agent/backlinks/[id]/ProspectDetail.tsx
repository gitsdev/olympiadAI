"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, ExternalLink, Loader2, Mail, Pencil, Plus, RefreshCw, Search, ShieldAlert, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OABadge, OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { inputCls, inputStyle } from "@/components/seo-agent/FormField";
import {
  approveOutreachMessage, checkBacklinkNow, deleteOutreachMessage, deleteProspect, evaluateProspect, generateOutreach,
  markOutreachCopied, reopenOutreachMessage, setProspectStatus, updateOutreachMessage,
} from "@/actions/seo-agent/backlinks";
import { humanizeStatus } from "@/lib/seo-agent/constants";
import { formatZoned } from "@/lib/seo-agent/datetime";
import type { OutreachMessageRow, ProspectDetail as Detail } from "@/lib/seo-agent/backlinks/data";
import { ProspectFormDialog } from "../ProspectFormDialog";
import { BacklinkFormDialog } from "../tracker/BacklinkFormDialog";
import { LinkCheckSummary } from "../LinkCheckSummary";

type Busy = null | "evaluate" | "outreach" | "contacted" | "delete" | string;

export function ProspectDetail({ prospect: p, timezone }: { prospect: Detail; timezone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const e = p.evaluation;

  /** Runs an action; on success shows `done(result)` and refreshes, on failure shows the error. */
  async function run<T extends object>(key: Busy, fn: () => Promise<({ ok: true } & T) | { ok: false; error: string }>, done?: (r: T) => string) {
    setBusy(key);
    setMessage(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) {
      setMessage({ ok: false, text: r.error });
      return;
    }
    if (done) setMessage({ ok: true, text: done(r) });
    router.refresh();
  }

  const scoreColor = (n: number) => (n >= 70 ? "var(--success-tx)" : n >= 40 ? "var(--warning-tx)" : "var(--danger-tx)");

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <OACard className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[13px] inline-flex items-center gap-1 break-all underline" style={{ color: "var(--cobalt-700)" }}>
              {p.url} <ExternalLink size={12} />
            </a>
            <span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
              {humanizeStatus(p.opportunityType)}{p.topic ? ` · ${p.topic}` : ""}
              {(p.contactEmail || p.contactName) && ` · Contact: ${[p.contactName, p.contactEmail].filter(Boolean).join(", ")}`}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</Button>
          </div>
        </div>
        {p.notes && <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--ink-700)" }}>{p.notes}</p>}
        {message && (
          <p role="status" className="text-[12.5px] p-2 rounded-[var(--r-md)]" style={{ background: message.ok ? "var(--success-bg)" : "var(--danger-bg)", color: message.ok ? "var(--success-tx)" : "var(--danger-tx)" }}>{message.text}</p>
        )}
      </OACard>

      {/* Evaluation */}
      <OACard className="flex flex-col gap-3">
        <OACardHeader className="mb-0">
          <OACardTitle className="text-[16px]">Evaluation</OACardTitle>
          <Button size="sm" variant={e ? "outline" : "default"} disabled={busy !== null}
            onClick={() => run("evaluate", () => evaluateProspect(p.id), (r) => `Evaluated: relevance ${r.relevance}, quality ${r.quality}, spam risk ${humanizeStatus(r.spamRisk)}.`)}>
            {busy === "evaluate" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {busy === "evaluate" ? "Reading the page… (10–30s)" : e ? "Re-evaluate" : "Evaluate"}
          </Button>
        </OACardHeader>
        {!e ? (
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
            The Backlink Agent reads this page and scores relevance, quality and spam risk from what&apos;s actually there. It never invents domain authority or traffic.
          </p>
        ) : (
          <div className="flex flex-col gap-3 text-[13px]" style={{ color: "var(--ink-700)" }}>
            <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
              <span>Relevance <strong className="text-[18px]" style={{ color: scoreColor(e.relevanceScore) }}>{e.relevanceScore}</strong></span>
              <span>Quality <strong className="text-[18px]" style={{ color: scoreColor(e.qualityScore) }}>{e.qualityScore}</strong></span>
              <span className="flex items-center gap-1.5">Spam risk <StatusBadge status={e.spamRisk} /></span>
              <span className="flex items-center gap-1.5">Traffic <OABadge tone="neutral">Data unavailable</OABadge></span>
              <span className="flex items-center gap-1.5">Confidence <OABadge tone="neutral">{humanizeStatus(e.confidence)}</OABadge></span>
            </div>
            {!e.page.fetched && (
              <p className="flex gap-1.5 items-start p-2 rounded-[var(--r-sm)]" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
                <ShieldAlert size={14} className="shrink-0 mt-0.5" /> The page couldn&apos;t be read ({e.page.error}), so this evaluation has low confidence.
              </p>
            )}
            <p><strong>Editorial fit:</strong> {e.editorialFit}</p>
            <p><strong>Content:</strong> {e.contentQuality}</p>
            <p><strong>Recommended approach:</strong> {e.recommendedApproach}</p>
            {[...e.detectedSignals, ...e.spamSignals].length > 0 && (
              <div>
                <strong>Spam signals:</strong>
                <ul className="list-disc pl-5">{[...new Set([...e.detectedSignals, ...e.spamSignals])].map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            <p className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
              Evaluated {formatZoned(e.evaluatedAt, timezone)}{e.page.title ? ` · Page: "${e.page.title}"` : ""}{e.page.wordCount !== null ? ` · ${e.page.wordCount} words` : ""}.
              Domain authority and traffic aren&apos;t shown because no reliable data source is connected.
            </p>
          </div>
        )}
      </OACard>

      {/* Outreach */}
      <OACard className="flex flex-col gap-3">
        <OACardHeader className="mb-0">
          <OACardTitle className="text-[16px]">Outreach</OACardTitle>
          <div className="flex gap-2 flex-wrap">
            {p.status === "PROSPECT" && p.messages.some((m) => m.status === "COPIED") && (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run("contacted", () => setProspectStatus(p.id, "CONTACTED"), () => "Marked as contacted.")}>
                <Mail size={14} /> Mark as contacted
              </Button>
            )}
            <Button size="sm" disabled={busy !== null || e?.spamRisk === "HIGH"} title={e?.spamRisk === "HIGH" ? "High spam risk: outreach not recommended" : undefined}
              onClick={() => run("outreach", () => generateOutreach(p.id), (r) => (r.warnings.length ? r.warnings.join(" ") : "Draft created. Review and edit it, then approve."))}>
              {busy === "outreach" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {busy === "outreach" ? "Drafting… (10–20s)" : "Generate outreach"}
            </Button>
          </div>
        </OACardHeader>
        <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          Emails are never sent automatically. Approve a draft, copy it, and send it from your own email.
        </p>
        {p.messages.length === 0 ? null : (
          <div className="flex flex-col gap-3">
            {p.messages.map((m) => <MessageCard key={m.id} m={m} timezone={timezone} onChanged={() => router.refresh()} />)}
          </div>
        )}
      </OACard>

      {/* Tracker */}
      <OACard className="flex flex-col gap-3">
        <OACardHeader className="mb-0">
          <OACardTitle className="text-[16px]">Backlinks from this site</OACardTitle>
          <Button size="sm" variant="outline" onClick={() => setTracking(true)}><Plus size={14} /> Track a backlink</Button>
        </OACardHeader>
        {p.backlinks.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>When they publish a link to OlympiadIQ, track it here and the agent will check it stays live.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--line-200)] text-[13px]">
            {p.backlinks.map((b) => (
              <li key={b.id} className="py-2 flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="break-all" style={{ color: "var(--ink-900)" }}>{b.sourceUrl} → {b.targetUrl}</span>
                  <span className="text-[12px]"><LinkCheckSummary check={b.lastCheck} timezone={timezone} /></span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={b.status} />
                  <Button size="sm" variant="ghost" disabled={busy !== null}
                    onClick={() => run(`check:${b.id}`, () => checkBacklinkNow(b.id), (r) => (r.found ? "Link found on the page." : r.error ? `Couldn't check: ${r.error}` : "Link not found on the page."))}>
                    {busy === `check:${b.id}` ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Check
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/seo-agent/backlinks/tracker" className="text-[12.5px] font-semibold w-fit" style={{ color: "var(--cobalt-700)" }}>All tracked backlinks →</Link>
      </OACard>

      <ProspectFormDialog key={`edit-${editing}`} open={editing} onOpenChange={setEditing} prospect={p} />
      <BacklinkFormDialog key={`track-${tracking}`} open={tracking} onOpenChange={setTracking} defaults={{ sourceUrl: p.url, prospectId: p.id }} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this opportunity?"
        description="Its outreach drafts are deleted too. Tracked backlinks are kept."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => { const r = await deleteProspect(p.id); if (r.ok) router.push("/admin/seo-agent/backlinks"); else setMessage({ ok: false, text: r.error }); }}
      />
    </div>
  );
}

function MessageCard({ m, timezone, onChanged }: { m: OutreachMessageRow; timezone: string; onChanged: () => void }) {
  const [subject, setSubject] = useState(m.subject);
  const [body, setBody] = useState(m.body);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const draft = m.status === "DRAFT";
  const dirty = subject !== m.subject || body !== m.body;

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setBusy(true);
    setNote(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setNote({ ok: false, text: r.error ?? "Failed" });
    else { if (ok) setNote({ ok: true, text: ok }); onChanged(); }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${m.subject}\n\n${m.body}`);
      await act(() => markOutreachCopied(m.id), "Copied to the clipboard. Paste it into your email.");
    } catch {
      setNote({ ok: false, text: "Couldn't access the clipboard. Select the text and copy it manually." });
    }
  }

  return (
    <div className="rounded-[var(--r-md)] border p-3 flex flex-col gap-2" style={{ borderColor: "var(--line-200)" }}>
      <div className="flex items-center justify-between gap-2 flex-wrap text-[12px]" style={{ color: "var(--fg-muted)" }}>
        <span className="flex items-center gap-2"><StatusBadge status={m.status} /> {formatZoned(m.createdAt, timezone)}{m.approvedAt ? ` · approved ${formatZoned(m.approvedAt, timezone)}` : ""}</span>
      </div>
      {draft ? (
        <>
          <input aria-label="Subject" className={inputCls} style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea aria-label="Message body" className={`${inputCls} text-[13px]`} style={inputStyle} rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </>
      ) : (
        <div className="text-[13px] whitespace-pre-wrap p-2 rounded-[var(--r-sm)]" style={{ background: "var(--paper-2)", color: "var(--ink-900)" }}>
          <strong>{m.subject}</strong>{"\n\n"}{m.body}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {draft && dirty && <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => updateOutreachMessage(m.id, { subject, body }), "Saved.")}>Save edits</Button>}
        {draft && <Button size="sm" disabled={busy || dirty} title={dirty ? "Save your edits first" : undefined} onClick={() => act(() => approveOutreachMessage(m.id), "Approved. You can copy it now.")}><CheckCircle2 size={14} /> Approve</Button>}
        {!draft && <Button size="sm" disabled={busy} onClick={copy}><Copy size={14} /> Copy message</Button>}
        {!draft && <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => reopenOutreachMessage(m.id))}><Undo2 size={14} /> Reopen to edit</Button>}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => deleteOutreachMessage(m.id))}><Trash2 size={14} /> Delete</Button>
      </div>
      {note && <p role="status" className="text-[12.5px]" style={{ color: note.ok ? "var(--success-tx)" : "var(--danger-tx)" }}>{note.text}</p>}
    </div>
  );
}
