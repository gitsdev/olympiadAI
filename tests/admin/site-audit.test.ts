import { describe, expect, it } from "vitest";
import {
  AUDIT_CATEGORIES, parseAuditPage, parseSitemapLocs, sameSite, scoreSiteAudit,
  type PageAuditFacts, type SiteFacts,
} from "@/lib/admin/site-audit-checks";

const SITE = "https://www.olympiadiq.in";

const goodHtml = (path: string, title: string) => `<!doctype html><html lang="en"><head>
<title>${title}</title>
<meta name="description" content="Free Olympiad mock tests and AI tutoring for Classes 1 to 10, with instant results and readiness scores.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${title}"><meta property="og:image" content="${SITE}/og.png">
<script type="application/ld+json">{"@type":"WebSite"}</script>
</head><body><h1>${title}</h1>
<p>${"Practice olympiad questions every day with clear explanations. ".repeat(20)}</p>
<img src="/a.png" alt="A chart"><img src="/b.png" alt="">
<a href="/blog">Blog</a> <a href="/start#top">Start</a> <a href="https://olympiadiq.in/learn/subject/mathematics">Maths</a>
<a href="https://example.com">Elsewhere</a> <a href="mailto:hi@olympiadiq.in">Mail</a>
</body></html>`;

const goodSite: SiteFacts = {
  siteUrl: SITE, robotsOk: true, robotsListsSitemap: true, sitemapOk: true, sitemapUrlCount: 2,
  httpRedirectsToHttps: true, brokenLinks: [], linksChecked: 10,
};

describe("parseAuditPage", () => {
  it("collects the facts the audit scores", () => {
    const p = parseAuditPage(goodHtml("/", "Free Olympiad Mock Tests | OlympiadIQ"), `${SITE}/`, 200, 420);
    expect(p).toMatchObject({
      title: "Free Olympiad Mock Tests | OlympiadIQ", h1Count: 1, lang: "en", canonical: `${SITE}/`, noindex: false,
      viewport: true, ogTitle: true, ogImage: true, jsonLd: true, images: 2, imagesWithoutAlt: 0,
    });
    expect(p.description.length).toBeGreaterThan(50);
    expect(p.wordCount).toBeGreaterThan(150);
  });

  it("keeps only same-site links, without fragments, and treats www and bare domain as one site", () => {
    const p = parseAuditPage(goodHtml("/", "Home page title here"), `${SITE}/`, 200, 100);
    expect(p.internalLinks.sort()).toEqual([`${SITE}/blog`, `${SITE}/start`, "https://olympiadiq.in/learn/subject/mathematics"].sort());
    expect(sameSite("https://olympiadiq.in/x", SITE)).toBe(true);
    expect(sameSite("https://evil.example/x", SITE)).toBe(false);
  });

  it("flags noindex and counts images with no alt attribute (alt=\"\" is fine)", () => {
    const p = parseAuditPage(`<html><head><meta name="robots" content="noindex, follow"></head><body><img src="x"><img src="y" alt=""></body></html>`, `${SITE}/x`, 200, 10);
    expect(p.noindex).toBe(true);
    expect(p.imagesWithoutAlt).toBe(1);
    expect(p.h1Count).toBe(0);
    expect(p.lang).toBeNull();
  });
});

describe("scoreSiteAudit", () => {
  const pages: PageAuditFacts[] = [
    parseAuditPage(goodHtml("/", "Free Olympiad Mock Tests | OlympiadIQ"), `${SITE}/`, 200, 300),
    parseAuditPage(goodHtml("/blog", "OlympiadIQ Blog: Olympiad Preparation Tips"), `${SITE}/blog`, 200, 400),
  ];

  it("gives a well-built site a high score with weighted categories", () => {
    const r = scoreSiteAudit(pages, goodSite);
    expect(r.categories.map((c) => c.id)).toEqual(AUDIT_CATEGORIES.map((c) => c.id));
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.issues.filter((i) => i.severity === "high")).toEqual([]);
  });

  it("finds and ranks real problems, and lowers the score", () => {
    const bad = parseAuditPage("<html><body><p>hi</p><img src=x></body></html>", `${SITE}/bad`, 200, 3500);
    const missing = parseAuditPage("", `${SITE}/gone`, 404, 50);
    const r = scoreSiteAudit([...pages, bad, missing], {
      ...goodSite, robotsListsSitemap: false, brokenLinks: [{ url: `${SITE}/old`, status: 404, foundOn: `${SITE}/` }],
    });
    const messages = r.issues.map((i) => i.message);
    expect(messages).toEqual(expect.arrayContaining([
      "Missing <title>.", "Missing meta description.", "Broken internal links.", "Missing mobile viewport tag.",
      "Pages in the sitemap that don't load (non-200 status).", "Images without alt text.", "robots.txt doesn't point to the sitemap.",
    ]));
    expect(r.issues[0].severity).toBe("high");
    expect(r.score).toBeLessThan(scoreSiteAudit(pages, goodSite).score);
  });

  it("reports duplicate titles across pages", () => {
    const dup = [pages[0], parseAuditPage(goodHtml("/x", "Free Olympiad Mock Tests | OlympiadIQ"), `${SITE}/x`, 200, 300)];
    expect(scoreSiteAudit(dup, goodSite).issues.map((i) => i.message)).toContain("Several pages share the same title.");
  });

  it("scores 0 when nothing could be checked", () => {
    expect(scoreSiteAudit([], { ...goodSite, sitemapOk: false }).score).toBe(0);
  });
});

describe("parseSitemapLocs", () => {
  it("reads urlsets and sitemap indexes", () => {
    expect(parseSitemapLocs(`<urlset><url><loc>${SITE}/</loc></url><url><loc> ${SITE}/blog?a=1&amp;b=2 </loc></url></urlset>`))
      .toEqual({ locs: [`${SITE}/`, `${SITE}/blog?a=1&b=2`], isIndex: false });
    expect(parseSitemapLocs(`<sitemapindex><sitemap><loc>${SITE}/s1.xml</loc></sitemap></sitemapindex>`).isIndex).toBe(true);
  });
});
