"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Field, FormError, inputCls, inputStyle } from "@/components/seo-agent/FormField";
import { GenerateArticleButton } from "@/components/seo-agent/GenerateArticleButton";
import { createPlan, deletePlan, updatePlan } from "@/actions/seo-agent/content";
import { CTA_LABELS, CTA_TYPES, SEARCH_INTENTS, humanizeStatus } from "@/lib/seo-agent/constants";
import {
  CONTENT_TYPE_LABELS, CONTENT_TYPES, MANUAL_PLAN_STATUSES, TARGET_AUDIENCE_LABELS, TARGET_AUDIENCES,
  type OutlineSection, type PlanInternalLink,
} from "@/lib/seo-agent/content-plans";
import { CTA_DESTINATIONS } from "@/lib/seo-agent/site-pages";

export interface PlanFormValues {
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  contentType: string;
  targetAudience: string;
  outline: OutlineSection[];
  recommendedCta: string;
  internalLinks: PlanInternalLink[];
  plannedDate: string;
  plannedTime: string;
  status: string;
  notes: string;
}

interface Props {
  planId?: string;
  initial: PlanFormValues;
  /** False once the plan's article is in progress. */
  editable: boolean;
  timezone: string;
  /** The article generated from this plan, if any. */
  article?: { id: string; status: string } | null;
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function PlanForm({ planId, initial, editable, timezone, article }: Props) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [secondaryText, setSecondaryText] = useState(initial.secondaryKeywords.join("\n"));
  const [outlineText, setOutlineText] = useState(initial.outline.map((s) => s.points.join("\n")));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Unsaved edits block generation, so the writer always works from what you see.
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof PlanFormValues>(k: K, val: PlanFormValues[K]) => { setV((s) => ({ ...s, [k]: val })); setSaved(false); setDirty(true); };

