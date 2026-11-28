// On-site SEO audit: per-page facts and scoring. Pure (no network) so it's
// unit-tested; fetching lives in site-audit.ts.
//
// The score measures what we control on our own pages (titles, meta,
// headings, links, images, crawlability, speed). It is NOT domain
// authority, so it isn't comparable to the competitor estimates.

import { unified } from "unified";
import rehypeParse from "rehype-parse";
import type { Element, ElementContent, Root, RootContent } from "hast";

export interface PageAuditFacts {
  url: string;
  status: number;
  /** Time to the full HTML, ms. */
  ms: number;
  title: string;
  description: string;
  h1Count: number;
  lang: string | null;
  canonical: string | null;
  noindex: boolean;
  viewport: boolean;
  ogTitle: boolean;
  ogImage: boolean;
  jsonLd: boolean;
  images: number;
  imagesWithoutAlt: number;
  /** Absolute same-site link URLs (no fragments), de-duplicated. */
  internalLinks: string[];
  wordCount: number;
}

const SKIP_TEXT = new Set(["script", "style", "noscript", "svg", "template", "head"]);

function textOf(n: RootContent | ElementContent): string {
  if (n.type === "text") return n.value;
  if (n.type === "element") return SKIP_TEXT.has(n.tagName) ? "" : n.children.map(textOf).join(" ");
  return "";
}

function walk(n: Root | Element, visit: (el: Element) => void) {
  for (const c of n.children) {
    if (c.type === "element") {
      visit(c);
      walk(c, visit);
    }
  }
}

const prop = (el: Element, name: string): string | null => {
  const v = el.properties?.[name];
  if (v === undefined || v === null || v === false) return null;
  return Array.isArray(v) ? v.join(" ") : String(v);
};

/** Same site = same host, ignoring a leading www. */
export function sameSite(a: string, b: string): boolean {
  try {
    const h = (u: string) => new URL(u).hostname.replace(/^www\./, "");
    return h(a) === h(b);
  } catch {
    return false;
  }
}

