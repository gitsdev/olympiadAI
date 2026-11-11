// LIVE end-to-end test of the AI pipeline (extraction → coverage check →
// solving → export) against the real Claude API, on realistic generated
// question papers. Costs real API credit, so it only runs with QPS_LIVE=1:
//
//   QPS_LIVE=1 QPS_OUT=<dir> npx vitest run tests/question-paper/live.test.ts
//
// Results (answer sheets as PDF/DOCX + a JSON summary) go to QPS_OUT.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import katex from "katex";
import puppeteer, { type Browser } from "puppeteer-core";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Document, ImageRun, Math as DocxMath, MathFraction, MathRun, MathSuperScript, Packer, Paragraph, TextRun } from "docx";

import type { ContentPart } from "@/lib/question-paper/ai";
import { convertDocx } from "@/lib/question-paper/docx";
import { mergeChunks, type QuestionRow, type StoredChunk } from "@/lib/question-paper/extract";
import { renderDocx } from "@/lib/question-paper/export-docx";
import { renderPdf } from "@/lib/question-paper/export-pdf";
import { inspectPdf, planChunks } from "@/lib/question-paper/pdf";
import { docxContent, extractQuestions, imageParts, pdfChunkContent, pdfSourceParts, solveBatch } from "@/lib/question-paper/pipeline";
import type { SolveContext } from "@/lib/question-paper/prompts";
import { buildSheet } from "@/lib/question-paper/sheet";
import { answerUpdate } from "@/lib/question-paper/worker";
import type { PublicJob, PublicQuestion } from "@/lib/question-paper/types";

const LIVE = process.env.QPS_LIVE === "1";
const OUT = process.env.QPS_OUT || join(process.cwd(), "test-results", "question-paper-live");

// Load ANTHROPIC_API_KEY from .env.local without printing it.
if (LIVE && !process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) {
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith("ANTHROPIC_API_KEY="));
  if (line) process.env.ANTHROPIC_API_KEY = line.slice("ANTHROPIC_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
}

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"].find((p) => existsSync(p));
let browser: Browser;
const summary: Record<string, unknown> = {};
let tokens = { input: 0, output: 0 };

/* ── Fixture builders ─────────────────────────────────────────────────── */

const tex = (s: string) => katex.renderToString(s, { throwOnError: false });
const TRIANGLE = `<svg width="220" height="150" viewBox="0 0 220 150"><polygon points="20,130 200,130 20,20" fill="none" stroke="#000" stroke-width="2"/><text x="100" y="146" font-size="14">10 cm</text><text x="0" y="80" font-size="14">6 cm</text><rect x="20" y="118" width="12" height="12" fill="none" stroke="#000"/><text x="8" y="16" font-size="13">A</text><text x="6" y="144" font-size="13">B</text><text x="203" y="144" font-size="13">C</text></svg>`;
const CIRCUIT = `<svg width="260" height="140" viewBox="0 0 260 140"><rect x="20" y="20" width="220" height="100" fill="none" stroke="#000" stroke-width="2"/><line x1="60" y1="10" x2="60" y2="30" stroke="#000" stroke-width="3"/><line x1="70" y1="14" x2="70" y2="26" stroke="#000" stroke-width="3"/><text x="45" y="50" font-size="13">6 V</text><rect x="120" y="110" width="40" height="20" fill="#fff" stroke="#000" stroke-width="2"/><text x="122" y="100" font-size="13">R = 3 Ω</text></svg>`;

