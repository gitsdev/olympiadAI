"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Copy, Gauge, Loader2, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Field, inputCls, inputStyle } from "@/components/seo-agent/FormField";
import { RichTextEditor } from "@/components/seo-agent/editor/RichTextEditor";
import { regenerateArticle, saveArticle } from "@/actions/seo-agent/articles";
import { BLOG_CATEGORIES, CTA_LABELS, CTA_TYPES, type CtaType } from "@/lib/seo-agent/constants";
import { META_DESCRIPTION_RANGE, META_TITLE_RANGE, type VersionMode } from "@/lib/seo-agent/articles";
import type { ArticleDetail } from "@/lib/seo-agent/articles-data";
import { cn } from "@/lib/utils";
import { VersionsPanel } from "./VersionsPanel";
import "@/components/seo-agent/editor/article-prose.css";

const AUTOSAVE_MS = 30_000;

interface Props {
  article: ArticleDetail;
  editable: boolean;
  timezone: string;
  blogBaseUrl: string;
  defaultCta: CtaType;
}

function Counter({ value, range }: { value: string; range: readonly [number, number] }) {
  const n = value.length;
  const ok = n >= range[0] && n <= range[1];
  return (
    <span className="text-[11.5px] tabular-nums" style={{ color: n === 0 ? "var(--fg-subtle)" : ok ? "var(--success-tx)" : "var(--warning-tx)" }}>
      {n} chars · aim for {range[0]}–{range[1]}
    </span>
  );
}

