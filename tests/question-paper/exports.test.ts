// PDF and DOCX export: real files, readable content, maths, page numbers,
// and no HTML/script injection from answer text.

import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import { renderDocx } from "@/lib/question-paper/export-docx";
import { mdToHtml, renderSheetHtml } from "@/lib/question-paper/export-html";
import { renderPdf } from "@/lib/question-paper/export-pdf";
import { buildSheet } from "@/lib/question-paper/sheet";
import type { PublicJob, PublicQuestion } from "@/lib/question-paper/types";

const job = {
  id: "j", file_name: "Class 8 Maths.pdf", file_ext: "pdf", class_level: 8, board: "CBSE", subject: "Mathematics",
  exam_type: "olympiad", detail_level: "step_by_step", total_questions: 3,
} as unknown as PublicJob;

const base = {
  section: "Section A — MCQ", context_md: null, match_pairs: null, has_diagram: false, diagram_description: null,
  source_pages: [1], marks: 2, extraction_confidence: "high", review_source: null, answer_confidence: "high",
  edited_by_user: false, regen_count: 0, updated_at: "", options: null, correct_option: null, final_answer: null,
  needs_review: false, review_reason: null, answer_status: "answered",
};

const questions = [
  {
    ...base, id: "a", order_index: 0, number_label: "1", type: "mcq",
    question_md: "What is $\\frac{3}{4} + \\frac{1}{4}$?",
    options: [{ label: "A", text: "$\\frac{1}{2}$" }, { label: "B", text: "1" }, { label: "C", text: "2" }, { label: "D", text: "$\\frac{3}{16}$" }],
    correct_option: "B", answer_short: "B) 1", answer_md: "**B) 1**",
    explanation_md: "1. Same denominator, so add numerators: $3 + 1 = 4$.\n2. $\\frac{4}{4} = 1$.",
  },
  {
    ...base, id: "b", order_index: 1, number_label: "2", type: "numerical", section: "Section B",
    question_md: "Find $x$ if $x^2 = 49$ and $x > 0$.",
    answer_short: "x = 7", answer_md: "$x = 7$", explanation_md: "$$x = \\sqrt{49} = 7$$", final_answer: "$x = 7$",
  },
  {
    ...base, id: "c", order_index: 2, number_label: "3", type: "diagram", section: "Section B",
    question_md: "Find the area of the shaded region.", has_diagram: true, diagram_description: "A square of side 4 cm",
    answer_status: "cannot_answer", needs_review: true, review_reason: "The shaded region isn't described.",
    answer_short: null, answer_md: "<script>alert('x')</script><img src=x onerror=alert(1)> Not enough information.", explanation_md: "",
  },
] as unknown as PublicQuestion[];

const sheet = buildSheet(job, questions, new Date("2026-11-11T10:00:00Z"));

describe("HTML (PDF source)", () => {
  it("typesets maths with KaTeX", () => {
    const html = mdToHtml("$\\frac{3}{4}$");
    expect(html).toContain('class="katex"');
    expect(html).toContain("frac-line");
  });

  it("never renders raw HTML or scripts from answers, but keeps the text", () => {
    const html = renderSheetHtml(sheet);
    expect(html).not.toMatch(/<script>alert/);
    expect(html).not.toMatch(/<img src=x/);
    expect(html).toContain("&#x3C;script>"); // shown as literal text
    expect(html).toContain("Not enough information.");
  });

  it("contains the cover, every question, the answer key and the flagged list", () => {
    const html = renderSheetHtml(sheet);
    for (const s of ["Question Paper Solutions", "Class 8", "CBSE", "Olympiad", "11 November 2026", "Question 1.", "Question 2.", "Question 3.", "Quick Answer Key", "Questions Flagged for Manual Review", "The shaded region isn"]) {
      expect(html).toContain(s);
    }
  });
});

describe("DOCX export", () => {
  it("produces a valid Word file with native equations, headings and page numbers", async () => {
    const bytes = await renderDocx(sheet);
    const zip = await JSZip.loadAsync(bytes);
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain("<m:oMath>");
    expect(doc).toContain("<m:f>"); // a real fraction
    expect(doc).toContain("<m:rad>"); // square root
    expect(doc).toContain('w:val="Heading1"');
    expect(doc).toContain("Quick Answer Key");
    expect(doc).toContain("Needs review");
    expect(doc).not.toContain("<script");
    const footers = Object.keys(zip.files).filter((f) => /word\/footer\d*\.xml/.test(f));
    const footerXml = (await Promise.all(footers.map((f) => zip.file(f)!.async("string")))).join("");
    expect(footerXml).toMatch(/PAGE/);
    expect(footerXml).toMatch(/NUMPAGES/);
    const sectPr = /<w:pgSz [^>]*w:w="11906"[^>]*w:h="16838"/.test(doc);
    expect(sectPr).toBe(true); // A4
  });
});

const hasChrome = !!process.env.CHROME_EXECUTABLE_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].some((p) => existsSync(p));

describe.skipIf(!hasChrome)("PDF export (headless Chrome)", () => {
  it("renders an A4 PDF with every question, page numbers and the answer key", async () => {
    const pdf = await renderPdf(sheet);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const page = await doc.getPage(1);
    const [, , w, h] = page.view;
    expect(Math.round(w)).toBe(595); // A4 in points
    expect(Math.round(h)).toBe(842);
    const { totalPages, text } = await extractText(doc, { mergePages: true });
    expect(totalPages).toBeGreaterThanOrEqual(2); // answer key starts a new page
    for (const s of ["Question Paper Solutions", "Question 1", "Question 2", "Question 3", "Quick Answer Key", "Page 1 of"]) {
      expect(text).toContain(s);
    }
  }, 90_000);
});