function page(body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.min.css">
  <style>body{font-family:"Times New Roman",serif;font-size:15px;margin:40px 50px;line-height:1.5} h1{font-size:20px;text-align:center;margin:0} h2{font-size:16px;margin:18px 0 6px;border-bottom:1px solid #000} .q{margin:10px 0} .opts{margin-left:24px} .sub{text-align:center;margin:2px 0 12px}</style></head><body>${body}</body></html>`;
}

async function htmlToPdf(html: string): Promise<Uint8Array> {
  const p = await browser.newPage();
  await p.setContent(html, { waitUntil: "load" });
  await p.waitForNetworkIdle({ idleTime: 300, timeout: 15_000 }).catch(() => undefined);
  const pdf = await p.pdf({ format: "A4", printBackground: true });
  await p.close();
  return new Uint8Array(pdf);
}

/** Renders HTML to an image and wraps it in a PDF with no text layer (a "scan"). */
async function htmlToScannedPdf(html: string): Promise<Uint8Array> {
  const p = await browser.newPage();
  await p.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.5 });
  await p.setContent(html, { waitUntil: "load" });
  await p.waitForNetworkIdle({ idleTime: 300, timeout: 15_000 }).catch(() => undefined);
  // Slight grey tint + rotation, like a phone scan.
  await p.addStyleTag({ content: "html{background:#f1efe9;filter:contrast(0.92)} body{transform:rotate(-0.6deg)}" });
  const png = await p.screenshot({ type: "png", fullPage: false });
  await p.close();
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(png);
  const pg = doc.addPage([595, 842]);
  pg.drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  return doc.save();
}

async function svgToPng(svg: string): Promise<Uint8Array> {
  const p = await browser.newPage();
  await p.setViewport({ width: 240, height: 170 });
  await p.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
  const png = await p.screenshot({ type: "png" });
  await p.close();
  return new Uint8Array(png);
}

/* ── Pipeline runner (same functions the worker uses) ─────────────────── */

interface RunResult { rows: QuestionRow[]; answered: PublicQuestion[]; pageCount: number | null; isScanned: boolean | null }

async function runPdf(name: string, bytes: Uint8Array, ctx: SolveContext, solve = true): Promise<RunResult> {
  const info = await inspectPdf(bytes);
  const ranges = planChunks(info.pageCount);
  const chunks: StoredChunk[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const [from, to] = ranges[i];
    const content = await pdfChunkContent(bytes, { from, to, pageCount: info.pageCount, chunkIndex: i, chunkCount: ranges.length, fileName: `${name}.pdf` });
    const { data, usage } = await extractQuestions(content);
    tokens = { input: tokens.input + usage.inputTokens, output: tokens.output + usage.outputTokens };
    chunks.push({ pageOffset: from, result: data });
  }
  const rows = mergeChunks(chunks);
  const answered = solve ? await solveAll(rows, ctx, (pages) => pdfSourceParts(bytes, pages)) : [];
  return { rows, answered, pageCount: info.pageCount, isScanned: info.isScanned };
}

async function runDocx(bytes: Uint8Array, ctx: SolveContext): Promise<RunResult> {
  const content = await convertDocx(bytes);
  const images = content.images.filter((i) => i.supported);
  const { data, usage } = await extractQuestions(docxContent(content.markdown, images));
  tokens = { input: tokens.input + usage.inputTokens, output: tokens.output + usage.outputTokens };
  const rows = mergeChunks([{ pageOffset: 1, result: data }], content.images.filter((i) => !i.supported).map((i) => i.id));
  const answered = await solveAll(rows, ctx, async (_pages, refs) => imageParts(images.filter((i) => refs.includes(i.id))));
  return { rows, answered, pageCount: null, isScanned: null };
}

async function solveAll(rows: QuestionRow[], ctx: SolveContext, sources: (pages: number[], imageRefs: string[]) => Promise<ContentPart[]>): Promise<PublicQuestion[]> {
  const qs = rows.map((r, i) => ({ ...r, id: `q${i}` }));
  const out = new Map<string, Partial<PublicQuestion>>();
  const pending = qs.filter((q) => q.answer_status === "pending");
  for (let i = 0; i < pending.length; i += 6) {
    const batch = pending.slice(i, i + 6);
    const src = await sources([...new Set(batch.flatMap((b) => b.source_pages))], [...new Set(batch.flatMap((b) => b.image_refs))]);
    const res = await solveBatch(ctx, batch, src);
    tokens = { input: tokens.input + res.usage.inputTokens, output: tokens.output + res.usage.outputTokens };
    for (const q of batch) {
      const a = res.matched.get(q.id);
      if (a) out.set(q.id, answerUpdate(a, q) as Partial<PublicQuestion>);
    }
  }
  return qs.map((q) => ({
    ...q, ...(out.get(q.id) ?? {}),
    answer_status: (out.get(q.id)?.answer_status ?? (q.answer_status === "pending" ? "failed" : q.answer_status)),
    edited_by_user: false, regen_count: 0, updated_at: "",
  }) as unknown as PublicQuestion);
}

