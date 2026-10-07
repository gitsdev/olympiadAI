"use client";

import { AlertTriangle, Gauge, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OABadge, OARing } from "@/components/ui";
import { CTA_LABELS, humanizeStatus, type CtaType } from "@/lib/seo-agent/constants";
import { SEO_CATEGORY_LABELS } from "@/lib/seo-agent/seo-categories";
import { formatZoned } from "@/lib/seo-agent/datetime";
import type { SeoAnalysis } from "@/lib/seo-agent/agents/seo-analyst";

const PRIORITY_TONE = { HIGH: "red", MEDIUM: "amber", LOW: "neutral" } as const;

function scoreColor(score: number): string {
  return score >= 80 ? "var(--success-tx)" : score >= 60 ? "var(--warning-tx)" : "var(--danger-tx)";
}

interface Props {
  analysis: SeoAnalysis | null;
  stale: boolean;
  dirty: boolean;
  running: boolean;
  editable: boolean;
  timezone: string;
  onRun: () => void;
  onUseCta: (type: CtaType) => void;
}

export function SeoPanel({ analysis, stale, dirty, running, editable, timezone, onRun, onUseCta }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {!analysis ? (
        <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          Not checked yet. The SEO check scores title, meta, headings, keyword use, intent, completeness, readability, links and CTA, and fact-checks the article.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <OARing value={analysis.score} size={64} stroke={7} color={scoreColor(analysis.score)}>
              <span className="text-[17px] font-black" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>{analysis.score}</span>
            </OARing>
            <div className="flex flex-col text-[12px]" style={{ color: "var(--fg-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--ink-900)" }}>Content-quality score</span>
              <span>Internal score out of 100, not a Google ranking score. It can&apos;t guarantee rankings.</span>
              <span>Checked {formatZoned(analysis.checkedAt, timezone)} (v{analysis.articleVersion})</span>
            </div>
          </div>

          {(stale || dirty) && (
            <p className="flex gap-1.5 items-start text-[12px] p-2 rounded-[var(--r-sm)]" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> The article changed since this check. Run it again for an up-to-date score.
            </p>
          )}

          {analysis.critical.length > 0 && (
            <div className="text-[12px] p-2 rounded-[var(--r-sm)] flex flex-col gap-1" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
              <span className="font-semibold flex items-center gap-1.5"><ShieldAlert size={14} /> Must fix before publishing</span>
              <ul className="list-disc pl-4">{analysis.critical.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}

          <details className="text-[12.5px]">
            <summary className="cursor-pointer font-semibold" style={{ color: "var(--ink-700)" }}>Score breakdown</summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {analysis.categories.map((c) => (
                <li key={c.category} className="flex flex-col gap-0.5">
                  <span className="flex items-center justify-between gap-2">
                    <span style={{ color: "var(--ink-700)" }}>{SEO_CATEGORY_LABELS[c.category]}</span>
                    <span className="font-semibold tabular-nums" style={{ color: scoreColor(c.score) }}>{c.score}</span>
                  </span>
                  <span className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--fill-100)" }}>
                    <span className="block h-full" style={{ width: `${c.score}%`, background: scoreColor(c.score) }} />
                  </span>
                  {c.notes.map((n, i) => <span key={i} className="text-[11.5px]" style={{ color: "var(--fg-muted)" }}>{n}</span>)}
                </li>
              ))}
            </ul>
          </details>

          {analysis.recommendations.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--ink-900)" }}>Recommendations</span>
              <ul className="flex flex-col gap-2">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="text-[12.5px] flex gap-2 items-start" style={{ color: "var(--ink-700)" }}>
                    <OABadge tone={PRIORITY_TONE[r.priority]} className="shrink-0">{humanizeStatus(r.priority)}</OABadge>
                    <span>{r.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.factIssues.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--ink-900)" }}>Fact check ({analysis.factIssues.length})</span>
              <ul className="flex flex-col gap-2">
                {analysis.factIssues.map((f, i) => (
                  <li key={i} className="text-[12.5px] flex flex-col gap-0.5" style={{ color: "var(--ink-700)" }}>
                    <span className="flex items-center gap-1.5">
                      <OABadge tone={PRIORITY_TONE[f.severity]}>{humanizeStatus(f.severity)}</OABadge>
                      <span className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{humanizeStatus(f.kind)}</span>
                    </span>
                    <q className="italic">{f.excerpt}</q>
                    <span>{f.issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-1 text-[12.5px] p-2 rounded-[var(--r-sm)]" style={{ background: "var(--paper-2)", color: "var(--ink-700)" }}>
            <span className="font-semibold" style={{ color: "var(--ink-900)" }}>
              Recommended CTA: {CTA_LABELS[analysis.cta.recommended]}
              {analysis.cta.current === analysis.cta.recommended && <span className="font-normal" style={{ color: "var(--success-tx)" }}> (in use)</span>}
            </span>
            <span>{analysis.cta.reason}</span>
            {editable && analysis.cta.current !== analysis.cta.recommended && (
              <Button size="sm" variant="outline" className="w-fit mt-1" onClick={() => onUseCta(analysis.cta.recommended)}>
                Use this CTA
              </Button>
            )}
          </div>
        </>
      )}

      <Button size="sm" onClick={onRun} disabled={running}>
        {running ? <Loader2 size={14} className="animate-spin" /> : <Gauge size={14} />}
        {running ? "Checking… (20–60s)" : analysis ? "Run SEO check again" : "Run SEO check"}
      </Button>
      {dirty && <span className="text-[11.5px]" style={{ color: "var(--fg-muted)" }}>Unsaved changes are saved first.</span>}
    </div>
  );
}

/** Approximates how the article could appear in Google results (lengths are approximate). */
export function SearchPreview({ title, metaTitle, metaDescription, excerpt, url }: {
  title: string; metaTitle: string; metaDescription: string; excerpt: string; url: string;
}) {
  const t = metaTitle || title;
  const d = metaDescription || excerpt;
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  const crumbs = url.replace(/^https?:\/\//, "").split("/").filter(Boolean);
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-[var(--r-md)] border" style={{ borderColor: "var(--line-200)", background: "var(--surface)", fontFamily: "Arial, sans-serif" }}>
      <span className="text-[12px] truncate" style={{ color: "#4d5156" }}>{crumbs[0]} › {crumbs.slice(1).join(" › ")}</span>
      <span className="text-[17px] leading-snug" style={{ color: "#1a0dab" }}>{cut(t, 60) || "Untitled"}</span>
      <span className="text-[13px] leading-snug" style={{ color: "#4d5156" }}>{cut(d, 160) || "No meta description; Google will pick text from the page."}</span>
    </div>
  );
}
