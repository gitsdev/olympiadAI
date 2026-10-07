// Article HTML pipeline (spec §34: sanitize AI HTML before rendering or
// publishing). Every path into seo_articles.content_html goes through
// sanitizeArticleHtml() or markdownToArticleHtml(), which share one
// allowlist schema. Pure; safe to use in tests and on the server.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { CTA_TYPES, type CtaType } from "./constants";

/** Marker the Content Writer puts on its own line where the CTA block goes. */
export const CTA_PLACEHOLDER = "[[CTA]]";

const SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  // Only tags the editor can produce and the blog can render.
  tagNames: [
    "p", "h1", "h2", "h3", "h4", "strong", "em", "u", "s", "code", "pre", "br",
    "ul", "ol", "li", "a", "img", "blockquote", "hr",
    "table", "thead", "tbody", "tr", "th", "td", "div",
  ],
  attributes: {
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    th: ["colSpan", "rowSpan"],
    td: ["colSpan", "rowSpan"],
    // The only div allowed is a CTA block (filtered further below).
    div: ["dataCta"],
  },
  protocols: { href: ["http", "https", "mailto"], src: ["https"] },
  clobberPrefix: "",
  clobber: [],
  strip: ["script", "style"],
};

type Parent = Root | Element;

/** Children of `node` that are elements, for safe recursion. */
function walk(node: Parent, visit: (el: Element, parent: Parent, index: number) => void) {
  // Iterate backwards so visitors may replace/remove the current child.
  for (let i = node.children.length - 1; i >= 0; i--) {
    const child = node.children[i];
    if (child.type === "element") {
      walk(child, visit);
      visit(child, node, i);
    }
  }
}

function textOf(node: ElementContent | RootContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

function ctaElement(type: CtaType): Element {
  return { type: "element", tagName: "div", properties: { dataCta: type }, children: [] };
}

/** Turns a paragraph containing only [[CTA]] into a CTA block. */
function ctaPlaceholders(ctaType: CtaType | null, found: { count: number }) {
  return () => (tree: Root) => {
    walk(tree, (el, parent, i) => {
      if (el.tagName === "p" && textOf(el).trim() === CTA_PLACEHOLDER) {
        found.count++;
        if (ctaType && found.count === 1) parent.children[i] = ctaElement(ctaType);
        else parent.children.splice(i, 1); // extra or untyped markers are dropped
      }
    });
  };
}

/** Removes any div that isn't an empty CTA block with a known type. */
function ctaBlocksOnly() {
  return (tree: Root) => {
    walk(tree, (el, parent, i) => {
      if (el.tagName !== "div") return;
      const type = el.properties?.dataCta;
      if (typeof type === "string" && (CTA_TYPES as readonly string[]).includes(type)) {
        el.children = [];
        el.properties = { dataCta: type };
      } else {
        parent.children.splice(i, 1, ...el.children); // unwrap
      }
    });
  };
}

export interface LinkPolicy {
  /** Site-relative paths the article may link to. */
  allowedInternal: Set<string>;
}

export interface LinkReport {
  removedInternal: string[];
  external: string[];
}

/** Unwraps internal links not in the allowlist; records external ones for review. */
function enforceLinks(policy: LinkPolicy, report: LinkReport) {
  return () => (tree: Root) => {
    walk(tree, (el, parent, i) => {
      if (el.tagName !== "a") return;
      const href = String(el.properties?.href ?? "");
      const internal = href.replace(/^https?:\/\/(www\.)?olympiadiq\.in/i, "") || "/";
      if (internal.startsWith("/")) {
        const path = internal.split("#")[0].split("?")[0];
        if (policy.allowedInternal.has(path)) {
          el.properties = { ...el.properties, href: internal };
        } else {
          report.removedInternal.push(href);
          parent.children.splice(i, 1, ...el.children);
        }
      } else if (/^https?:\/\//i.test(href)) {
        report.external.push(href);
      }
    });
  };
}

/** Sanitizes HTML from the editor (or anywhere else) before it's stored. */
export function sanitizeArticleHtml(html: string): string {
  return String(
    unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeSanitize, SCHEMA)
      .use(ctaBlocksOnly)
      .use(rehypeStringify)
      .processSync(html),
  ).trim();
}

export interface MarkdownConversion {
  html: string;
  ctaPlaced: boolean;
  links: LinkReport;
}

/**
 * Converts the writer's Markdown to sanitized article HTML: [[CTA]] becomes a
 * CTA block, internal links outside the policy are unwrapped. Raw HTML in
 * the Markdown is not interpreted (remark-rehype drops it).
 */
export function markdownToArticleHtml(markdown: string, ctaType: CtaType | null, policy: LinkPolicy): MarkdownConversion {
  const found = { count: 0 };
  const links: LinkReport = { removedInternal: [], external: [] };
  const html = String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(ctaPlaceholders(ctaType, found))
      .use(enforceLinks(policy, links))
      .use(rehypeSanitize, SCHEMA)
      .use(ctaBlocksOnly)
      .use(rehypeStringify)
      .processSync(markdown),
  ).trim();
  return { html, ctaPlaced: found.count > 0 && ctaType !== null, links };
}