  function setSection(i: number, heading: string) {
    set("outline", v.outline.map((s, j) => (j === i ? { ...s, heading } : s)));
  }
  function setSectionPoints(i: number, text: string) {
    setOutlineText((t) => t.map((x, j) => (j === i ? text : x)));
    setSaved(false);
    setDirty(true);
  }
  function addSection() {
    set("outline", [...v.outline, { heading: "", points: [] }]);
    setOutlineText((t) => [...t, ""]);
  }
  function removeSection(i: number) {
    set("outline", v.outline.filter((_, j) => j !== i));
    setOutlineText((t) => t.filter((_, j) => j !== i));
  }
  function moveSection(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= v.outline.length) return;
    const swap = <T,>(arr: T[]) => { const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; };
    set("outline", swap(v.outline));
    setOutlineText(swap);
  }
  function setLink(i: number, patch: Partial<PlanInternalLink>) {
    set("internalLinks", v.internalLinks.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    setPending(true);
    setError(null);
    const payload = {
      title: v.title,
      primaryKeyword: v.primaryKeyword,
      secondaryKeywords: lines(secondaryText),
      searchIntent: v.searchIntent || null,
      contentType: v.contentType || null,
      targetAudience: v.targetAudience || null,
      outline: v.outline
        .map((s, i) => ({ heading: s.heading.trim(), points: lines(outlineText[i] ?? "") }))
        .filter((s) => s.heading),
      recommendedCta: v.recommendedCta || null,
      internalLinks: v.internalLinks.filter((l) => l.url.trim() && l.anchorText.trim()),
      plannedDate: v.plannedDate || null,
      plannedTime: v.plannedTime || null,
      status: v.status,
      notes: v.notes,
    };
    const res = planId ? await updatePlan(planId, payload) : await createPlan(payload);
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setSaved(true);
    setDirty(false);
    if (!planId && "planId" in res) router.replace(`/admin/seo-agent/calendar/${res.planId}`);
    else router.refresh();
  }

  async function remove() {
    if (!planId) return;
    const res = await deletePlan(planId);
    if (!res.ok) { setError(res.error); return; }
    router.push("/admin/seo-agent/calendar");
  }

  const ro = !editable;

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <OACard>
        <OACardHeader><OACardTitle>Article</OACardTitle></OACardHeader>
        <fieldset disabled={ro} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Title">
              <input className={inputCls} style={inputStyle} value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={160} />
            </Field>
          </div>
          <Field label="Primary keyword">
            <input className={inputCls} style={inputStyle} value={v.primaryKeyword} onChange={(e) => set("primaryKeyword", e.target.value)} />
          </Field>
          <Field label="Search intent">
            <select className={inputCls} style={inputStyle} value={v.searchIntent} onChange={(e) => set("searchIntent", e.target.value)}>
              <option value="">Not set</option>
              {SEARCH_INTENTS.map((i) => <option key={i} value={i}>{humanizeStatus(i)}</option>)}
            </select>
          </Field>
          <Field label="Content type">
            <select className={inputCls} style={inputStyle} value={v.contentType} onChange={(e) => set("contentType", e.target.value)}>
              <option value="">Not set</option>
              {CONTENT_TYPES.map((c) => <option key={c} value={c}>{CONTENT_TYPE_LABELS[c]}</option>)}
            </select>
          </Field>
          <Field label="Target audience">
            <select className={inputCls} style={inputStyle} value={v.targetAudience} onChange={(e) => set("targetAudience", e.target.value)}>
              <option value="">Not set</option>
              {TARGET_AUDIENCES.map((a) => <option key={a} value={a}>{TARGET_AUDIENCE_LABELS[a]}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Secondary keywords (one per line)">
              <textarea className={inputCls} style={inputStyle} rows={3} value={secondaryText} onChange={(e) => { setSecondaryText(e.target.value); setSaved(false); setDirty(true); }} />
            </Field>
          </div>
        </fieldset>
      </OACard>

      <OACard>
        <OACardHeader><OACardTitle>Schedule</OACardTitle></OACardHeader>
        <fieldset disabled={ro} className="grid sm:grid-cols-3 gap-4">
          <Field label="Publication date" hint={timezone}>
            <input type="date" className={inputCls} style={inputStyle} value={v.plannedDate} onChange={(e) => set("plannedDate", e.target.value)} />
          </Field>
          <Field label="Time" hint="Defaults to your publishing time">
            <input type="time" className={inputCls} style={inputStyle} value={v.plannedTime} onChange={(e) => set("plannedTime", e.target.value)} />
          </Field>
          <Field label="Status">
            {ro ? (
              <input className={inputCls} style={inputStyle} value={humanizeStatus(v.status)} readOnly />
            ) : (
              <select className={inputCls} style={inputStyle} value={v.status} onChange={(e) => set("status", e.target.value)}>
                {MANUAL_PLAN_STATUSES.map((s) => <option key={s} value={s}>{humanizeStatus(s)}</option>)}
              </select>
            )}
          </Field>
        </fieldset>
      </OACard>

      <OACard>
        <OACardHeader>
          <OACardTitle>Outline</OACardTitle>
          {!ro && <Button size="sm" variant="outline" onClick={addSection}><Plus size={14} /> Section</Button>}
        </OACardHeader>
        {v.outline.length === 0 && <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>No sections yet.</p>}
        <ol className="flex flex-col gap-3">
          {v.outline.map((s, i) => (
            <li key={i} className="rounded-[var(--r-md)] border p-3 flex flex-col gap-2" style={{ borderColor: "var(--line-200)" }}>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold w-8 shrink-0" style={{ color: "var(--fg-muted)" }}>H2</span>
                <input disabled={ro} className={inputCls} style={inputStyle} value={s.heading} placeholder="Section heading"
                  aria-label={`Section ${i + 1} heading`} onChange={(e) => setSection(i, e.target.value)} />
                {!ro && (
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Move section up"><ArrowUp size={14} /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => moveSection(i, 1)} disabled={i === v.outline.length - 1} aria-label="Move section down"><ArrowDown size={14} /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeSection(i)} aria-label="Remove section"><Trash2 size={14} /></Button>
                  </div>
                )}
              </div>
              <textarea disabled={ro} className={`${inputCls} text-[13px]`} style={inputStyle} rows={Math.max(2, (outlineText[i] ?? "").split("\n").length)}
                value={outlineText[i] ?? ""} placeholder="What this section must cover, one point per line"
                aria-label={`Section ${i + 1} points`} onChange={(e) => setSectionPoints(i, e.target.value)} />
            </li>
          ))}
        </ol>
      </OACard>

      <OACard>
        <OACardHeader><OACardTitle>CTA and internal links</OACardTitle></OACardHeader>
        <fieldset disabled={ro} className="flex flex-col gap-4">
          <Field label="Call to action" hint={v.recommendedCta ? `Links to ${CTA_DESTINATIONS[v.recommendedCta as keyof typeof CTA_DESTINATIONS].path}` : undefined}>
            <select className={`${inputCls} max-w-xs`} style={inputStyle} value={v.recommendedCta} onChange={(e) => set("recommendedCta", e.target.value)}>
              <option value="">None</option>
              {CTA_TYPES.map((c) => <option key={c} value={c}>{CTA_LABELS[c]}</option>)}
            </select>
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>Suggested internal links</span>
            {v.internalLinks.length === 0 && <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>None.</p>}
            {v.internalLinks.map((l, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-start">
                <input className={`${inputCls} font-mono text-[12.5px]`} style={inputStyle} value={l.url} placeholder="/blog/slug" aria-label="Link URL"
                  onChange={(e) => setLink(i, { url: e.target.value })} />
                <input className={inputCls} style={inputStyle} value={l.anchorText} placeholder="Anchor text" aria-label="Anchor text"
                  onChange={(e) => setLink(i, { anchorText: e.target.value })} />
                <input className={inputCls} style={inputStyle} value={l.reason} placeholder="Why it helps the reader" aria-label="Reason"
                  onChange={(e) => setLink(i, { reason: e.target.value })} />
                {!ro && (
                  <Button variant="ghost" size="icon-sm" onClick={() => set("internalLinks", v.internalLinks.filter((_, j) => j !== i))} aria-label="Remove link">
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            ))}
            {!ro && (
              <div>
                <Button size="sm" variant="outline" onClick={() => set("internalLinks", [...v.internalLinks, { url: "", anchorText: "", reason: "" }])}>
                  <Plus size={14} /> Add link
                </Button>
              </div>
            )}
          </div>
        </fieldset>
      </OACard>

      <OACard>
        <OACardHeader><OACardTitle>Notes</OACardTitle></OACardHeader>
        <textarea disabled={ro} className={inputCls} style={inputStyle} rows={5} value={v.notes} onChange={(e) => set("notes", e.target.value)}
          aria-label="Notes" placeholder="CTA reasoning, things to verify before publishing…" />
      </OACard>

      <FormError message={error} />

      <div className="flex items-center gap-2 flex-wrap sticky bottom-0 py-3" style={{ background: "var(--paper)" }}>
        {!ro && <Button onClick={save} disabled={pending}>{pending ? "Saving…" : planId ? "Save plan" : "Create plan"}</Button>}
        {planId && article && (
          <Link href={`/admin/seo-agent/articles/${article.id}`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--r-md)] border text-[13px] font-semibold"
            style={{ borderColor: "var(--line-300)", color: "var(--ink-900)" }}>
            <FileText size={14} /> Open article
          </Link>
        )}
        {planId && !article && (
          <GenerateArticleButton
            planId={planId}
            disabledReason={dirty ? "Save your changes first" : !["IDEA", "PLANNED"].includes(initial.status) ? "This plan isn't ready for writing" : undefined}
          />
        )}
        {planId && !ro && <Button variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>}
        {saved && <span role="status" className="text-[12.5px]" style={{ color: "var(--success-tx)" }}>Saved</span>}
        {ro && <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>This plan&apos;s article is in progress, so the plan is read-only.</span>}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this content plan?"
        description="If it came from a recommendation, that recommendation goes back to Content Opportunities."
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