async function save(name: string, ctx: SolveContext, r: RunResult) {
  const job = { id: name, file_name: `${name}`, file_ext: "pdf", class_level: ctx.classLevel, board: ctx.board, subject: ctx.subject, exam_type: ctx.examType, detail_level: ctx.detailLevel, total_questions: r.rows.length } as unknown as PublicJob;
  if (r.answered.length) {
    const sheet = buildSheet(job, r.answered, new Date());
    writeFileSync(join(OUT, `${name}-answers.pdf`), await renderPdf(sheet));
    writeFileSync(join(OUT, `${name}-answers.docx`), await renderDocx(sheet));
  }
  summary[name] = {
    pages: r.pageCount, scanned: r.isScanned,
    questions: (r.answered.length ? r.answered : r.rows).map((q) => ({
      label: q.number_label, section: q.section, type: q.type, review: q.needs_review ? q.review_reason : null,
      status: q.answer_status, short: (q as PublicQuestion).answer_short ?? null, option: (q as PublicQuestion).correct_option ?? null,
      final: (q as PublicQuestion).final_answer ?? null,
    })),
  };
  writeFileSync(join(OUT, "summary.json"), JSON.stringify({ tokens, ...summary }, null, 2));
}

const labels = (r: RunResult) => r.rows.map((q) => q.number_label.replace(/^Q\.?\s*/i, "").replace(/\.$/, ""));
const find = (r: RunResult, label: string) => r.answered.find((q) => q.number_label.replace(/^Q\.?\s*/i, "").replace(/\.$/, "") === label);
const text = (q: PublicQuestion | undefined) => `${q?.answer_short ?? ""} ${q?.final_answer ?? ""} ${q?.answer_md ?? ""} ${q?.correct_option ?? ""}`;

/* ── Tests ────────────────────────────────────────────────────────────── */

