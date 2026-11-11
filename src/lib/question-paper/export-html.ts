// Answer sheet → standalone print HTML (A4), rendered to PDF by headless
// Chromium. Maths is typeset server-side with KaTeX; raw HTML in answers is
// never passed through (remark-rehype drops it), and the page runs with
// JavaScript disabled.

import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkHtmlAsText from "./remark-html-as-text";
import { BRAND, DISCLAIMER, type SheetModel, type SheetQuestion } from "./sheet";

const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.min.css";
const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=Hanken+Grotesk:ital,wght@0,400;0,600;0,700;1,400&display=swap";

const LOGO_SVG = `<svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#2B4DD6"/><g stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.55"><line x1="19" y1="45" x2="31.5" y2="33.5"/><line x1="31.5" y1="33.5" x2="45" y2="20"/><line x1="31.5" y1="33.5" x2="43.5" y2="44"/></g><circle cx="19" cy="45" r="5" fill="#fff"/><circle cx="31.5" cy="33.5" r="5" fill="#fff"/><circle cx="43.5" cy="44" r="4.2" fill="#fff" fill-opacity="0.78"/><circle cx="45" cy="20" r="6" fill="#EFB141"/></svg>`;

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkHtmlAsText) // raw HTML is shown as text, never rendered
  .use(remarkRehype)
  // rehype-katex never throws on bad LaTeX; it renders the source in red.
  .use(rehypeKatex, { strict: "ignore" })
  .use(rehypeStringify);

export function mdToHtml(md: string | null | undefined): string {
  if (!md?.trim()) return "";
  return String(processor.processSync(md));
}

