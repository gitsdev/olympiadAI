// File verification, PDF inspection/slicing, DOCX conversion and OMML maths.

import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { FileRejectedError, sanitizeFileName, verifyFileBytes } from "@/lib/question-paper/file-check";
import { inspectPdf, planChunks, slicePdf } from "@/lib/question-paper/pdf";
import { convertDocx } from "@/lib/question-paper/docx";
import { ommlToLatex } from "@/lib/question-paper/omml";
import { TINY_PNG, imageOnlyPdf, makeMacroDocx, sampleDocx, textPdf } from "./fixtures";

const M = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';

describe("verifyFileBytes", () => {
  it("accepts a real PDF and a real DOCX", async () => {
    await expect(verifyFileBytes(await textPdf([["Q1. 2+2?"]]), "pdf")).resolves.toBeUndefined();
    await expect(verifyFileBytes(await sampleDocx(), "docx")).resolves.toBeUndefined();
  });

  it("rejects a file whose bytes don't match its extension", async () => {
    await expect(verifyFileBytes(await sampleDocx(), "pdf")).rejects.toThrow(FileRejectedError);
    await expect(verifyFileBytes(await textPdf([["x"]]), "docx")).rejects.toThrow(/not a valid Word/);
    await expect(verifyFileBytes(new TextEncoder().encode("<script>alert(1)</script>"), "pdf")).rejects.toThrow(/not a valid PDF/);
  });

  it("rejects macro-enabled Word documents", async () => {
    await expect(verifyFileBytes(await makeMacroDocx(await sampleDocx()), "docx")).rejects.toThrow(/Macro-enabled/);
  });

  it("rejects corrupted ZIPs and empty files", async () => {
    const broken = (await sampleDocx()).slice(0, 200);
    await expect(verifyFileBytes(broken, "docx")).rejects.toThrow(/damaged/);
    await expect(verifyFileBytes(new Uint8Array(), "pdf")).rejects.toThrow(/empty/);
  });

  it("sanitises display names", () => {
    expect(sanitizeFileName("../../etc/<pass>wd.pdf")).toBe(".._.._etc_pass_wd.pdf");
    expect(sanitizeFileName("   ")).toBe("question-paper");
  });
});

describe("inspectPdf", () => {
  it("counts pages and treats a text PDF as not scanned", async () => {
    const info = await inspectPdf(await textPdf([["Q1. What is 2 + 2? Show your working clearly."], ["Q2. Name the largest planet in our solar system."]]));
    expect(info).toMatchObject({ pageCount: 2, isScanned: false, encrypted: false, scannedPages: [] });
  });

  it("detects a scanned (image-only) PDF", async () => {
    const info = await inspectPdf(await imageOnlyPdf(TINY_PNG, 3));
    expect(info.isScanned).toBe(true);
    expect(info.scannedPages).toEqual([1, 2, 3]);
  });

  it("rejects corrupted PDFs and papers over the page limit", async () => {
    const pdf = await textPdf([["Q1"]]);
    await expect(inspectPdf(pdf.slice(0, 60))).rejects.toThrow(/damaged/);
    await expect(inspectPdf(await textPdf(Array.from({ length: 41 }, () => ["Q"])))).rejects.toThrow(/limit is 40 pages/);
  });
});

describe("PDF chunking", () => {
  it("plans 10-page chunks", () => {
    expect(planChunks(1)).toEqual([[1, 1]]);
    expect(planChunks(23)).toEqual([[1, 10], [11, 20], [21, 23]]);
  });

  it("slices the requested pages in order", async () => {
    const src = await textPdf([["one"], ["two"], ["three"], ["four"]]);
    const out = await PDFDocument.load(await slicePdf(src, [2, 4]));
    expect(out.getPageCount()).toBe(2);
  });
});

describe("OMML → LaTeX", () => {
  const wrap = (inner: string) => `<m:oMath ${M}>${inner}</m:oMath>`;
  const r = (t: string) => `<m:r><m:t>${t}</m:t></m:r>`;

  it("converts fractions, powers, subscripts and roots", () => {
    expect(ommlToLatex(wrap(`<m:f><m:num>${r("3")}</m:num><m:den>${r("4")}</m:den></m:f>`))).toBe("\\frac{3}{4}");
    expect(ommlToLatex(wrap(`<m:sSup><m:e>${r("x")}</m:e><m:sup>${r("2")}</m:sup></m:sSup>`))).toBe("{x}^{2}");
    expect(ommlToLatex(wrap(`<m:sSub><m:e>${r("a")}</m:e><m:sub>${r("n")}</m:sub></m:sSub>`))).toBe("{a}_{n}");
    expect(ommlToLatex(wrap(`<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${r("16")}</m:e></m:rad>`))).toBe("\\sqrt{16}");
    expect(ommlToLatex(wrap(`<m:rad><m:deg>${r("3")}</m:deg><m:e>${r("27")}</m:e></m:rad>`))).toBe("\\sqrt[3]{27}");
  });

  it("converts brackets, n-ary sums and symbols", () => {
    expect(ommlToLatex(wrap(`<m:d><m:e>${r("a+b")}</m:e></m:d>`))).toBe("\\left( a+b \\right)");
    expect(ommlToLatex(wrap(`<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>${r("i=1")}</m:sub><m:sup>${r("n")}</m:sup><m:e>${r("i")}</m:e></m:nary>`))).toBe("\\sum_{i=1}^{n} i");
    expect(ommlToLatex(wrap(r("6×7÷2 ≤ π")))).toBe("6\\times 7\\div 2 \\le \\pi");
  });
});

describe("convertDocx", () => {
  it("keeps text order, turns equations into LaTeX and images into markers", async () => {
    const out = await convertDocx(await sampleDocx());
    expect(out.equationCount).toBe(1);
    expect(out.markdown).toContain("$\\frac{3}{4}+{x}^{2}$");
    expect(out.markdown).toMatch(/Which is a prime number\?/);
    expect(out.markdown).toContain("⟦IMAGE img1⟧");
    expect(out.images).toHaveLength(1);
    expect(out.images[0]).toMatchObject({ id: "img1", mime: "image/png", supported: true });
    // Original order preserved.
    const md = out.markdown;
    expect(md.indexOf("Simplify")).toBeLessThan(md.indexOf("prime"));
    expect(md.indexOf("prime")).toBeLessThan(md.indexOf("triangle"));
  });

  it("rejects a document with no content", async () => {
    const { Document, Packer, Paragraph } = await import("docx");
    const empty = new Uint8Array(await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("")] }] })));
    await expect(convertDocx(empty)).rejects.toThrow(/no readable content/);
  });
});
