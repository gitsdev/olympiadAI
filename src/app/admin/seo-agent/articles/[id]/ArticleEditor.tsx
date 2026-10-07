"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { ClipboardCheck, Copy, Gauge, Loader2, Monitor, RefreshCw, Save, ShieldAlert, Smartphone, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Field, inputCls, inputStyle } from "@/components/seo-agent/FormField";
import { RichTextEditor } from "@/components/seo-agent/editor/RichTextEditor";
import { regenerateArticle, saveArticle } from "@/actions/seo-agent/articles";
import { dismissLinkSuggestion, findLinkSuggestions, runSeoCheck } from "@/actions/seo-agent/seo";
import { uploadFeaturedImage } from "@/actions/seo-agent/workflow";
import type { PublishValidation } from "@/lib/seo-agent/publishing/rules";
import { formatZoned } from "@/lib/seo-agent/datetime";
import { applyLinkAtText, setAllCtas } from "@/components/seo-agent/editor/commands";
import { withCtaCards } from "@/lib/seo-agent/cta";
import { BLOG_CATEGORIES, CTA_LABELS, CTA_TYPES, type CtaType } from "@/lib/seo-agent/constants";
import { META_DESCRIPTION_RANGE, META_TITLE_RANGE, type VersionMode } from "@/lib/seo-agent/articles";
import type { ArticleDetail } from "@/lib/seo-agent/articles-data";
import { cn } from "@/lib/utils";
import { VersionsPanel } from "./VersionsPanel";
import { SearchPreview, SeoPanel } from "./SeoPanel";
import { LinkSuggestionsPanel } from "./LinkSuggestionsPanel";
import { PublishChecklist, WorkflowBar } from "./WorkflowBar";
import "@/components/seo-agent/editor/article-prose.css";

const AUTOSAVE_MS = 30_000;