/** Inline Markdown without the wrapping <p>. */
function mdInline(md: string): string {
  return mdToHtml(md).replace(/^<p>([\s\S]*)<\/p>\s*$/, "$1");
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function questionHtml(q: SheetQuestion): string {
  const meta = `${esc(q.typeLabel)}${q.marks !== null ? ` · ${q.marks} mark${q.marks === 1 ? "" : "s"}` : ""}`;
  const options = q.options.length
    ? `<ol class="opts">${q.options.map((o) => `<li class="${o.correct ? "correct" : ""}"><span class="ol">(${esc(o.label)})</span> ${mdInline(o.text)}${o.correct ? ' <span class="tick">✓</span>' : ""}</li>`).join("")}</ol>`
    : "";
  const match = q.match
    ? `<table class="grid"><thead><tr><th>Column A</th><th>Column B</th></tr></thead><tbody>${Array.from({ length: Math.max(q.match.left.length, q.match.right.length) }, (_, i) =>
        `<tr><td>${q.match!.left[i] ? `${i + 1}. ${mdInline(q.match!.left[i])}` : ""}</td><td>${q.match!.right[i] ? `${String.fromCharCode(97 + i)}. ${mdInline(q.match!.right[i])}` : ""}</td></tr>`).join("")}</tbody></table>`
    : "";

  const answer = q.status === "answered"
    ? `${q.correctOption ? `<p class="lbl">Correct option: <strong class="opt-badge">${esc(q.correctOption)}</strong></p>` : ""}
       <div class="answer"><p class="lbl">Answer</p>${mdToHtml(q.answerMd)}</div>
       ${q.explanationMd?.trim() ? `<div class="explain"><p class="lbl">Explanation</p>${mdToHtml(q.explanationMd)}</div>` : ""}
       ${q.finalAnswer ? `<div class="final"><span>Final answer</span> ${mdInline(q.finalAnswer)}</div>` : ""}`
    : `<div class="answer missing"><p class="lbl">Answer</p><p>${q.status === "cannot_answer" ? "Not answered. This question needs to be checked manually." : "Not generated. Please regenerate or answer manually."}</p>${mdToHtml(q.answerMd)}</div>`;

  return `<article class="q">
    <header class="qh"><h3>${esc(q.heading)}.</h3><span class="qmeta">${meta}</span></header>
    ${q.contextMd ? `<div class="context">${mdToHtml(q.contextMd)}</div>` : ""}
    <div class="qtext">${mdToHtml(q.questionMd)}</div>
    ${options}${match}
    ${q.diagramNote ? `<p class="figure"><strong>Figure:</strong> ${esc(q.diagramNote)}</p>` : ""}
    ${answer}
    ${q.needsReview ? `<div class="review"><strong>⚑ Needs review:</strong> ${esc(q.reviewReason ?? "Please check this answer.")}</div>` : ""}
  </article>`;
}

export function renderSheetHtml(sheet: SheetModel): string {
  const metaRows = [...sheet.meta, { label: "Generated on", value: sheet.generatedOn }]
    .map((m) => `<div class="mi"><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join("");

  const body = sheet.sections.map((s) => `
    <section>
      ${s.title ? `<h2 class="section">${esc(s.title)}</h2>` : ""}
      ${s.questions.map(questionHtml).join("\n")}
    </section>`).join("\n");

  const key = sheet.answerKey.map((k) => `<tr class="${k.flagged ? "flag" : ""}"><td class="kq">${esc(k.label)}</td><td>${mdInline(k.answer)}</td><td>${k.flagged ? "⚑ Check" : ""}</td></tr>`).join("");
  const flagged = sheet.flagged.length
    ? `<ul class="flags">${sheet.flagged.map((f) => `<li><strong>${esc(f.label)}:</strong> ${esc(f.reason)}</li>`).join("")}</ul>`
    : `<p>None. Every question was read and answered with confidence.</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(sheet.title)} – ${esc(sheet.fileName)}</title>
<link rel="stylesheet" href="${KATEX_CSS}">
<link rel="stylesheet" href="${FONTS_CSS}">
<style>
  @page { size: A4; margin: 22mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Hanken Grotesk', 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; line-height: 1.55; color: ${BRAND.ink}; margin: 0; }
  h1, h2, h3 { font-family: 'Bricolage Grotesque', 'Hanken Grotesk', sans-serif; letter-spacing: -0.01em; }
  .cover { border: 1px solid ${BRAND.line}; border-radius: 12px; padding: 18px 20px; margin-bottom: 18px; background: linear-gradient(180deg, ${BRAND.blueTint}, #fff 70%); }
  .brand { display: flex; align-items: center; gap: 8px; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 15pt; }
  .brand b { color: ${BRAND.blue}; }
  .cover h1 { font-size: 22pt; margin: 12px 0 2px; }
  .file { color: ${BRAND.inkSoft}; margin: 0 0 12px; font-size: 9.5pt; word-break: break-all; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .mi { background: #fff; border: 1px solid ${BRAND.line}; border-radius: 8px; padding: 6px 10px; }
  .mi span { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: ${BRAND.inkSoft}; }
  .mi strong { font-size: 10pt; }
  .stats { margin: 10px 0 0; font-size: 9.5pt; color: ${BRAND.inkSoft}; }
  h2.section { font-size: 14pt; color: ${BRAND.blueDark}; border-bottom: 2px solid ${BRAND.blue}; padding-bottom: 4px; margin: 22px 0 10px; break-after: avoid; }
  .q { padding: 10px 0 12px; border-bottom: 1px solid ${BRAND.line}; break-inside: avoid; }
  .q:last-child { border-bottom: 0; }
  .qh { display: flex; align-items: baseline; gap: 10px; break-after: avoid; }
  .qh h3 { font-size: 11.5pt; margin: 0; }
  .qmeta { font-size: 8.5pt; color: ${BRAND.inkSoft}; }
  .context { border-left: 3px solid ${BRAND.line}; padding: 2px 0 2px 10px; color: ${BRAND.inkSoft}; margin: 6px 0; }
  .qtext p { margin: 4px 0; }
  .opts { list-style: none; padding: 0; margin: 4px 0 4px 14px; }
  .opts li { margin: 2px 0; }
  .opts .ol { font-weight: 600; }
  .opts li.correct { color: ${BRAND.green}; font-weight: 700; }
  .tick { color: ${BRAND.green}; }
  .figure { font-style: italic; color: ${BRAND.inkSoft}; font-size: 9.5pt; }
  .lbl { font-weight: 700; color: ${BRAND.blue}; margin: 8px 0 2px; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.05em; }
  .opt-badge { display: inline-block; background: ${BRAND.blue}; color: #fff; border-radius: 4px; padding: 0 7px; text-transform: none; letter-spacing: 0; }
  .answer p, .explain p { margin: 3px 0; }
  .answer h3, .explain h3 { font-size: 10.5pt; margin: 8px 0 2px; }
  .answer ol, .answer ul, .explain ol, .explain ul { margin: 3px 0; padding-left: 20px; }
  .missing { color: ${BRAND.warnText}; }
  .final { background: ${BRAND.blueTint}; border-left: 4px solid ${BRAND.blue}; padding: 6px 10px; margin: 8px 0 2px; font-weight: 700; border-radius: 0 6px 6px 0; }
  .final span { color: ${BRAND.blueDark}; text-transform: uppercase; font-size: 8.5pt; letter-spacing: 0.06em; margin-right: 6px; }
  .review { background: ${BRAND.warnBg}; color: ${BRAND.warnText}; padding: 6px 10px; border-radius: 6px; margin-top: 8px; font-size: 9.5pt; }
  table.grid, table.key { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 9.5pt; }
  table.grid th, table.grid td, table.key th, table.key td { border: 1px solid ${BRAND.line}; padding: 4px 8px; text-align: left; vertical-align: top; }
  table.grid th, table.key th { background: ${BRAND.blueTint}; }
  table.key tr { break-inside: avoid; }
  table.key tr.flag td:last-child { background: ${BRAND.warnBg}; color: ${BRAND.warnText}; font-weight: 700; }
  .kq { font-weight: 700; white-space: nowrap; }
  .summary { break-before: page; }
  .summary h2 { font-size: 15pt; color: ${BRAND.blueDark}; }
  .flags li { margin: 3px 0; }
  .disclaimer { margin-top: 18px; font-size: 8.5pt; color: ${BRAND.inkSoft}; font-style: italic; }
  .katex { font-size: 1.05em; }
  .katex-display { margin: 6px 0; overflow: hidden; }
  table:not(.key):not(.grid) { border-collapse: collapse; margin: 6px 0; }
  table:not(.key):not(.grid) td, table:not(.key):not(.grid) th { border: 1px solid ${BRAND.line}; padding: 3px 8px; }
</style></head>
<body>
  <div class="cover">
    <div class="brand">${LOGO_SVG}<span>Olympiad<b>IQ</b></span></div>
    <h1>${esc(sheet.title)}</h1>
    <p class="file">${esc(sheet.fileName)}</p>
    <div class="meta">${metaRows}</div>
    <p class="stats">${sheet.stats.total} questions · ${sheet.stats.answered} answered · ${sheet.stats.flagged} flagged for review</p>
  </div>
  ${body}
  <div class="summary">
    <h2>Quick Answer Key</h2>
    <table class="key"><thead><tr><th>Question</th><th>Answer</th><th>Review</th></tr></thead><tbody>${key}</tbody></table>
    <h2>Questions Flagged for Manual Review</h2>
    ${flagged}
    <p class="disclaimer">${esc(DISCLAIMER)}</p>
  </div>
</body></html>`;
}

/** Header/footer templates for Chromium's PDF printer (they can't load external CSS). */
export function pdfHeaderFooter(title: string) {
  const base = `font-family: Arial, sans-serif; font-size: 8px; color: ${BRAND.inkSoft}; width: 100%;`;
  return {
    headerTemplate: `<div style="${base} display:flex; justify-content:space-between; border-bottom: 0.5px solid ${BRAND.line}; padding-bottom: 4px; margin: 0 16mm;"><span><b style="color:${BRAND.ink}">Olympiad</b><b style="color:${BRAND.blue}">IQ</b></span><span>${esc(title)}</span></div>`,
    footerTemplate: `<div style="${base} text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
  };
}
