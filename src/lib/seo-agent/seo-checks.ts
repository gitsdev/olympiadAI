// Deterministic SEO checks (spec §14) and score composition. Pure + client-safe.
//
// The score is OlympiadIQ's internal content-quality score. It is NOT a
// Google ranking score and must always be labelled that way.

import { normalizeKeyword } from "./keywords";
import { extractCtas, extractLinks, htmlToText } from "./article-html";

import { SEO_CATEGORIES, SEO_WEIGHTS, type SeoCategory } from "./seo-categories";

export { SEO_CATEGORIES, SEO_CATEGORY_LABELS, SEO_WEIGHTS, type SeoCategory } from "./seo-categories";

export type CheckStatus = "pass" | "warn" | "fail";

export interface SeoCheck {
  category: SeoCategory;
  status: CheckStatus;
  message: string;
}

export interface SeoCheckInput {
  title: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  excerpt: string;
  html: string;
  primaryKeyword: string;
  featuredImageUrl: string;
  featuredImageAlt: string;
  /** Site paths that exist (to catch broken internal links). */
  knownInternalPaths: Set<string>;
}

const STOP = new Set(["a", "an", "the", "for", "of", "in", "on", "to", "and", "or", "with", "how", "what", "is"]);

/** Exact phrase, else all meaningful words present (e.g. "class 5 maths olympiad" ≈ "maths olympiad class 5"). */
export function keywordMatch(text: string, keyword: string): "exact" | "partial" | "none" {
  const t = normalizeKeyword(text);
  const k = normalizeKeyword(keyword);
  if (!k) return "none";
  if (t.includes(k)) return "exact";
  const words = k.split(" ").filter((w) => !STOP.has(w));
  const tWords = new Set(t.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/));
  return words.length > 0 && words.every((w) => tWords.has(w)) ? "partial" : "none";
}

function countPhrase(text: string, phrase: string): number {
  const t = ` ${normalizeKeyword(text).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ")} `;
  const p = ` ${normalizeKeyword(phrase)} `;
  if (p.trim() === "") return 0;
  let n = 0;
  for (let i = t.indexOf(p); i !== -1; i = t.indexOf(p, i + 1)) n++;
  return n;
}

function headings(html: string): { level: number; text: string }[] {
  return [...html.matchAll(/<h([1-4])>([\s\S]*?)<\/h\1>/g)].map((m) => ({ level: Number(m[1]), text: m[2].replace(/<[^>]+>/g, "") }));
}

function paragraphs(html: string): string[] {
  return [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean);
}

export interface TextStats {
  words: number;
  sentences: number;
  avgSentenceWords: number;
  longParagraphs: number;
  keywordCount: number;
  keywordDensity: number; // occurrences of the full phrase per 100 words
}

export function textStats(html: string, primaryKeyword: string): TextStats {
  const text = htmlToText(html).replace(/\[CTA: \w+\]/g, "");
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentences = Math.max(1, (text.match(/[^.!?\n]+[.!?]+/g) ?? []).length);
  const longParagraphs = paragraphs(html).filter((p) => p.split(/\s+/).length > 120).length;
  const keywordCount = countPhrase(text, primaryKeyword);
  return {
    words,
    sentences,
    avgSentenceWords: Math.round((words / sentences) * 10) / 10,
    longParagraphs,
    keywordCount,
    keywordDensity: words ? Math.round(((keywordCount * normalizeKeyword(primaryKeyword).split(" ").length) / words) * 1000) / 10 : 0,
  };
}

const lenCheck = (category: SeoCategory, label: string, value: string, [min, max]: [number, number], hardMax: number): SeoCheck => {
  const n = value.trim().length;
  if (n === 0) return { category, status: "fail", message: `${label} is missing.` };
  if (n < min) return { category, status: "warn", message: `${label} is short (${n} characters; aim for ${min}–${max}).` };
  if (n > hardMax) return { category, status: "fail", message: `${label} is too long (${n} characters; search results cut it off after about ${max}).` };
  if (n > max) return { category, status: "warn", message: `${label} is slightly long (${n} characters; aim for ${min}–${max}).` };
  return { category, status: "pass", message: `${label} length is good (${n} characters).` };
};

