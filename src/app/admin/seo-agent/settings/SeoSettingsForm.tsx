"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OACard, OACardHeader, OACardTitle } from "@/components/ui";
import { saveSeoSettings } from "@/actions/seo-agent/settings";
import {
  AI_PROVIDERS, BLOG_CATEGORIES, CTA_LABELS, CTA_TYPES, FREQUENCIES, humanizeStatus,
} from "@/lib/seo-agent/constants";
import type { SeoSettings } from "@/lib/seo-agent/settings-schema";

const inputCls = "w-full px-3 py-2 rounded-[var(--r-md)] border text-[14px] outline-none focus:border-[var(--cobalt-400)]";
const inputStyle = { borderColor: "var(--line-300)", background: "var(--surface)", color: "var(--ink-900)" } as const;

interface SecretStatus { name: string; purpose: string; configured: boolean }
interface PricingRow { model: string; input: string; output: string }

// Brand lists are edited one item per line.
const toLines = (items: string[]) => items.join("\n");
const fromLines = (text: string) => text.split("\n").map((s) => s.trim()).filter(Boolean);

export function SeoSettingsForm({ initial, secrets }: { initial: SeoSettings; secrets: SecretStatus[] }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [brandLists, setBrandLists] = useState({
    audience: toLines(initial.brand.audience),
    topics: toLines(initial.brand.topics),
    features: toLines(initial.brand.features),
  });
  const [pricing, setPricing] = useState<PricingRow[]>(
    Object.entries(initial.aiPricing).map(([model, p]) => ({ model, input: String(p.input), output: String(p.output) })),
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) => setS((prev) => ({ ...prev, [key]: value }));
  const setBrand = <K extends keyof SeoSettings["brand"]>(key: K, value: SeoSettings["brand"][K]) =>
    setS((prev) => ({ ...prev, brand: { ...prev.brand, [key]: value } }));

  async function handleSave() {
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const aiPricing: Record<string, { input: number; output: number }> = {};
    for (const row of pricing) {
      if (!row.model.trim()) continue;
      aiPricing[row.model.trim()] = { input: Number(row.input), output: Number(row.output) };
    }

    const res = await saveSeoSettings({
      ...s,
      searchConsoleSiteUrl: s.searchConsoleSiteUrl ?? "",
      aiPricing,
      brand: {
        ...s.brand,
        audience: fromLines(brandLists.audience),
        topics: fromLines(brandLists.topics),
        features: fromLines(brandLists.features),
      },
    });

    setPending(false);
    if (res.ok) {
      setMessage({ ok: true, text: "Settings saved." });
      router.refresh();
    } else {
      setMessage({ ok: false, text: res.error });
      setFieldErrors(res.fieldErrors ?? {});
    }
  }

  const err = (key: string) => fieldErrors[key];

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <OACard>
        <OACardHeader><OACardTitle>General</OACardTitle></OACardHeader>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Timezone" hint="Dates are stored in UTC and shown in this zone." error={err("timezone")}>
            <input className={inputCls} style={inputStyle} value={s.timezone} onChange={(e) => set("timezone", e.target.value)} />
          </Field>
          <Field label="Default article category" error={err("defaultArticleCategory")}>
            <select className={inputCls} style={inputStyle} value={s.defaultArticleCategory}
              onChange={(e) => set("defaultArticleCategory", e.target.value as SeoSettings["defaultArticleCategory"])}>
              {BLOG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Default CTA" error={err("defaultCta")}>
            <select className={inputCls} style={inputStyle} value={s.defaultCta}
              onChange={(e) => set("defaultCta", e.target.value as SeoSettings["defaultCta"])}>
              {CTA_TYPES.map((c) => <option key={c} value={c}>{CTA_LABELS[c]}</option>)}
            </select>
          </Field>
          <Field label="Blog base URL" hint="Published URL = base URL + / + slug." error={err("blogBaseUrl")}>
            <input className={inputCls} style={inputStyle} value={s.blogBaseUrl} onChange={(e) => set("blogBaseUrl", e.target.value)} />
          </Field>
        </div>
      </OACard>

      <OACard>
        <OACardHeader><OACardTitle>Publishing</OACardTitle></OACardHeader>
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-semibold mb-1" style={{ color: "var(--ink-900)" }}>Publishing mode</legend>
            <Radio
              checked={s.publishingMode === "MANUAL_APPROVAL"}
              onChange={() => set("publishingMode", "MANUAL_APPROVAL")}
              label="Manual approval (recommended)"
              hint="Nothing publishes until you approve it."
            />
            <Radio
              checked={s.publishingMode === "AUTO_PUBLISH"}
              onChange={() => set("publishingMode", "AUTO_PUBLISH")}
              label="Auto-publish"
              hint="Generated articles publish automatically if every validation passes. Otherwise they go to Review required."
            />
          </fieldset>
          {s.publishingMode === "AUTO_PUBLISH" && (
            <p className="flex gap-2 items-start text-[12.5px] p-3 rounded-[var(--r-md)]" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden />
              AI-written articles will go live on olympiadiq.in without a human reading them first.
            </p>
          )}
          <Field label="Default publishing time" hint={`In ${s.timezone}.`} error={err("defaultPublishTime")}>
            <input type="time" className={`${inputCls} max-w-40`} style={inputStyle} value={s.defaultPublishTime}
              onChange={(e) => set("defaultPublishTime", e.target.value)} />
          </Field>
        </div>
      </OACard>

      <OACard>
        <OACardHeader><OACardTitle>Schedules</OACardTitle></OACardHeader>
        <div className="grid sm:grid-cols-2 gap-4">
          <FrequencySelect label="Content planning" value={s.contentPlanningFrequency} onChange={(v) => set("contentPlanningFrequency", v)} />
          <FrequencySelect label="Article generation" value={s.articleGenerationFrequency} onChange={(v) => set("articleGenerationFrequency", v)} />
          <FrequencySelect label="Search Console sync" value={s.searchConsoleSyncFrequency} onChange={(v) => set("searchConsoleSyncFrequency", v)} />
          <FrequencySelect label="Backlink checking" value={s.backlinkCheckFrequency} onChange={(v) => set("backlinkCheckFrequency", v)} />
        </div>
      </OACard>

      <OACard>
        <OACardHeader><OACardTitle>AI</OACardTitle></OACardHeader>
        <div className="flex flex-col gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Provider" error={err("aiProvider")}>
              <select className={inputCls} style={inputStyle} value={s.aiProvider}
                onChange={(e) => set("aiProvider", e.target.value as SeoSettings["aiProvider"])}>
                {AI_PROVIDERS.map((p) => <option key={p} value={p}>{p === "openai" ? "OpenAI" : p}</option>)}
              </select>
            </Field>
            <Field label="Model" hint="Any model ID your OpenAI key can use." error={err("aiModel")}>
              <input className={inputCls} style={inputStyle} value={s.aiModel} onChange={(e) => set("aiModel", e.target.value)} />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>Model pricing (USD per 1M tokens)</p>
            <p className="text-[12px]" style={{ color: "var(--fg-muted)" }}>
              Copy these from your provider&apos;s pricing page. Costs for models not listed here are shown as unknown, not guessed.
            </p>
            {pricing.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_auto] gap-2 items-center">
                <input className={inputCls} style={inputStyle} placeholder="model id" aria-label="Model id" value={row.model}
                  onChange={(e) => setPricing((p) => p.map((r, j) => (j === i ? { ...r, model: e.target.value } : r)))} />
                <input className={inputCls} style={inputStyle} placeholder="input" aria-label="Input price" inputMode="decimal" value={row.input}
                  onChange={(e) => setPricing((p) => p.map((r, j) => (j === i ? { ...r, input: e.target.value } : r)))} />
                <input className={inputCls} style={inputStyle} placeholder="output" aria-label="Output price" inputMode="decimal" value={row.output}
                  onChange={(e) => setPricing((p) => p.map((r, j) => (j === i ? { ...r, output: e.target.value } : r)))} />
                <button type="button" onClick={() => setPricing((p) => p.filter((_, j) => j !== i))}
                  className="w-9 h-9 flex items-center justify-center rounded-[var(--r-md)] hover:bg-[var(--fill-100)]" aria-label="Remove pricing row">
                  <Trash2 size={15} style={{ color: "var(--ink-500)" }} />
                </button>
              </div>
            ))}
            {Object.keys(fieldErrors).some((k) => k.startsWith("aiPricing")) && (
              <p className="text-[12px]" style={{ color: "var(--danger-tx)" }}>Prices must be numbers between 0 and 1000.</p>
            )}
            <div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => setPricing((p) => [...p, { model: s.aiModel, input: "", output: "" }])}>
                <Plus size={14} /> Add model pricing
              </Button>
            </div>
          </div>
        </div>
      </OACard>

      <OACard>
        <OACardHeader><OACardTitle>Search Console</OACardTitle></OACardHeader>
        <Field label="Property" hint="e.g. sc-domain:olympiadiq.in or https://www.olympiadiq.in/. Credentials are configured as server environment variables." error={err("searchConsoleSiteUrl")}>
          <input className={inputCls} style={inputStyle} value={s.searchConsoleSiteUrl ?? ""} placeholder="sc-domain:olympiadiq.in"
            onChange={(e) => set("searchConsoleSiteUrl", e.target.value)} />
        </Field>
      </OACard>

      <OACard>
        <OACardHeader><OACardTitle>Brand profile</OACardTitle></OACardHeader>
        <p className="text-[12.5px] mb-4" style={{ color: "var(--fg-muted)" }}>
          Every agent gets this context. Only list features OlympiadIQ really has. Agents are told never to invent others.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Brand name" error={err("brand.name")}>
            <input className={inputCls} style={inputStyle} value={s.brand.name} onChange={(e) => setBrand("name", e.target.value)} />
          </Field>
          <Field label="Website" error={err("brand.website")}>
            <input className={inputCls} style={inputStyle} value={s.brand.website} onChange={(e) => setBrand("website", e.target.value)} />
          </Field>
          <Field label="Audience (one per line)" error={err("brand.audience")}>
            <textarea className={inputCls} style={inputStyle} rows={4} value={brandLists.audience}
              onChange={(e) => setBrandLists((b) => ({ ...b, audience: e.target.value }))} />
          </Field>
          <Field label="Features (one per line)" error={err("brand.features")}>
            <textarea className={inputCls} style={inputStyle} rows={4} value={brandLists.features}
              onChange={(e) => setBrandLists((b) => ({ ...b, features: e.target.value }))} />
          </Field>
          <Field label="Primary topics (one per line)" error={err("brand.topics")}>
            <textarea className={inputCls} style={inputStyle} rows={6} value={brandLists.topics}
              onChange={(e) => setBrandLists((b) => ({ ...b, topics: e.target.value }))} />
          </Field>
        </div>
      </OACard>

      <OACard>
        <OACardHeader><OACardTitle>Server secrets</OACardTitle></OACardHeader>
        <p className="text-[12.5px] mb-3" style={{ color: "var(--fg-muted)" }}>
          Set as environment variables in Vercel. Values are never shown here, only whether they are present.
        </p>
        <ul className="flex flex-col divide-y divide-[var(--line-200)]">
          {secrets.map((sec) => (
            <li key={sec.name} className="py-2 flex items-center justify-between gap-3 text-[13px]">
              <span className="flex flex-col">
                <code className="font-mono text-[12.5px]" style={{ color: "var(--ink-900)" }}>{sec.name}</code>
                <span style={{ color: "var(--fg-muted)" }}>{sec.purpose}</span>
              </span>
              {sec.configured ? (
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--success-tx)" }}>
                  <CheckCircle2 size={15} aria-hidden /> Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--danger-tx)" }}>
                  <XCircle size={15} aria-hidden /> Missing
                </span>
              )}
            </li>
          ))}
        </ul>
      </OACard>

      <div className="flex items-center gap-3 sticky bottom-0 py-3" style={{ background: "var(--paper)" }}>
        <Button onClick={handleSave} disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
        {message && (
          <span role="status" className="text-[12.5px]" style={{ color: message.ok ? "var(--success-tx)" : "var(--danger-tx)" }}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{label}</span>
      {children}
      {error ? (
        <span className="text-[12px]" style={{ color: "var(--danger-tx)" }}>{error}</span>
      ) : hint ? (
        <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>{hint}</span>
      ) : null}
    </label>
  );
}

function Radio({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint: string }) {
  return (
    <label className="flex gap-2.5 items-start cursor-pointer">
      <input type="radio" name="publishingMode" checked={checked} onChange={onChange} className="mt-1" />
      <span className="flex flex-col">
        <span className="text-[13.5px] font-medium" style={{ color: "var(--ink-900)" }}>{label}</span>
        <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>{hint}</span>
      </span>
    </label>
  );
}

function FrequencySelect({ label, value, onChange }: {
  label: string; value: SeoSettings["contentPlanningFrequency"]; onChange: (v: SeoSettings["contentPlanningFrequency"]) => void;
}) {
  return (
    <Field label={label}>
      <select className={inputCls} style={inputStyle} value={value}
        onChange={(e) => onChange(e.target.value as SeoSettings["contentPlanningFrequency"])}>
        {FREQUENCIES.map((f) => <option key={f} value={f}>{humanizeStatus(f)}</option>)}
      </select>
    </Field>
  );
}
