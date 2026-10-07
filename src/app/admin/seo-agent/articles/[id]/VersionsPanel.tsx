"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OABadge } from "@/components/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  compareArticleVersions, getArticleVersion, restoreArticleVersion,
  type VersionComparison, type VersionContent,
} from "@/actions/seo-agent/articles";
import { formatZoned } from "@/lib/seo-agent/datetime";
import type { ArticleVersionRow } from "@/lib/seo-agent/articles-data";
import { withCtaCards } from "@/lib/seo-agent/cta";
import "@/components/seo-agent/editor/article-prose.css";

const SOURCE_LABEL: Record<string, { label: string; tone: "cobalt" | "green" | "amber" }> = {
  AI_GENERATED: { label: "AI", tone: "cobalt" },
  MANUAL_EDIT: { label: "Edited", tone: "green" },
  RESTORE: { label: "Restored", tone: "amber" },
};

interface Props {
  articleId: string;
  versions: ArticleVersionRow[];
  timezone: string;
  editable: boolean;
  /** Called before a restore so unsaved editor changes aren't silently lost. */
  hasUnsavedChanges: boolean;
}

export function VersionsPanel({ articleId, versions, timezone, editable, hasUnsavedChanges }: Props) {
  const router = useRouter();
  const [viewing, setViewing] = useState<VersionContent | null>(null);
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [compareFrom, setCompareFrom] = useState(versions[1]?.id ?? "");
  const [compareTo, setCompareTo] = useState(versions[0]?.id ?? "");
  const [restoring, setRestoring] = useState<ArticleVersionRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function view(id: string) {
    setBusy(id);
    setError(null);
    const res = await getArticleVersion(id);
    setBusy(null);
    if (!res.ok) setError(res.error);
    else setViewing(res.version);
  }

  async function compare() {
    if (!compareFrom || !compareTo || compareFrom === compareTo) { setError("Pick two different versions."); return; }
    setBusy("compare");
    setError(null);
    const res = await compareArticleVersions(compareFrom, compareTo);
    setBusy(null);
    if (!res.ok) setError(res.error);
    else setComparison(res.comparison);
  }

  async function restore(v: ArticleVersionRow) {
    const res = await restoreArticleVersion(articleId, v.id);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }

  const label = (v: ArticleVersionRow) => `v${v.versionNumber} · ${SOURCE_LABEL[v.source]?.label ?? v.source} · ${formatZoned(v.createdAt, timezone)}`;

  return (
    <div className="flex flex-col gap-3">
      {versions.length >= 2 && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-[var(--r-md)]" style={{ background: "var(--paper-2)" }}>
          <span className="text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>Compare versions</span>
          <select aria-label="Compare from version" value={compareFrom} onChange={(e) => setCompareFrom(e.target.value)}
            className="text-[12.5px] px-2 py-1 rounded-[var(--r-sm)] border" style={{ borderColor: "var(--line-300)", background: "var(--surface)" }}>
            {versions.map((v) => <option key={v.id} value={v.id}>{label(v)}</option>)}
          </select>
          <select aria-label="Compare to version" value={compareTo} onChange={(e) => setCompareTo(e.target.value)}
            className="text-[12.5px] px-2 py-1 rounded-[var(--r-sm)] border" style={{ borderColor: "var(--line-300)", background: "var(--surface)" }}>
            {versions.map((v) => <option key={v.id} value={v.id}>{label(v)}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={compare} disabled={busy !== null}>
            {busy === "compare" ? <Loader2 size={14} className="animate-spin" /> : <GitCompare size={14} />} Compare
          </Button>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-[var(--line-200)] max-h-[360px] overflow-y-auto oa-scroll">
        {versions.map((v, i) => (
          <li key={v.id} className="py-2 flex items-start justify-between gap-2 text-[12.5px]">
            <div className="flex flex-col min-w-0">
              <span className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--ink-900)" }}>
                v{v.versionNumber}
                <OABadge tone={SOURCE_LABEL[v.source]?.tone ?? "neutral"}>{SOURCE_LABEL[v.source]?.label ?? v.source}</OABadge>
                {i === 0 && <span className="font-normal" style={{ color: "var(--fg-muted)" }}>latest</span>}
              </span>
              <span style={{ color: "var(--fg-muted)" }}>
                {formatZoned(v.createdAt, timezone)}{v.createdByName ? ` · ${v.createdByName}` : v.source === "AI_GENERATED" ? " · Content Writer" : ""}
              </span>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => view(v.id)} disabled={busy !== null}>
                {busy === v.id ? <Loader2 size={13} className="animate-spin" /> : "View"}
              </Button>
              {editable && i > 0 && <Button size="sm" variant="ghost" onClick={() => setRestoring(v)}>Restore</Button>}
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger-tx)" }}>{error}</p>}

      <Dialog open={viewing !== null} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version {viewing?.versionNumber} ({SOURCE_LABEL[viewing?.source ?? ""]?.label ?? viewing?.source})</DialogTitle>
          </DialogHeader>
          {viewing && (
            <article className="seo-prose">
              <h1>{viewing.title}</h1>
              {/* Sanitized on the server (sanitizeArticleHtml) before it reaches the browser. */}
              <div dangerouslySetInnerHTML={{ __html: withCtaCards(viewing.contentHtml) }} />
            </article>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={comparison !== null} onOpenChange={(o) => { if (!o) setComparison(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>v{comparison?.from.versionNumber} → v{comparison?.to.versionNumber}</DialogTitle>
          </DialogHeader>
          {comparison && (
            <div className="flex flex-col gap-4 text-[13.5px]">
              {comparison.metaChanges.length > 0 && (
                <table className="w-full text-[12.5px]">
                  <thead><tr className="text-left" style={{ color: "var(--fg-muted)" }}><th className="py-1">Field</th><th className="py-1">Before</th><th className="py-1">After</th></tr></thead>
                  <tbody className="divide-y divide-[var(--line-200)]">
                    {comparison.metaChanges.map((c) => (
                      <tr key={c.field} className="align-top">
                        <td className="py-1.5 pr-2 font-semibold">{c.field}</td>
                        <td className="py-1.5 pr-2" style={{ color: "var(--danger-tx)" }}>{c.from || "—"}</td>
                        <td className="py-1.5" style={{ color: "var(--success-tx)" }}>{c.to || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="seo-diff whitespace-pre-wrap leading-relaxed" style={{ color: "var(--ink-900)" }}>
                {comparison.parts.map((p, i) =>
                  p.added ? <ins key={i}>{p.value}</ins> : p.removed ? <del key={i}>{p.value}</del> : <span key={i}>{p.value}</span>,
                )}
              </p>
              {comparison.parts.every((p) => !p.added && !p.removed) && comparison.metaChanges.length === 0 && (
                <p style={{ color: "var(--fg-muted)" }}>These versions are identical.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(o) => { if (!o) setRestoring(null); }}
        title={`Restore version ${restoring?.versionNumber}?`}
        description={`Its title, text and details become the current article, saved as a new "Restored" version. Nothing is deleted.${hasUnsavedChanges ? " You have unsaved changes in the editor; they will be lost." : ""}`}
        confirmLabel="Restore"
        onConfirm={() => (restoring ? restore(restoring) : undefined)}
      />
    </div>
  );
}
