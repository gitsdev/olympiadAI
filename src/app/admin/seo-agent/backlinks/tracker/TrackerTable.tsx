"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Loader2, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/admin/EmptyState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { checkAllBacklinksNow, checkBacklinkNow, deleteBacklink } from "@/actions/seo-agent/backlinks";
import { formatZoned } from "@/lib/seo-agent/datetime";
import type { BacklinkRow } from "@/lib/seo-agent/backlinks/data";
import { BacklinkFormDialog } from "./BacklinkFormDialog";
import { LinkCheckSummary } from "../LinkCheckSummary";

export function TrackerTable({ rows, timezone }: { rows: BacklinkRow[]; timezone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<BacklinkRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [deleting, setDeleting] = useState<BacklinkRow | null>(null);

  async function check(id: string) {
    setBusy(id);
    setNote(null);
    const r = await checkBacklinkNow(id);
    setBusy(null);
    if (!r.ok) setNote({ ok: false, text: r.error });
    else { setNote({ ok: r.found, text: r.found ? "Link found." : r.error ? `Couldn't check: ${r.error}` : "Link not found on the page." }); router.refresh(); }
  }

  async function checkAll() {
    setBusy("all");
    setNote(null);
    const r = await checkAllBacklinksNow();
    setBusy(null);
    if (!r.ok) setNote({ ok: false, text: r.error });
    else { setNote({ ok: true, text: `Checked ${r.checked}: ${r.active} active, ${r.lost} lost, ${r.errors} couldn't be fetched.` }); router.refresh(); }
  }

  const open = (b: BacklinkRow | null) => { setEditing(b); setFormKey((k) => k + 1); setFormOpen(true); };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between gap-2 flex-wrap items-center">
        <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>Each check fetches the source page once and looks for a link to the target. No bulk crawling.</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={checkAll} disabled={busy !== null || rows.length === 0}>
            {busy === "all" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {busy === "all" ? "Checking…" : "Check all"}
          </Button>
          <Button size="sm" onClick={() => open(null)}><Plus size={14} /> Track a backlink</Button>
        </div>
      </div>
      {note && <p role="status" className="text-[12.5px] p-2 rounded-[var(--r-md)]" style={{ background: note.ok ? "var(--success-bg)" : "var(--warning-bg)", color: note.ok ? "var(--success-tx)" : "var(--warning-tx)" }}>{note.text}</p>}

      {rows.length === 0 ? (
        <EmptyState Icon={Activity} title="No backlinks tracked" description="When a site links to OlympiadIQ, add it here and the agent will check weekly that it's still live." />
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-[13px] min-w-[900px]">
            <thead>
              <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)" }}>
                <th className="py-2 pr-3 font-medium">Source → target</th>
                <th className="py-2 pr-3 font-medium">Anchor</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">First detected</th>
                <th className="py-2 pr-3 font-medium">Last check</th>
                <th className="py-2 w-24"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-200)]">
              {rows.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="py-2.5 pr-3 max-w-[340px]">
                    <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all underline" style={{ color: "var(--ink-900)" }}>{b.sourceUrl}</a>
                    <span className="block text-[12px] break-all" style={{ color: "var(--fg-muted)" }}>→ {b.targetUrl}</span>
                    {b.prospectId && <Link href={`/admin/seo-agent/backlinks/${b.prospectId}`} className="text-[12px] underline" style={{ color: "var(--cobalt-700)" }}>Opportunity</Link>}
                  </td>
                  <td className="py-2.5 pr-3" style={{ color: "var(--ink-700)" }}>{b.anchorText ?? "—"}</td>
                  <td className="py-2.5 pr-3"><StatusBadge status={b.status} /></td>
                  <td className="py-2.5 pr-3 whitespace-nowrap" style={{ color: "var(--ink-700)" }}>{b.firstDetectedAt ? formatZoned(b.firstDetectedAt, timezone, { dateOnly: true }) : "—"}</td>
                  <td className="py-2.5 pr-3 text-[12.5px]"><LinkCheckSummary check={b.lastCheck} timezone={timezone} /></td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="icon-sm" variant="ghost" onClick={() => check(b.id)} disabled={busy !== null} aria-label="Check now">
                        {busy === b.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}><MoreHorizontal size={16} /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => open(b)}>Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(b)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BacklinkFormDialog key={formKey} open={formOpen} onOpenChange={setFormOpen} backlink={editing ?? undefined} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Stop tracking this backlink?"
        description="This only removes it from the tracker. Nothing changes on the other site."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => { if (deleting) { const r = await deleteBacklink(deleting.id); if (!r.ok) setNote({ ok: false, text: r.error }); else router.refresh(); } }}
      />
    </div>
  );
}