describe.skipIf(!LIVE || !CHROME)("LIVE: AI question paper pipeline", () => {
  beforeAll(async () => {
    mkdirSync(OUT, { recursive: true });
    browser = await puppeteer.launch({ executablePath: CHROME!, headless: true, args: ["--no-sandbox"] });
  }, 60_000);
  afterAll(async () => {
    await browser?.close();
    writeFileSync(join(OUT, "summary.json"), JSON.stringify({ tokens, ...summary }, null, 2));
  });

  it("1+4+7. text PDF maths paper: equations, MCQs, two sections, a diagram", async () => {
    const html = page(`<h1>Half-Yearly Examination 2026</h1><p class="sub">Class 7 · Mathematics · CBSE · Max. Marks 20</p>
      <h2>Section A — Multiple Choice (1 mark each)</h2>
      <div class="q">1. The value of ${tex("\\frac{3}{4} + \\frac{1}{4}")} is<div class="opts">(a) ${tex("\\frac{1}{2}")} &nbsp; (b) 1 &nbsp; (c) 2 &nbsp; (d) ${tex("\\frac{3}{16}")}</div></div>
      <div class="q">2. ${tex("2^5")} equals<div class="opts">(a) 10 &nbsp; (b) 25 &nbsp; (c) 32 &nbsp; (d) 52</div></div>
      <div class="q">3. Fill in the blank: ${tex("7 \\times 8 = \\_\\_\\_\\_")}</div>
      <h2>Section B — Short Answer (3 marks each)</h2>
      <div class="q">4. Solve for ${tex("x")}: ${tex("3x - 5 = 16")}</div>
      <div class="q">5. Find the positive value of ${tex("x")} if ${tex("x^{2} = 49")}.</div>
      <div class="q">6. In the figure, triangle ABC is right-angled at B. Find its area.<br>${TRIANGLE}</div>`);
    const ctx: SolveContext = { classLevel: 7, board: "CBSE", subject: "Mathematics", examType: "school_exam", detailLevel: "step_by_step" };
    const r = await runPdf("1-maths-text", await htmlToPdf(html), ctx);
    await save("1-maths-text", ctx, r);
    expect(labels(r)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(new Set(r.rows.map((q) => q.section)).size).toBe(2);
    expect(find(r, "1")?.correct_option?.toLowerCase()).toContain("b");
    expect(find(r, "2")?.correct_option?.toLowerCase()).toContain("c");
    expect(text(find(r, "3"))).toContain("56");
    expect(text(find(r, "4"))).toMatch(/x\s*=\s*7/);
    expect(text(find(r, "5"))).toMatch(/7/);
    expect(text(find(r, "6"))).toMatch(/30/);
    expect(r.answered.every((q) => q.answer_status === "answered")).toBe(true);
  }, 600_000);

  it("2+5. scanned science paper with a circuit diagram (OCR + vision)", async () => {
    const html = page(`<h1>Unit Test — Science</h1><p class="sub">Class 9 · ICSE</p>
      <div class="q">Q1. State Ohm's law.</div>
      <div class="q">Q2. In the circuit shown, a 6 V battery is connected to a resistor. Calculate the current flowing through the resistor.<br>${CIRCUIT}</div>
      <div class="q">Q3. Name the gas released when zinc reacts with dilute hydrochloric acid.</div>
      <div class="q">Q4. Which part of the cell is called its powerhouse?</div>`);
    const ctx: SolveContext = { classLevel: 9, board: "ICSE", subject: "Science", examType: "school_exam", detailLevel: "detailed" };
    const r = await runPdf("2-science-scanned", await htmlToScannedPdf(html), ctx);
    await save("2-science-scanned", ctx, r);
    expect(r.isScanned).toBe(true);
    expect(labels(r)).toEqual(["1", "2", "3", "4"]);
    expect(text(find(r, "2"))).toMatch(/2\s*A|2 ampere/i);
    expect(text(find(r, "3")).toLowerCase()).toContain("hydrogen");
    expect(text(find(r, "4")).toLowerCase()).toContain("mitochondri");
  }, 600_000);

  it("3. DOCX paper with Word equations, a figure, MCQ and match-the-following", async () => {
    const tri = await svgToPng(TRIANGLE);
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ children: [new TextRun({ text: "Class 6 Mathematics — Practice Test", bold: true })] }),
      new Paragraph({ children: [new TextRun("1. Simplify: "), new DocxMath({ children: [new MathFraction({ numerator: [new MathRun("2")], denominator: [new MathRun("5")] }), new MathRun("+"), new MathFraction({ numerator: [new MathRun("1")], denominator: [new MathRun("5")] })] })] }),
      new Paragraph({ children: [new TextRun("2. Evaluate "), new DocxMath({ children: [new MathSuperScript({ children: [new MathRun("3")], superScript: [new MathRun("3")] })] })] }),
      new Paragraph({ children: [new TextRun("3. Which of these is a prime number?  (a) 21  (b) 27  (c) 29  (d) 33")] }),
      new Paragraph({ children: [new TextRun("4. Match the following:")] }),
      new Paragraph({ children: [new TextRun("Column A: (i) Triangle  (ii) Square  (iii) Pentagon")] }),
      new Paragraph({ children: [new TextRun("Column B: (p) 5 sides  (q) 3 sides  (r) 4 sides")] }),
      new Paragraph({ children: [new TextRun("5. Find the area of triangle ABC shown below (right angle at B).")] }),
      new Paragraph({ children: [new ImageRun({ type: "png", data: tri, transformation: { width: 220, height: 150 } })] }),
    ] }] });
    const ctx: SolveContext = { classLevel: 6, board: "CBSE", subject: "Mathematics", examType: "practice_test", detailLevel: "detailed" };
    const r = await runDocx(new Uint8Array(await Packer.toBuffer(doc)), ctx);
    await save("3-docx", ctx, r);
    expect(labels(r)).toEqual(["1", "2", "3", "4", "5"]);
    expect(text(find(r, "1"))).toMatch(/3\s*\/\s*5|\\frac\{3\}\{5\}/);
    expect(text(find(r, "2"))).toContain("27");
    expect(find(r, "3")?.correct_option?.toLowerCase()).toContain("c");
    expect(text(find(r, "4")).toLowerCase()).toMatch(/q/);
    expect(text(find(r, "5"))).toMatch(/30/);
  }, 600_000);

  it("6. Olympiad MCQ paper (reasoning)", async () => {
    const html = page(`<h1>International Mathematics Olympiad — Practice</h1><p class="sub">Class 5 · Logical Reasoning</p>
      <div class="q">1. What comes next in the series 2, 6, 12, 20, 30, ___ ?<div class="opts">(A) 40 (B) 42 (C) 44 (D) 36</div></div>
      <div class="q">2. If CAT is coded as DBU, how is DOG coded?<div class="opts">(A) EPH (B) EPG (C) CNF (D) FQI</div></div>
      <div class="q">3. A clock shows 3:00. What is the angle between the hour hand and the minute hand?<div class="opts">(A) 60° (B) 90° (C) 120° (D) 180°</div></div>
      <div class="q">4. Riya is taller than Sam. Sam is taller than Tom. Who is the shortest?<div class="opts">(A) Riya (B) Sam (C) Tom (D) Cannot be determined</div></div>`);
    const ctx: SolveContext = { classLevel: 5, board: "Other", subject: "Mathematics", examType: "olympiad", detailLevel: "detailed" };
    const r = await runPdf("6-olympiad-mcq", await htmlToPdf(html), ctx);
    await save("6-olympiad-mcq", ctx, r);
    expect(labels(r)).toEqual(["1", "2", "3", "4"]);
    expect(r.rows.every((q) => q.type === "mcq")).toBe(true);
    expect(["1", "2", "3", "4"].map((l) => find(r, l)?.correct_option?.replace(/[()]/g, "").toUpperCase())).toEqual(["B", "A", "B", "C"]);
  }, 600_000);

  it("8. large 21-page paper: chunked extraction keeps every question in order", async () => {
    const sections = ["A", "B", "C"];
    let body = `<h1>Annual Examination — General Knowledge</h1><p class="sub">Class 4</p>`;
    let n = 0;
    for (let p = 0; p < 21; p++) {
      if (p % 7 === 0) body += `<h2>Section ${sections[p / 7]}</h2>`;
      n++;
      body += `<div class="q">${n}. Name the capital city of India. (Question ${n} of the paper, page ${p + 1})</div>`;
      n++;
      body += `<div class="q">${n}. How many days are there in a week?</div>`;
      body += `<div style="page-break-after:always"></div>`;
    }
    const pdf = await htmlToPdf(page(body));
    const ctx: SolveContext = { classLevel: 4, board: "CBSE", subject: "General Knowledge", examType: "school_exam", detailLevel: "short" };
    const r = await runPdf("8-large-multipage", pdf, ctx, false);
    await save("8-large-multipage", ctx, r);
    expect(r.pageCount).toBeGreaterThanOrEqual(21);
    expect(labels(r)).toEqual(Array.from({ length: 42 }, (_, i) => String(i + 1)));
    expect(r.rows.filter((q) => q.needs_review)).toEqual([]);
  }, 900_000);

  it("10. paper with unreadable / incomplete questions is flagged, not guessed", async () => {
    const html = page(`<h1>Class Test — Mathematics</h1><p class="sub">Class 8</p>
      <div class="q">1. Find the value of ${tex("12 \\times 12")}.</div>
      <div class="q" style="position:relative">2. A train travels 240 km in 4 hours. Find its average speed in km/h.
        <div style="position:absolute;left:-10px;top:-6px;width:120%;height:40px;background:radial-gradient(ellipse at center,#3b2a1a 0%,#3b2a1a 55%,rgba(59,42,26,0.6) 70%,transparent 80%)"></div></div>
      <div class="q">3. Using the figure given below, find the perimeter of the shape.</div>
      <div class="q">4. What is ${tex("\\frac{1}{2}")} of 50?</div>`);
    const ctx: SolveContext = { classLevel: 8, board: "CBSE", subject: "Mathematics", examType: "school_exam", detailLevel: "detailed" };
    const r = await runPdf("10-unreadable", await htmlToScannedPdf(html), ctx);
    await save("10-unreadable", ctx, r);
    expect(labels(r)).toEqual(["1", "2", "3", "4"]);
    // Q2 is covered by a stain, Q3 refers to a figure that doesn't exist.
    expect(find(r, "2")?.needs_review).toBe(true);
    expect(find(r, "3")?.needs_review).toBe(true);
    expect(find(r, "3")?.answer_status).toBe("cannot_answer");
    expect(text(find(r, "1"))).toContain("144");
    expect(text(find(r, "4"))).toContain("25");
  }, 600_000);
});