/** Everything that can be measured without judgement. */
export function runDeterministicChecks(a: SeoCheckInput): SeoCheck[] {
  const checks: SeoCheck[] = [];
  const kw = a.primaryKeyword;
  const stats = textStats(a.html, kw);
  const hs = headings(a.html);
  const text = htmlToText(a.html);
  const intro = text.split(/\s+/).slice(0, 100).join(" ");

  // Title
  checks.push(lenCheck("TITLE", "Title", a.title, [20, 65], 80));
  if (keywordMatch(a.title, kw) === "none") checks.push({ category: "TITLE", status: "warn", message: `Title doesn't mention the primary keyword "${kw}".` });

  // Meta title / description
  checks.push(lenCheck("META_TITLE", "Meta title", a.metaTitle, [30, 60], 70));
  if (a.metaTitle && keywordMatch(a.metaTitle, kw) === "none") checks.push({ category: "META_TITLE", status: "warn", message: "Meta title doesn't include the primary keyword." });
  checks.push(lenCheck("META_DESCRIPTION", "Meta description", a.metaDescription, [120, 160], 175));
  if (a.metaDescription && keywordMatch(a.metaDescription, kw) === "none") checks.push({ category: "META_DESCRIPTION", status: "warn", message: "Meta description doesn't mention the primary keyword." });

  // Headings
  const h1s = hs.filter((h) => h.level === 1).length;
  if (h1s > 0) checks.push({ category: "HEADINGS", status: "warn", message: `The body has ${h1s} H1 heading(s). The article title is already the H1, so use H2 for sections.` });
  const h2s = hs.filter((h) => h.level === 2).length;
  if (h2s < 2) checks.push({ category: "HEADINGS", status: h2s === 0 ? "fail" : "warn", message: `Only ${h2s} H2 section heading(s). Break the article into clear sections.` });
  let prev = 1;
  const skipped = hs.find((h) => { const bad = h.level > prev + 1; prev = h.level; return bad; });
  if (skipped) checks.push({ category: "HEADINGS", status: "warn", message: `Heading "${skipped.text}" skips a level (H${skipped.level} without a parent heading).` });
  if (!checks.some((c) => c.category === "HEADINGS")) checks.push({ category: "HEADINGS", status: "pass", message: `${h2s} sections with a clean heading hierarchy.` });

  // Keyword usage
  if (keywordMatch(intro, kw) === "none") checks.push({ category: "KEYWORD_USAGE", status: "warn", message: "The primary keyword doesn't appear in the first 100 words." });
  if (!hs.some((h) => h.level >= 2 && keywordMatch(h.text, kw) !== "none")) checks.push({ category: "KEYWORD_USAGE", status: "warn", message: "No section heading mentions the primary keyword or its words." });
  if (keywordMatch(a.slug.replace(/-/g, " "), kw) === "none") checks.push({ category: "KEYWORD_USAGE", status: "warn", message: "The URL slug doesn't reflect the primary keyword." });
  if (stats.keywordDensity > 3) checks.push({ category: "KEYWORD_USAGE", status: "fail", message: `The exact keyword phrase appears ${stats.keywordCount} times (${stats.keywordDensity}% of words). That reads as keyword stuffing; use natural variations.` });
  if (!checks.some((c) => c.category === "KEYWORD_USAGE")) checks.push({ category: "KEYWORD_USAGE", status: "pass", message: "Keyword appears naturally in the intro, a heading and the URL." });

  // Completeness (length only; the AI judges substance)
  if (stats.words < 600) checks.push({ category: "COMPLETENESS", status: "fail", message: `Only ${stats.words} words. That's thin for a guide; cover the topic properly.` });
  else if (stats.words < 900) checks.push({ category: "COMPLETENESS", status: "warn", message: `${stats.words} words. Check nothing important is missing.` });

  // Readability
  if (stats.avgSentenceWords > 24) checks.push({ category: "READABILITY", status: "warn", message: `Sentences average ${stats.avgSentenceWords} words. Shorter sentences suit young readers.` });
  if (stats.longParagraphs > 0) checks.push({ category: "READABILITY", status: "warn", message: `${stats.longParagraphs} paragraph(s) over 120 words. Split them.` });
  if (!checks.some((c) => c.category === "READABILITY")) checks.push({ category: "READABILITY", status: "pass", message: `Sentences average ${stats.avgSentenceWords} words; paragraphs are short.` });

  // Links
  const links = extractLinks(a.html);
  const internal = links.filter((l) => l.href.startsWith("/"));
  const broken = internal.filter((l) => !a.knownInternalPaths.has(l.href.split("#")[0].split("?")[0]));
  if (broken.length) checks.push({ category: "INTERNAL_LINKING", status: "fail", message: `Link(s) to pages that don't exist: ${broken.map((b) => b.href).join(", ")}.` });
  if (internal.length === 0) checks.push({ category: "INTERNAL_LINKING", status: "fail", message: "No internal links. Link to at least one relevant OlympiadIQ page." });
  else if (internal.length === 1) checks.push({ category: "INTERNAL_LINKING", status: "warn", message: "Only one internal link. Add another relevant one if it genuinely helps." });
  else if (!broken.length) checks.push({ category: "INTERNAL_LINKING", status: "pass", message: `${internal.length} internal links to existing pages.` });

  const external = links.filter((l) => /^https?:\/\//.test(l.href));
  if (external.some((l) => l.href.startsWith("http://"))) checks.push({ category: "EXTERNAL_REFERENCES", status: "warn", message: "An external link uses http://. Prefer https:// sources." });
  if (external.length > 5) checks.push({ category: "EXTERNAL_REFERENCES", status: "warn", message: `${external.length} external links. Keep only official, useful sources.` });
  if (!checks.some((c) => c.category === "EXTERNAL_REFERENCES")) {
    checks.push({ category: "EXTERNAL_REFERENCES", status: "pass", message: external.length ? `${external.length} external reference(s).` : "No external links (fine unless the article states official facts)." });
  }

  // CTA
  const ctas = extractCtas(a.html);
  if (ctas.length === 0) checks.push({ category: "CTA", status: "fail", message: "No CTA block in the article." });
  else if (ctas.length > 2) checks.push({ category: "CTA", status: "warn", message: `${ctas.length} CTA blocks. One or two reads better.` });

  // Overall hygiene
  if (!a.excerpt.trim()) checks.push({ category: "OVERALL_QUALITY", status: "warn", message: "Excerpt is missing (used on blog listing pages)." });
  if (a.featuredImageUrl && !a.featuredImageAlt.trim()) checks.push({ category: "OVERALL_QUALITY", status: "warn", message: "Featured image has no alt text." });
  if (!a.featuredImageUrl) checks.push({ category: "OVERALL_QUALITY", status: "warn", message: "No featured image yet. Social shares and the blog card look better with one." });

  return checks;
}

const STATUS_VALUE: Record<CheckStatus, number> = { pass: 1, warn: 0.6, fail: 0 };

/**
 * Per-category score (0–1): the worst deterministic check in the category,
 * blended with the AI's 0–10 judgement where one exists.
 */
export function categoryScores(checks: SeoCheck[], ai: Partial<Record<SeoCategory, number>>): Record<SeoCategory, number> {
  const out = {} as Record<SeoCategory, number>;
  for (const c of SEO_CATEGORIES) {
    const own = checks.filter((x) => x.category === c);
    const det = own.length ? Math.min(...own.map((x) => STATUS_VALUE[x.status])) : null;
    const judged = ai[c] !== undefined ? Math.max(0, Math.min(10, ai[c]!)) / 10 : null;
    out[c] = det !== null && judged !== null ? det * 0.4 + judged * 0.6 : det ?? judged ?? 1;
  }
  return out;
}

/** Weighted 0–100 internal content-quality score. */
export function overallScore(scores: Record<SeoCategory, number>): number {
  return Math.round(SEO_CATEGORIES.reduce((sum, c) => sum + scores[c] * SEO_WEIGHTS[c], 0));
}

/** Cheap content fingerprint (FNV-1a) so the UI can tell when a check is out of date. */
export function contentFingerprint(...parts: string[]): string {
  let h = 0x811c9dc5;
  for (const ch of parts.join("\u0000")) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Fingerprint of the saved article fields an SEO check depends on (snake_case row shape). */
export function articleFingerprint(a: {
  title: string; slug: string | null; meta_title: string | null; meta_description: string | null; excerpt: string | null;
  content_html: string; featured_image_url: string | null; featured_image_alt: string | null; cta_type: string | null;
}): string {
  return contentFingerprint(a.title, a.slug ?? "", a.meta_title ?? "", a.meta_description ?? "", a.excerpt ?? "",
    a.content_html, a.featured_image_url ?? "", a.featured_image_alt ?? "", a.cta_type ?? "");
}
