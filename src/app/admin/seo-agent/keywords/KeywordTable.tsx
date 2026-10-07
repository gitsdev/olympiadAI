"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, MoreHorizontal, Plus, Sparkles, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OABadge } from "@/components/ui";
import { EmptyState } from "@/components/admin/EmptyState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusBadge } from "@/components/seo-agent/StatusBadge";
import { analyzeSelectedKeywords, deleteKeywords, setKeywordStatus, type AnalysisSummary } from "@/actions/seo-agent/keywords";
import { humanizeStatus, KEYWORD_STATUSES } from "@/lib/seo-agent/constants";
import { MAX_ANALYSIS_KEYWORDS } from "@/lib/seo-agent/keywords";
import type { KeywordRow } from "@/lib/seo-agent/keywords-data";
import { KeywordFormDialog } from "./KeywordFormDialog";

const PRIORITY_TONE = { HIGH: "red", MEDIUM: "amber", LOW: "neutral" } as const;

export function KeywordTable({ rows }: { rows: KeywordRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<KeywordRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);

  // Drop selections that are no longer on the page (after delete/filter).
  const visibleIds = new Set(rows.map((r) => r.id));
  const selectedIds = [...selected].filter((id) => visibleIds.has(id));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function analyze(ids: string[]) {
    setBusy("analyze");
    setError(null);
    setAnalysis(null);
    const res = await analyzeSelectedKeywords(ids);
    setBusy(null);
    if (!res.ok) { setError(res.error); return; }
    setAnalysis({ clusters: res.clusters, warnings: res.warnings });
    setSelected(new Set());
    router.refresh();
  }

  async function changeStatus(ids: string[], status: string) {
    setBusy("status");
    setError(null);
    const res = await setKeywordStatus(ids, status);
    setBusy(null);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  async function remove(ids: string[]) {
    const res = await deleteKeywords(ids);
    if (!res.ok) { setError(res.error); return; }
    setSelected(new Set());
    router.refresh();
  }

  const analysing = busy === "analyze";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-h-9">
          {selectedIds.length > 0 && (
            <>
              <span className="text-[13px] font-medium" style={{ color: "var(--ink-700)" }}>{selectedIds.length} selected</span>
              <Button size="sm" onClick={() => analyze(selectedIds)} disabled={busy !== null || selectedIds.length > MAX_ANALYSIS_KEYWORDS}
                title={selectedIds.length > MAX_ANALYSIS_KEYWORDS ? `Analyse at most ${MAX_ANALYSIS_KEYWORDS} at a time` : undefined}>
                {analysing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Analyze keywords
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={busy !== null} />}>Set status</DropdownMenuTrigger>
                <DropdownMenuContent>
                  {KEYWORD_STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => changeStatus(selectedIds, s)}>{humanizeStatus(s)}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(selectedIds)} disabled={busy !== null}>Delete</Button>
            </>
          )}
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus size={14} /> Add keyword
        </Button>
      </div>

      {analysing && (
        <p role="status" className="flex items-center gap-2 text-[13px] p-3 rounded-[var(--r-md)]" style={{ background: "var(--cobalt-50)", color: "var(--cobalt-700)" }}>
          <Loader2 size={15} className="animate-spin" /> The Keyword Agent is analysing… this usually takes 10–60 seconds.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 text-[13px] p-3 rounded-[var(--r-md)]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
          <TriangleAlert size={15} className="shrink-0 mt-0.5" /> <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error"><X size={15} /></button>
        </p>
      )}
      {analysis && <AnalysisResult analysis={analysis} onClose={() => setAnalysis(null)} />}

      {rows.length === 0 ? (
        <EmptyState Icon={KeyRound} title="No keywords found" description="Add a keyword or import a list to get started." />
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-[13px] min-w-[860px]">
            <thead>
              <tr className="text-left text-[12px]" style={{ color: "var(--fg-muted)" }}>
                <th className="py-2 pr-2 w-8">
                  <Checkbox checked={allSelected} aria-label="Select all keywords on this page"
                    onCheckedChange={(on) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set())} />
                </th>
                <th className="py-2 pr-3 font-medium">Keyword</th>
                <th className="py-2 pr-3 font-medium">Cluster</th>
                <th className="py-2 pr-3 font-medium">Intent</th>
                <th className="py-2 pr-3 font-medium">Class</th>
                <th className="py-2 pr-3 font-medium">Subject</th>
                <th className="py-2 pr-3 font-medium">Priority</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 w-10"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-200)]">
              {rows.map((k) => (
                <tr key={k.id} className="align-top">
                  <td className="py-2.5 pr-2">
                    <Checkbox checked={selected.has(k.id)} onCheckedChange={(on) => toggle(k.id, Boolean(on))} aria-label={`Select ${k.keyword}`} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold" style={{ color: "var(--ink-900)" }}>{k.keyword}</span>
                    {k.notes && <p className="text-[12px] line-clamp-1" style={{ color: "var(--fg-muted)" }}>{k.notes}</p>}
                  </td>
                  <td className="py-2.5 pr-3">
                    {k.clusters.length === 0 ? (
                      <span style={{ color: "var(--fg-subtle)" }}>—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {k.clusters.map((c) => (
                          <Link key={c.id} href={`/admin/seo-agent/clusters#${c.id}`}>
                            <OABadge tone={c.role === "PRIMARY" ? "cobalt" : "neutral"} title={humanizeStatus(c.role)}>{c.name}</OABadge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3" style={{ color: "var(--ink-700)" }}>{k.search_intent ? humanizeStatus(k.search_intent) : "—"}</td>
                  <td className="py-2.5 pr-3" style={{ color: "var(--ink-700)" }}>{k.target_class ?? "—"}</td>
                  <td className="py-2.5 pr-3" style={{ color: "var(--ink-700)" }}>{k.subject ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <OABadge tone={PRIORITY_TONE[k.priority as keyof typeof PRIORITY_TONE] ?? "neutral"}>{humanizeStatus(k.priority)}</OABadge>
                  </td>
                  <td className="py-2.5 pr-3"><StatusBadge status={k.status} /></td>
                  <td className="py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${k.keyword}`} />}>
                        <MoreHorizontal size={16} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={busy !== null} onClick={() => analyze([k.id])}>Analyze keyword</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditing(k); setFormOpen(true); }}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete([k.id])}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <KeywordFormDialog open={formOpen} onOpenChange={setFormOpen} keyword={editing} />
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title={`Delete ${confirmDelete?.length === 1 ? "this keyword" : `${confirmDelete?.length ?? 0} keywords`}?`}
        description="They are also removed from their clusters. To keep them but stop using them, set the status to Archived instead."
        confirmLabel="Delete"
        destructive
        onConfirm={() => remove(confirmDelete ?? [])}
      />
    </div>
  );
}

function AnalysisResult({ analysis, onClose }: { analysis: AnalysisSummary; onClose: () => void }) {
  return (
    <div role="status" className="rounded-[var(--r-lg)] border p-4 flex flex-col gap-3" style={{ borderColor: "var(--success-tx)", background: "var(--success-bg)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-[14px]" style={{ color: "var(--ink-900)" }}>
          Analysis complete: {analysis.clusters.length} cluster{analysis.clusters.length === 1 ? "" : "s"}
        </p>
        <button onClick={onClose} aria-label="Dismiss analysis result"><X size={16} style={{ color: "var(--ink-700)" }} /></button>
      </div>
      <ul className="flex flex-col gap-2">
        {analysis.clusters.map((c) => (
          <li key={c.id} className="text-[13px] flex flex-col gap-0.5">
            <span className="font-semibold" style={{ color: "var(--ink-900)" }}>
              {c.name} {c.merged && <span className="font-normal" style={{ color: "var(--fg-muted)" }}>(merged into existing cluster)</span>}
            </span>
            <span style={{ color: "var(--ink-700)" }}>
              Recommended: <em>{c.recommendedTitle}</em> · <StatusBadge status={c.opportunityType} />
            </span>
          </li>
        ))}
      </ul>
      {analysis.warnings.length > 0 && (
        <details className="text-[12.5px]" style={{ color: "var(--warning-tx)" }}>
          <summary className="cursor-pointer">{analysis.warnings.length} note(s) from validation</summary>
          <ul className="list-disc pl-5 mt-1">{analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </details>
      )}
      <Link href="/admin/seo-agent/clusters" className="text-[13px] font-semibold w-fit" style={{ color: "var(--cobalt-700)" }}>
        View clusters →
      </Link>
    </div>
  );
}