export function ctaBlockHtml(type: CtaType): string {
  return `<div data-cta="${type}"></div>`;
}

function parse(html: string): Root {
  return unified().use(rehypeParse, { fragment: true }).parse(html);
}

/** Plain text with block boundaries as newlines (for word counts and diffs). */
export function htmlToText(html: string): string {
  const BLOCK = new Set(["p", "h1", "h2", "h3", "h4", "li", "tr", "blockquote", "pre", "div", "hr", "table"]);
  const out: string[] = [];
  const visit = (n: RootContent | ElementContent) => {
    if (n.type === "text") out.push((n as Text).value);
    else if (n.type === "element") {
      if (n.tagName === "br") out.push("\n");
      if (n.tagName === "td" || n.tagName === "th") out.push(" ");
      if (n.tagName === "div" && n.properties?.dataCta) out.push(`[CTA: ${String(n.properties.dataCta)}]`);
      n.children.forEach(visit);
      if (BLOCK.has(n.tagName)) out.push("\n");
    }
  };
  parse(html).children.forEach(visit);
  return out.join("").replace(/[ \t]+/g, " ").split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}

export function wordCount(html: string): number {
  const t = htmlToText(html).replace(/\[CTA: \w+\]/g, "");
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
}

/** Every link in the article: href + anchor text. */
export function extractLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  const root = parse(html);
  walk(root, (el) => {
    if (el.tagName === "a" && el.properties?.href) links.push({ href: String(el.properties.href), text: textOf(el).trim() });
  });
  return links.reverse(); // walk() visits backwards
}

/** CTA types used in the article, in document order. */
export function extractCtas(html: string): CtaType[] {
  const found: CtaType[] = [];
  walk(parse(html), (el) => {
    const t = el.tagName === "div" ? el.properties?.dataCta : undefined;
    if (typeof t === "string" && (CTA_TYPES as readonly string[]).includes(t)) found.push(t as CtaType);
  });
  return found.reverse();
}

/**
 * Markdown-like text for AI review: keeps headings (##), list items (-),
 * table rows (| a | b |), links ([text](url)) and CTA markers, so the
 * reviewer sees structure and link targets instead of flattened text.
 */
export function htmlToReviewMarkdown(html: string): string {
  const out: string[] = [];
  const inline = (n: RootContent | ElementContent): string => {
    if (n.type === "text") return (n as Text).value;
    if (n.type !== "element") return "";
    const inner = n.children.map(inline).join("");
    if (n.tagName === "a") return `[${inner}](${String(n.properties?.href ?? "")})`;
    if (n.tagName === "strong") return `**${inner}**`;
    if (n.tagName === "em") return `*${inner}*`;
    if (n.tagName === "br") return " ";
    if (n.tagName === "img") return `![${String(n.properties?.alt ?? "")}]`;
    return inner;
  };
  const isList = (c: ElementContent) => c.type === "element" && (c.tagName === "ul" || c.tagName === "ol");
  const block = (n: RootContent | ElementContent, listDepth = 0) => {
    if (n.type !== "element") {
      const t = inline(n).trim();
      if (t) out.push(t);
      return;
    }
    const tag = n.tagName;
    if (/^h[1-4]$/.test(tag)) out.push(`${"#".repeat(Number(tag[1]))} ${inline(n).trim()}`);
    else if (tag === "p") out.push(inline(n).trim());
    else if (tag === "ul" || tag === "ol") {
      let i = 0;
      for (const li of n.children) {
        if (li.type !== "element" || li.tagName !== "li") continue;
        i++;
        const text = li.children.filter((c) => !isList(c)).map(inline).join(" ").trim();
        out.push(`${"  ".repeat(listDepth)}${tag === "ol" ? `${i}.` : "-"} ${text}`);
        for (const c of li.children) if (isList(c)) block(c, listDepth + 1);
      }
    } else if (tag === "table") {
      const rows: Element[] = [];
      const collect = (e: Element) => {
        for (const c of e.children) {
          if (c.type !== "element") continue;
          if (c.tagName === "tr") rows.push(c);
          else collect(c);
        }
      };
      collect(n);
      for (const r of rows) {
        const cells = r.children.filter((c): c is Element => c.type === "element").map((c) => inline(c).trim());
        out.push(`| ${cells.join(" | ")} |`);
      }
    } else if (tag === "blockquote") out.push(`> ${inline(n).trim()}`);
    else if (tag === "hr") out.push("---");
    else if (tag === "div" && n.properties?.dataCta) out.push(`[CTA block: ${String(n.properties.dataCta)}]`);
    else for (const c of n.children) block(c, listDepth);
  };
  for (const c of parse(html).children) block(c);
  return out.filter(Boolean).join("\n");
}