export function parseAuditPage(html: string, url: string, status: number, ms: number): PageAuditFacts {
  const tree = unified().use(rehypeParse).parse(html) as Root;
  let title = "";
  let description = "";
  let h1Count = 0;
  let lang: string | null = null;
  let canonical: string | null = null;
  let noindex = false;
  let viewport = false;
  let ogTitle = false;
  let ogImage = false;
  let jsonLd = false;
  let images = 0;
  let imagesWithoutAlt = 0;
  const links = new Set<string>();
  // Assigned inside the callback; a holder keeps TypeScript from narrowing it to null.
  const found: { body: Element | null } = { body: null };

  walk(tree, (el) => {
    switch (el.tagName) {
      case "html": lang = prop(el, "lang"); break;
      case "body": found.body = el; break;
      case "title": if (!title) title = el.children.map(textOf).join("").trim(); break;
      case "h1": h1Count++; break;
      case "meta": {
        const name = (prop(el, "name") ?? "").toLowerCase();
        const property = (prop(el, "property") ?? "").toLowerCase();
        const content = prop(el, "content") ?? "";
        if (name === "description") description = content.trim();
        if (name === "robots" && /noindex/i.test(content)) noindex = true;
        if (name === "viewport") viewport = true;
        if (property === "og:title" && content) ogTitle = true;
        if (property === "og:image" && content) ogImage = true;
        break;
      }
      case "link":
        if ((prop(el, "rel") ?? "").split(/\s+/).includes("canonical")) canonical = prop(el, "href");
        break;
      case "script":
        if ((prop(el, "type") ?? "").toLowerCase() === "application/ld+json") jsonLd = true;
        break;
      case "img": {
        images++;
        // alt="" is valid for decorative images; only a missing alt counts.
        if (el.properties?.alt === undefined) imagesWithoutAlt++;
        break;
      }
      case "a": {
        const href = prop(el, "href");
        if (!href || /^(mailto|tel|javascript):/i.test(href)) break;
        try {
          const abs = new URL(href, url);
          abs.hash = "";
          if (/^https?:$/.test(abs.protocol) && sameSite(abs.href, url)) links.add(abs.href);
        } catch { /* ignore bad hrefs */ }
        break;
      }
    }
  });

  const text = found.body ? textOf(found.body) : "";
  return {
    url, status, ms, title, description, h1Count, lang, canonical, noindex, viewport, ogTitle, ogImage, jsonLd,
    images, imagesWithoutAlt, internalLinks: [...links].filter((l) => l !== url), wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}

// ── Scoring ──────────────────────────────────────────────────────────────

export type AuditCategoryId = "CRAWL" | "META" | "STRUCTURE" | "LINKS" | "IMAGES" | "SHARING" | "SPEED";

export const AUDIT_CATEGORIES: { id: AuditCategoryId; label: string; weight: number }[] = [
  { id: "CRAWL", label: "Crawlability & indexing", weight: 20 },
  { id: "META", label: "Titles & meta descriptions", weight: 20 },
  { id: "STRUCTURE", label: "Page structure", weight: 15 },
  { id: "LINKS", label: "Internal links", weight: 15 },
  { id: "IMAGES", label: "Image alt text", weight: 10 },
  { id: "SHARING", label: "Social & structured data", weight: 10 },
  { id: "SPEED", label: "Server response time", weight: 10 },
];

export type IssueSeverity = "high" | "medium" | "low";

export interface AuditIssue {
  category: AuditCategoryId;
  severity: IssueSeverity;
  message: string;
  /** Example affected URLs (at most 5). */
  examples: string[];
  count: number;
}

export interface SiteFacts {
  siteUrl: string;
  robotsOk: boolean;
  robotsListsSitemap: boolean;
  sitemapOk: boolean;
  sitemapUrlCount: number;
  httpRedirectsToHttps: boolean | null;
  /** Internal link targets that returned 4xx/5xx (or failed). */
  brokenLinks: { url: string; status: number | null; foundOn: string }[];
  linksChecked: number;
}

export interface AuditCategoryResult {
  id: AuditCategoryId;
  label: string;
  weight: number;
  /** 0–100. */
  score: number;
}

export interface SiteAuditResult {
  score: number;
  categories: AuditCategoryResult[];
  issues: AuditIssue[];
  pages: { url: string; status: number; ms: number; title: string; issues: number }[];
  site: Omit<SiteFacts, "brokenLinks"> & { brokenLinks: number };
}

const SLOW_MS = 1500;
const VERY_SLOW_MS = 3000;

/** Pass rate across pages for one check, 0–1. Pages that can't be judged (errors) count as fails. */
const rate = (pages: PageAuditFacts[], pass: (p: PageAuditFacts) => boolean) =>
  pages.length ? pages.filter(pass).length / pages.length : 0;

export function scoreSiteAudit(pages: PageAuditFacts[], site: SiteFacts): SiteAuditResult {
  const ok = pages.filter((p) => p.status === 200);
  const issues: AuditIssue[] = [];
  const add = (category: AuditCategoryId, severity: IssueSeverity, message: string, affected: string[]) => {
    if (affected.length) issues.push({ category, severity, message, examples: affected.slice(0, 5), count: affected.length });
  };
  const where = (pred: (p: PageAuditFacts) => boolean, from = ok) => from.filter(pred).map((p) => p.url);

  // Duplicate titles/descriptions across pages.
  const dupes = (key: (p: PageAuditFacts) => string) => {
    const seen = new Map<string, string[]>();
    for (const p of ok) {
      const k = key(p).trim().toLowerCase();
      if (k) seen.set(k, [...(seen.get(k) ?? []), p.url]);
    }
    return [...seen.values()].filter((v) => v.length > 1).flat();
  };
  const dupTitles = dupes((p) => p.title);
  const dupDescs = dupes((p) => p.description);

  // CRAWL
  const errorPages = pages.filter((p) => p.status !== 200).map((p) => `${p.url} (${p.status || "no response"})`);
  const noindexPages = where((p) => p.noindex);
  const badCanonical = where((p) => !p.canonical || !sameSite(new URL(p.canonical, p.url).href, site.siteUrl));
  add("CRAWL", "high", "Pages in the sitemap that don't load (non-200 status).", errorPages);
  add("CRAWL", "high", "Sitemap pages marked noindex, so Google won't index them.", noindexPages);
  add("CRAWL", "medium", "Missing or off-site canonical tag.", badCanonical);
  if (!site.robotsOk) add("CRAWL", "high", "robots.txt is missing or doesn't load.", [`${site.siteUrl}/robots.txt`]);
  else if (!site.robotsListsSitemap) add("CRAWL", "low", "robots.txt doesn't point to the sitemap.", [`${site.siteUrl}/robots.txt`]);
  if (!site.sitemapOk) add("CRAWL", "high", "sitemap.xml is missing, empty or invalid.", [`${site.siteUrl}/sitemap.xml`]);
  if (site.httpRedirectsToHttps === false) add("CRAWL", "high", "http:// doesn't redirect to https://.", [site.siteUrl.replace("https://", "http://")]);
  const crawl = (
    rate(pages, (p) => p.status === 200) * 4 +
    rate(ok, (p) => !p.noindex) * 2 +
    rate(ok, (p) => Boolean(p.canonical)) * 2 +
    (site.robotsOk ? 1 : 0) + (site.robotsListsSitemap ? 0.5 : 0) +
    (site.sitemapOk ? 1.5 : 0) + (site.httpRedirectsToHttps === false ? 0 : 1)
  ) / 12;

  // META
  add("META", "high", "Missing <title>.", where((p) => !p.title));
  add("META", "medium", "Title shorter than 15 or longer than 65 characters.", where((p) => Boolean(p.title) && (p.title.length < 15 || p.title.length > 65)));
  add("META", "high", "Missing meta description.", where((p) => !p.description));
  add("META", "low", "Meta description shorter than 50 or longer than 170 characters.", where((p) => Boolean(p.description) && (p.description.length < 50 || p.description.length > 170)));
  add("META", "medium", "Several pages share the same title.", dupTitles);
  add("META", "medium", "Several pages share the same meta description.", dupDescs);
  const meta = (
    rate(ok, (p) => Boolean(p.title)) * 3 +
    rate(ok, (p) => p.title.length >= 15 && p.title.length <= 65) * 2 +
    rate(ok, (p) => Boolean(p.description)) * 3 +
    rate(ok, (p) => p.description.length >= 50 && p.description.length <= 170) * 1 +
    (ok.length ? 1 - dupTitles.length / ok.length : 0) * 1 +
    (ok.length ? 1 - dupDescs.length / ok.length : 0) * 1
  ) / 11;

  // STRUCTURE
  add("STRUCTURE", "medium", "No <h1> heading.", where((p) => p.h1Count === 0));
  add("STRUCTURE", "low", "More than one <h1> heading.", where((p) => p.h1Count > 1));
  add("STRUCTURE", "medium", "Missing lang attribute on <html>.", where((p) => !p.lang));
  add("STRUCTURE", "high", "Missing mobile viewport tag.", where((p) => !p.viewport));
  add("STRUCTURE", "low", "Thin page: under 150 words of text.", where((p) => p.wordCount < 150));
  const structure = (
    rate(ok, (p) => p.h1Count === 1) * 3 + rate(ok, (p) => Boolean(p.lang)) * 1 +
    rate(ok, (p) => p.viewport) * 2 + rate(ok, (p) => p.wordCount >= 150) * 2
  ) / 8;

  // LINKS
  add("LINKS", "medium", "Fewer than 3 internal links on the page.", where((p) => p.internalLinks.length < 3));
  add("LINKS", "high", "Broken internal links.", site.brokenLinks.map((b) => `${b.url} (${b.status ?? "no response"}, linked from ${b.foundOn})`));
  const brokenRate = site.linksChecked ? site.brokenLinks.length / site.linksChecked : 0;
  const links = (rate(ok, (p) => p.internalLinks.length >= 3) * 1 + Math.max(0, 1 - brokenRate * 5) * 1) / 2;

  // IMAGES
  const totalImages = ok.reduce((s, p) => s + p.images, 0);
  const missingAlt = ok.reduce((s, p) => s + p.imagesWithoutAlt, 0);
  add("IMAGES", "medium", "Images without alt text.", where((p) => p.imagesWithoutAlt > 0));
  const images = totalImages ? 1 - missingAlt / totalImages : 1;

  // SHARING
  add("SHARING", "low", "Missing og:title.", where((p) => !p.ogTitle));
  add("SHARING", "medium", "Missing og:image (no picture when shared).", where((p) => !p.ogImage));
  add("SHARING", "low", "No structured data (JSON-LD).", where((p) => !p.jsonLd));
  const sharing = (rate(ok, (p) => p.ogTitle) + rate(ok, (p) => p.ogImage) * 2 + rate(ok, (p) => p.jsonLd)) / 4;

  // SPEED (server response, not full page speed)
  add("SPEED", "high", `Server took over ${VERY_SLOW_MS / 1000} s to send the page.`, where((p) => p.ms > VERY_SLOW_MS));
  add("SPEED", "low", `Server took over ${SLOW_MS / 1000} s to send the page.`, where((p) => p.ms > SLOW_MS && p.ms <= VERY_SLOW_MS));
  const speed = ok.length ? ok.reduce((s, p) => s + (p.ms <= SLOW_MS ? 1 : p.ms <= VERY_SLOW_MS ? 0.5 : 0), 0) / ok.length : 0;

  const raw: Record<AuditCategoryId, number> = { CRAWL: crawl, META: meta, STRUCTURE: structure, LINKS: links, IMAGES: images, SHARING: sharing, SPEED: speed };
  const categories = AUDIT_CATEGORIES.map((c) => ({ ...c, score: Math.round(Math.min(1, Math.max(0, raw[c.id])) * 100) }));
  const totalWeight = AUDIT_CATEGORIES.reduce((s, c) => s + c.weight, 0);
  const score = pages.length ? Math.round(categories.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight) : 0;

  const rank: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count);

  const perPage = new Map<string, number>();
  for (const i of issues) for (const u of i.examples) perPage.set(u, (perPage.get(u) ?? 0) + 1);

  return {
    score,
    categories,
    issues,
    pages: pages.map((p) => ({ url: p.url, status: p.status, ms: p.ms, title: p.title, issues: perPage.get(p.url) ?? 0 })),
    site: { ...site, brokenLinks: site.brokenLinks.length },
  };
}

/** <loc> URLs from a sitemap or sitemap index. */
export function parseSitemapLocs(xml: string): { locs: string[]; isIndex: boolean } {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
  return { locs, isIndex };
}