interface Props {
  article: ArticleDetail;
  editable: boolean;
  timezone: string;
  blogBaseUrl: string;
  defaultCta: CtaType;
  defaultPublishTime: string;
  checklist: PublishValidation | null;
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

export function ArticleEditor({ article, editable, timezone, blogBaseUrl, defaultCta, defaultPublishTime, checklist }: Props) {
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
  const [seoRunning, setSeoRunning] = useState(false);
  const [findingLinks, setFindingLinks] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [uploading, setUploading] = useState(false);
  const savingRef = useRef(false);

  const setField = <K extends keyof typeof meta>(k: K, v: (typeof meta)[K]) => { setMeta((m) => ({ ...m, [k]: v })); setDirty(true); };

  /** Returns true once the article is saved. */
  const save = useCallback(async (mode: VersionMode): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(mode);
    const res = await saveArticle(article.id, { ...meta, ctaType: meta.ctaType || null, contentHtml: htmlRef.current }, mode);
    savingRef.current = false;
    setSaving(null);
    if (!res.ok) {
      setStatus({ kind: "error", text: res.error });
      return false;
    }
    setDirty(false);
    const time = new Date(res.savedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: timezone });
    setStatus({ kind: "ok", text: res.version ? `Saved as version ${res.version} at ${time}` : mode === "none" ? `Autosaved at ${time}` : `Saved at ${time} (no changes since the last version)` });
    if (mode !== "none") router.refresh();
    return true;
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

  /** SEO checks and link suggestions read the saved article, so save pending edits first. */
  async function saveIfDirty(): Promise<boolean> {
    return !dirty || !editable || (await save("auto"));
  }

  async function seoCheck() {
    setSeoRunning(true);
    setStatus(null);
    if (await saveIfDirty()) {
      const res = await runSeoCheck(article.id);
      setStatus(res.ok ? { kind: "ok", text: `SEO check done: ${res.score}/100 (internal score)` } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    }
    setSeoRunning(false);
  }

  async function findLinks() {
    setFindingLinks(true);
    setStatus(null);
    if (await saveIfDirty()) {
      const res = await findLinkSuggestions(article.id);
      setStatus(res.ok ? { kind: "ok", text: `${res.added} new link suggestion(s)` } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    }
    setFindingLinks(false);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setStatus(null);
    const form = new FormData();
    form.append("file", file);
    const res = await uploadFeaturedImage(article.id, form);
    setUploading(false);
    if (!res.ok) { setStatus({ kind: "error", text: res.error }); return; }
    // Already saved on the server; just reflect it here.
    setMeta((m) => ({ ...m, featuredImageUrl: res.url }));
    setStatus({ kind: "ok", text: "Featured image uploaded." });
  }

  function switchCta(type: CtaType) {
    if (!editor) return;
    const n = setAllCtas(editor, type);
    setField("ctaType", type);
    setStatus({ kind: "ok", text: `Switched ${n} CTA block(s) to ${CTA_LABELS[type]}. Save to keep it.` });
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
        <Button variant="outline" onClick={seoCheck} disabled={seoRunning || regenerating || saving !== null}>
          {seoRunning ? <Loader2 size={14} className="animate-spin" /> : <Gauge size={14} />} SEO check
        </Button>
        <span role="status" className="text-[12.5px] ml-1" style={{ color: status?.kind === "error" ? "var(--danger-tx)" : "var(--fg-muted)" }}>
          {saving === "none" ? "Autosaving…" : status?.text ?? (dirty ? "Unsaved changes" : "")}
        </span>
      </div>

      <OACard className="py-3">
        <WorkflowBar
          articleId={article.id}
          status={article.status}
          timezone={timezone}
          defaultPublishTime={defaultPublishTime}
          plannedPublishAt={article.plan?.plannedPublishAt ?? null}
          scheduledFor={article.scheduledFor}
          publishedUrl={article.publishedUrl}
          approvedLabel={article.approvedAt ? `Approved by ${article.approvedByName ?? "an admin"} on ${formatZoned(article.approvedAt, timezone)}` : null}
          blogUrl={url}
          saveFirst={saveIfDirty}
        />
      </OACard>

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
            {tab === "preview" ? (
              <div className="flex gap-1" role="group" aria-label="Preview width">
                <Button size="sm" variant={device === "desktop" ? "secondary" : "ghost"} onClick={() => setDevice("desktop")} aria-pressed={device === "desktop"}><Monitor size={14} /> Desktop</Button>
                <Button size="sm" variant={device === "mobile" ? "secondary" : "ghost"} onClick={() => setDevice("mobile")} aria-pressed={device === "mobile"}><Smartphone size={14} /> Mobile</Button>
              </div>
            ) : (
              <span className="text-[12px] font-mono truncate" style={{ color: "var(--fg-muted)" }}>{url}</span>
            )}
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
              onReady={setEditor}
            />
          </div>
          {tab === "preview" && (
            <div className="flex flex-col gap-4">
              <SearchPreview title={meta.title} metaTitle={meta.metaTitle} metaDescription={meta.metaDescription} excerpt={meta.excerpt} url={url} />
              <article className={cn("seo-prose", device === "mobile" && "seo-preview-mobile")}>
                <h1>{meta.title}</h1>
                {meta.featuredImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary https image URL
                  <img src={meta.featuredImageUrl} alt={meta.featuredImageAlt} />
                )}
                {/* TipTap output (schema-limited); stored copies are sanitized on the server on every save. */}
                <div dangerouslySetInnerHTML={{ __html: withCtaCards(previewHtml) }} />
              </article>
            </div>
          )}
        </OACard>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {checklist && (
            <OACard>
              <OACardHeader><OACardTitle className="text-[15px] flex items-center gap-2"><ClipboardCheck size={16} /> Publishing checks</OACardTitle></OACardHeader>
              <PublishChecklist errors={checklist.errors} warnings={checklist.warnings} />
            </OACard>
          )}

          <OACard>
            <OACardHeader><OACardTitle className="text-[15px] flex items-center gap-2"><Gauge size={16} /> SEO check</OACardTitle></OACardHeader>
            <SeoPanel
              analysis={article.seoAnalysis}
              stale={article.seoStale}
              dirty={dirty}
              running={seoRunning}
              editable={editable}
              timezone={timezone}
              onRun={seoCheck}
              onUseCta={switchCta}
            />
          </OACard>

          <OACard>
            <OACardHeader><OACardTitle className="text-[15px]">Internal link suggestions</OACardTitle></OACardHeader>
            <LinkSuggestionsPanel
              suggestions={article.linkSuggestions}
              editable={editable}
              finding={findingLinks}
              onFind={findLinks}
              onApply={(s) => (editor ? applyLinkAtText(editor, s.anchorText, s.url) : false)}
              onDismiss={async (s) => {
                const res = await dismissLinkSuggestion(s.id);
                if (!res.ok) setStatus({ kind: "error", text: res.error });
                else router.refresh();
              }}
            />
          </OACard>

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
              <label className={`inline-flex items-center gap-1.5 w-fit h-8 px-3 rounded-[var(--r-md)] border text-[12.5px] font-semibold ${uploading || !editable ? "opacity-50" : "cursor-pointer hover:bg-[var(--fill-100)]"}`}
                style={{ borderColor: "var(--line-300)", color: "var(--ink-700)" }}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {uploading ? "Uploading…" : "Upload image"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading || !editable}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadImage(f); }} />
              </label>
              <Field label="Image URL" hint="JPEG, PNG or WebP up to 5 MB. External images are copied to our storage when published.">
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
