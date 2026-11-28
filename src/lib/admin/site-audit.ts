import "server-only";

// Runs the on-site SEO audit against the live site (the "Update score"
// button on /admin/seo). Only fetches pages on our own host, listed in our
// own sitemap, so there's no user-supplied URL to worry about.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseAuditPage, parseSitemapLocs, sameSite, scoreSiteAudit,
  type PageAuditFacts, type SiteAuditResult, type SiteFacts,
} from "./site-audit-checks";

export const AUDIT_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.olympiadiq.in").replace(/\/$/, "");
const USER_AGENT = "OlympiadIQ-SiteAudit/1.0 (+https://www.olympiadiq.in)";
const MAX_PAGES = 45;
const MAX_LINK_CHECKS = 80;
const PAGE_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 2_000_000;

async function get(url: string, opts: { method?: "GET" | "HEAD"; redirect?: RequestRedirect } = {}) {
  return fetch(url, {
    method: opts.method ?? "GET",
    redirect: opts.redirect ?? "follow",
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xml;q=0.9,*/*;q=0.5" },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    cache: "no-store",
  });
}

/** Runs `fn` over `items` with at most `n` in flight. */
async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

async function readText(res: Response): Promise<string> {
  const text = await res.text();
  return text.length > MAX_HTML_BYTES ? text.slice(0, MAX_HTML_BYTES) : text;
}

async function auditPage(url: string): Promise<PageAuditFacts> {
  const started = Date.now();
  try {
    const res = await get(url);
    const html = (res.headers.get("content-type") ?? "").includes("html") ? await readText(res) : "";
    const ms = Date.now() - started;
    // A redirect off our site, or to a different page, is reported with the final URL's status.
    const status = sameSite(res.url || url, AUDIT_SITE_URL) ? res.status : 0;
    return parseAuditPage(html, url, status, ms);
  } catch {
    return parseAuditPage("", url, 0, Date.now() - started);
  }
}

async function collectSitemapUrls(): Promise<{ urls: string[]; ok: boolean }> {
  try {
    const res = await get(`${AUDIT_SITE_URL}/sitemap.xml`);
    if (!res.ok) return { urls: [], ok: false };
    const parsed = parseSitemapLocs(await readText(res));
    let locs = parsed.locs;
    if (parsed.isIndex) {
      const nested = await pool(locs.slice(0, 5), 3, async (u) => {
        try {
          const r = await get(u);
          return r.ok ? parseSitemapLocs(await readText(r)).locs : [];
        } catch {
          return [];
        }
      });
      locs = nested.flat();
    }
    const urls = [...new Set(locs.filter((u) => sameSite(u, AUDIT_SITE_URL)))];
    return { urls, ok: urls.length > 0 };
  } catch {
    return { urls: [], ok: false };
  }
}

export interface SiteAuditRun extends SiteAuditResult {
  siteUrl: string;
  durationMs: number;
}

export async function runSiteAudit(): Promise<SiteAuditRun> {
  const started = Date.now();
  const [sitemap, robots, httpCheck] = await Promise.all([
    collectSitemapUrls(),
    get(`${AUDIT_SITE_URL}/robots.txt`).then(async (r) => ({ ok: r.ok, text: r.ok ? await r.text() : "" })).catch(() => ({ ok: false, text: "" })),
    get(AUDIT_SITE_URL.replace(/^https:/, "http:"), { redirect: "manual" })
      .then((r) => (r.status >= 300 && r.status < 400 ? (r.headers.get("location") ?? "").startsWith("https://") : false))
      .catch(() => null),
  ]);

  const urls = sitemap.urls.length ? sitemap.urls.slice(0, MAX_PAGES) : [`${AUDIT_SITE_URL}/`];
  const pages = await pool(urls, 6, auditPage);

  // Check internal links found on the pages that weren't audited themselves.
  const audited = new Set(urls);
  const linkTargets = new Map<string, string>();
  for (const p of pages) {
    for (const l of p.internalLinks) {
      if (!audited.has(l) && !linkTargets.has(l)) linkTargets.set(l, p.url);
    }
  }
  const toCheck = [...linkTargets.entries()].slice(0, MAX_LINK_CHECKS);
  const checked = await pool(toCheck, 8, async ([url, foundOn]) => {
    try {
      // GET, not HEAD: some routes don't answer HEAD. The body isn't read.
      const res = await get(url);
      res.body?.cancel().catch(() => {});
      return { url, foundOn, status: res.status };
    } catch {
      return { url, foundOn, status: null };
    }
  });
  const brokenLinks = checked.filter((c) => c.status === null || c.status >= 400);
  // Pages that failed in the main crawl also count as broken when linked.
  for (const p of pages) if (p.status >= 400) brokenLinks.push({ url: p.url, foundOn: "sitemap", status: p.status });

  const site: SiteFacts = {
    siteUrl: AUDIT_SITE_URL,
    robotsOk: robots.ok,
    robotsListsSitemap: /^\s*sitemap:/im.test(robots.text),
    sitemapOk: sitemap.ok,
    sitemapUrlCount: sitemap.urls.length,
    httpRedirectsToHttps: httpCheck,
    brokenLinks,
    linksChecked: checked.length + pages.length,
  };
  return { ...scoreSiteAudit(pages, site), siteUrl: AUDIT_SITE_URL, durationMs: Date.now() - started };
}

export interface StoredSiteAudit {
  id: string;
  score: number;
  pagesChecked: number;
  createdAt: string;
  result: Omit<SiteAuditResult, "score">;
}

export async function saveSiteAudit(db: SupabaseClient, run: SiteAuditRun, createdBy: string): Promise<void> {
  const { error } = await db.from("seo_site_audits").insert({
    site_url: run.siteUrl,
    score: run.score,
    pages_checked: run.pages.length,
    result: { categories: run.categories, issues: run.issues, pages: run.pages, site: run.site },
    duration_ms: run.durationMs,
    created_by: createdBy,
  });
  if (error) throw new Error(`Saving the audit failed: ${error.message}`);
}

/** Latest audit, or null if none yet (or the table doesn't exist until migration 026 runs). */
export async function getLatestSiteAudit(db: SupabaseClient): Promise<{ audit: StoredSiteAudit | null; tableMissing: boolean }> {
  const { data, error } = await db.from("seo_site_audits").select("id, score, pages_checked, created_at, result")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return { audit: null, tableMissing: true };
    throw new Error(`Loading the latest audit failed: ${error.message}`);
  }
  if (!data) return { audit: null, tableMissing: false };
  const r = data as { id: string; score: number; pages_checked: number; created_at: string; result: StoredSiteAudit["result"] };
  return { audit: { id: r.id, score: r.score, pagesChecked: r.pages_checked, createdAt: r.created_at, result: r.result }, tableMissing: false };
}