export function ArticleEditor({ article, editable, timezone, blogBaseUrl, defaultCta }: Props) {
  const router = useRouter();
  const [meta, setMeta] = useState({
    title: article.title,
    slug: article.slug ?? "",
    metaTitle: article.metaTitle ?? "",
    metaDescription: article.metaDescription ?? "",
    excerpt: article.excerpt ?? "",
    featuredImageUrl: article.featuredImageUrl ?? "",
    featuredImageAlt: article.featuredImageAlt ?? "",
    category: article.category ?? BLOG_CATEGORIES[0],
    ctaType: article.ctaType ?? "",
  });
  const htmlRef = useRef(article.contentHtml);
  const [previewHtml, setPreviewHtml] = useState(article.contentHtml);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<VersionMode | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const savingRef = useRef(false);

  const setField = <K extends keyof typeof meta>(k: K, v: (typeof meta)[K]) => { setMeta((m) => ({ ...m, [k]: v })); setDirty(true); };

  const save = useCallback(async (mode: VersionMode) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(mode);
    const res = await saveArticle(article.id, { ...meta, ctaType: meta.ctaType || null, contentHtml: htmlRef.current }, mode);
    savingRef.current = false;
    setSaving(null);
    if (!res.ok) {
      setStatus({ kind: "error", text: res.error });
      return;
    }
    setDirty(false);
    const time = new Date(res.savedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: timezone });
    setStatus({ kind: "ok", text: res.version ? `Saved as version ${res.version} at ${time}` : mode === "none" ? `Autosaved at ${time}` : `Saved at ${time} (no changes since the last version)` });
    if (mode !== "none") router.refresh();
  }, [article.id, meta, router, timezone]);

  // Autosave: keeps the draft safe without creating a version each time.
  useEffect(() => {
    if (!dirty || !editable) return;
    const t = setTimeout(() => { void save("none"); }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, editable, save]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function regenerate() {
    setRegenerating(true);
    setStatus(null);
    const res = await regenerateArticle(article.id);
    setRegenerating(false);
    if (!res.ok) { setStatus({ kind: "error", text: res.error }); return; }
    setDirty(false);
    router.refresh();
  }

  const url = `${blogBaseUrl.replace(/\/$/, "")}/${meta.slug}`;
  const verify = article.qualityFlags;

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {editable && (
          <>
            <Button onClick={() => save("auto")} disabled={saving !== null || regenerating}>
              {saving === "auto" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save draft
            </Button>
            <Button variant="outline" onClick={() => save("force")} disabled={saving !== null || regenerating}>Save version</Button>
            <Button variant="outline" onClick={() => setRegenOpen(true)} disabled={saving !== null || regenerating || !article.plan}>
              {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {regenerating ? "Rewriting… (1–3 min)" : "Regenerate"}
            </Button>
          </>
        )}
        <Button variant="outline" disabled title="SEO check arrives in Phase 5"><Gauge size={14} /> SEO check</Button>
        <Button variant="outline" disabled title="Approval arrives in Phase 6"><CheckCircle2 size={14} /> Approve</Button>
        <Button variant="outline" disabled title="Scheduling arrives in Phase 6"><CalendarClock size={14} /> Schedule</Button>
        <span role="status" className="text-[12.5px] ml-1" style={{ color: status?.kind === "error" ? "var(--danger-tx)" : "var(--fg-muted)" }}>
          {saving === "none" ? "Autosaving…" : status?.text ?? (dirty ? "Unsaved changes" : "")}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        {/* Main column */}
        <OACard className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1 p-1 rounded-[var(--r-md)]" style={{ background: "var(--fill-100)" }} role="tablist" aria-label="Editor view">
              {(["edit", "preview"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} type="button"
                  onClick={() => { if (t === "preview") setPreviewHtml(htmlRef.current); setTab(t); }}
                  className={cn("px-3 py-1 rounded-[var(--r-sm)] text-[13px] font-semibold", tab === t ? "bg-[var(--surface)] text-[var(--ink-900)]" : "text-[var(--ink-500)]")}>
                  {t === "edit" ? "Edit" : "Preview"}
                </button>
              ))}
            </div>
            <span className="text-[12px] font-mono truncate" style={{ color: "var(--fg-muted)" }}>{url}</span>
          </div>

          <input
            aria-label="Article title (H1)"
            disabled={!editable}
            className="w-full text-[26px] font-bold leading-tight outline-none bg-transparent"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
            value={meta.title}
            onChange={(e) => setField("title", e.target.value)}
          />

          <div className={tab === "edit" ? "" : "hidden"}>
            <RichTextEditor
              initialHtml={article.contentHtml}
              editable={editable && !regenerating}
              defaultCta={(meta.ctaType || defaultCta) as CtaType}
              onChange={(html) => { htmlRef.current = html; setDirty(true); }}
            />
          </div>
          {tab === "preview" && (
            <article className="seo-prose">
              {meta.featuredImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary https image URL
                <img src={meta.featuredImageUrl} alt={meta.featuredImageAlt} />
              )}
              {/* The editor's own HTML; it is sanitized on the server on every save. */}
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </article>
          )}
        </OACard>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {verify.length > 0 && (
            <OACard>
              <OACardHeader><OACardTitle className="text-[15px] flex items-center gap-2"><ShieldAlert size={16} style={{ color: "var(--warning-tx)" }} /> Check before publishing</OACardTitle></OACardHeader>
              <ul className="flex flex-col gap-2 text-[12.5px] list-disc pl-4" style={{ color: "var(--ink-700)" }}>
                {verify.map((f, i) => <li key={i}>{f.message}</li>)}
              </ul>
            </OACard>
          )}

          <OACard>
            <OACardHeader><OACardTitle className="text-[15px]">Details</OACardTitle></OACardHeader>
            <fieldset disabled={!editable} className="flex flex-col gap-3">
              <Field label="URL slug" hint={`/blog/${meta.slug}`}>
                <input className={`${inputCls} font-mono text-[13px]`} style={inputStyle} value={meta.slug} onChange={(e) => setField("slug", e.target.value.toLowerCase())} />
              </Field>
              <Field label="Meta title">
                <input className={inputCls} style={inputStyle} value={meta.metaTitle} onChange={(e) => setField("metaTitle", e.target.value)} />
                <Counter value={meta.metaTitle} range={META_TITLE_RANGE} />
              </Field>
              <Field label="Meta description">
                <textarea className={inputCls} style={inputStyle} rows={3} value={meta.metaDescription} onChange={(e) => setField("metaDescription", e.target.value)} />
                <Counter value={meta.metaDescription} range={META_DESCRIPTION_RANGE} />
              </Field>
              <Field label="Excerpt" hint="Shown in blog listings.">
                <textarea className={inputCls} style={inputStyle} rows={2} value={meta.excerpt} onChange={(e) => setField("excerpt", e.target.value)} />
              </Field>
              <Field label="Blog category">
                <select className={inputCls} style={inputStyle} value={meta.category} onChange={(e) => setField("category", e.target.value)}>
                  {BLOG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Primary CTA" hint="Used for new CTA blocks and reporting.">
                <select className={inputCls} style={inputStyle} value={meta.ctaType} onChange={(e) => setField("ctaType", e.target.value)}>
                  <option value="">None</option>
                  {CTA_TYPES.map((t) => <option key={t} value={t}>{CTA_LABELS[t]}</option>)}
                </select>
              </Field>
            </fieldset>
            <dl className="mt-3 text-[12px] flex flex-col gap-1" style={{ color: "var(--fg-muted)" }}>
              {article.primaryKeyword && <div>Primary keyword: <span style={{ color: "var(--ink-700)" }}>{article.primaryKeyword}</span></div>}
              {article.plan && <div>Plan: <Link href={`/admin/seo-agent/calendar/${article.plan.id}`} className="underline">{article.plan.title}</Link></div>}
            </dl>
          </OACard>

          <OACard>
            <OACardHeader><OACardTitle className="text-[15px]">Featured image</OACardTitle></OACardHeader>
            <fieldset disabled={!editable} className="flex flex-col gap-3">
              <Field label="Image URL" hint="https:// only. Upload support comes with publishing (Phase 6).">
                <input className={inputCls} style={inputStyle} value={meta.featuredImageUrl} placeholder="https://…" onChange={(e) => setField("featuredImageUrl", e.target.value)} />
              </Field>
              <Field label="Alt text">
                <input className={inputCls} style={inputStyle} value={meta.featuredImageAlt} onChange={(e) => setField("featuredImageAlt", e.target.value)} />
              </Field>
            </fieldset>
            {article.featuredImagePrompt && (
              <div className="mt-3 flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>AI image prompt</span>
                <p className="text-[12.5px] p-2 rounded-[var(--r-sm)]" style={{ background: "var(--paper-2)", color: "var(--ink-700)" }}>{article.featuredImagePrompt}</p>
                <Button size="sm" variant="ghost" className="w-fit" onClick={() => navigator.clipboard?.writeText(article.featuredImagePrompt ?? "")}>
                  <Copy size={13} /> Copy prompt
                </Button>
              </div>
            )}
          </OACard>

          <OACard>
            <OACardHeader><OACardTitle className="text-[15px]">Versions</OACardTitle></OACardHeader>
            <VersionsPanel articleId={article.id} versions={article.versions} timezone={timezone} editable={editable} hasUnsavedChanges={dirty} />
          </OACard>
        </div>
      </div>

      <ConfirmDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate this article?"
        description={`The Content Writer rewrites it from its plan. The current text stays in version history, so you can restore it.${dirty ? " Unsaved editor changes will be lost; save first if you want to keep them as a version." : ""}`}
        confirmLabel="Regenerate"
        onConfirm={() => { setRegenOpen(false); void regenerate(); }}
      />
    </div>
  );
}
