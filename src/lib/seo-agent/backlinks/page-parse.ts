// Parsing fetched web pages for backlink work. Pure (no network), so it's
// unit-tested; the fetching itself lives in safe-fetch.ts.

import { unified } from "unified";
import rehypeParse from "rehype-parse";
import type { Element, ElementContent, Root, RootContent } from "hast";

export interface PageLink {
  href: string; // absolute
  text: string;
  rel: string[]; // e.g. ["nofollow"], ["sponsored"], ["ugc"]
}

export interface PageFacts {
  url: string;
  title: string;
  description: string;
  lang: string | null;
  headings: string[];
  /** Readable text, trimmed to keep prompts small. */
  textExcerpt: string;
  wordCount: number;
  links: PageLink[];
  outboundLinkCount: number;
  internalLinkCount: number;
  emails: string[];
  signals: {
    writeForUs: boolean;
    resourcesPage: boolean;
    contactPage: boolean;
    casinoOrAdultTerms: boolean;
    sponsoredPostTerms: boolean;
  };
}

const SKIP = new Set(["script", "style", "noscript", "svg", "template", "iframe", "head"]);

function text(n: RootContent | ElementContent): string {
  if (n.type === "text") return n.value;
  if (n.type === "element") return SKIP.has(n.tagName) ? "" : n.children.map(text).join(n.tagName === "br" ? " " : "");
  return "";
}

function walk(node: Root | Element, visit: (el: Element) => void) {
  for (const c of node.children) {
    if (c.type === "element") {
      visit(c);
      walk(c, visit);
    }
  }
}

function attr(el: Element, name: string): string | null {
  const v = el.properties?.[name];
  if (Array.isArray(v)) return v.join(" ");
  return v === undefined || v === null ? null : String(v);
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Extracts what the Backlink Agent may use as facts about a page. */
export function parsePage(html: string, pageUrl: string, maxText = 4000): PageFacts {
  const tree = unified().use(rehypeParse).parse(html) as Root;
  const base = new URL(pageUrl);
  let title = "";
  let description = "";
  let lang: string | null = null;
  const headings: string[] = [];
  const links: PageLink[] = [];
  const blocks: string[] = [];

  walk(tree, (el) => {
    const tag = el.tagName;
    if (tag === "html") lang = attr(el, "lang");
    else if (tag === "title" && !title) title = squash(text(el));
    else if (tag === "meta" && (attr(el, "name") ?? "").toLowerCase() === "description") description = squash(attr(el, "content") ?? "");
    else if (/^h[1-3]$/.test(tag)) { const h = squash(text(el)); if (h && headings.length < 30) headings.push(h); }
    else if (tag === "a") {
      const raw = attr(el, "href");
      if (!raw || raw.startsWith("#") || /^(javascript|data):/i.test(raw)) return;
      try {
        const abs = new URL(raw, base);
        if (abs.protocol !== "http:" && abs.protocol !== "https:" && abs.protocol !== "mailto:") return;
        const relValue = el.properties?.rel;
        const rel = (Array.isArray(relValue) ? relValue.map(String) : String(relValue ?? "").split(/\s+/)).map((r) => r.toLowerCase()).filter(Boolean);
        links.push({ href: abs.href, text: squash(text(el)), rel });
      } catch { /* malformed href */ }
    }
    if (["p", "li", "td", "blockquote", "h1", "h2", "h3"].includes(tag)) { const t = squash(text(el)); if (t) blocks.push(t); }
  });

  const body = blocks.join("\n");
  const lower = `${title} ${description} ${body}`.toLowerCase();
  const host = base.hostname.replace(/^www\./, "");
  const web = links.filter((l) => l.href.startsWith("http"));
  const outbound = web.filter((l) => new URL(l.href).hostname.replace(/^www\./, "") !== host);
  const emails = [...new Set([
    ...links.filter((l) => l.href.startsWith("mailto:")).map((l) => l.href.slice(7).split("?")[0]),
    ...(body.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []),
  ])].slice(0, 5);
  const anyLink = (re: RegExp) => links.some((l) => re.test(l.text) || re.test(l.href));

  return {
    url: pageUrl,
    title,
    description,
    lang,
    headings,
    textExcerpt: body.slice(0, maxText),
    wordCount: body.split(/\s+/).filter(Boolean).length,
    links: web.slice(0, 400),
    outboundLinkCount: outbound.length,
    internalLinkCount: web.length - outbound.length,
    emails,
    signals: {
      writeForUs: /write for us|guest post|contribute|submit (an )?article|guest author/.test(lower) || anyLink(/write-for-us|guest-post|contribute/i),
      resourcesPage: /useful (links|resources)|resources for (students|parents|teachers)|recommended (sites|resources)/.test(lower),
      contactPage: anyLink(/contact/i),
      casinoOrAdultTerms: /\b(casino|betting|poker|porn|escort|viagra|loan shark|crypto giveaway)\b/.test(lower),
      sponsoredPostTerms: /\b(sponsored post|paid post|buy (a )?backlink|link insertion|dofollow link for)\b/.test(lower),
    },
  };
}

export interface LinkMatch {
  href: string;
  anchorText: string;
  rel: string[];
  /** False if rel contains nofollow/sponsored/ugc. */
  followed: boolean;
}

/**
 * Links on a page that point at `targetUrl` (same host, www-insensitive).
 * Exact path matches come first; any link to the host counts if `anyPathOnHost`.
 */
export function findLinksTo(links: PageLink[], targetUrl: string, opts: { anyPathOnHost?: boolean } = {}): LinkMatch[] {
  const target = new URL(targetUrl);
  const host = target.hostname.replace(/^www\./, "");
  const path = target.pathname.replace(/\/$/, "") || "/";
  const matches: (LinkMatch & { exact: boolean })[] = [];
  for (const l of links) {
    let u: URL;
    try { u = new URL(l.href); } catch { continue; }
    if (u.hostname.replace(/^www\./, "") !== host) continue;
    const p = u.pathname.replace(/\/$/, "") || "/";
    const exact = p === path;
    if (!exact && !opts.anyPathOnHost) continue;
    matches.push({
      href: l.href, anchorText: l.text, rel: l.rel, exact,
      followed: !l.rel.some((r) => r === "nofollow" || r === "sponsored" || r === "ugc"),
    });
  }
  return matches
    .sort((a, b) => Number(b.exact) - Number(a.exact))
    .map((m) => ({ href: m.href, anchorText: m.anchorText, rel: m.rel, followed: m.followed }));
}
