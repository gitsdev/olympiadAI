// Builds real PDF / DOCX question papers in memory for the tests.

import {
  Document, ImageRun, Math as DocxMath, MathFraction, MathRun, MathSuperScript, Packer, Paragraph, TextRun,
} from "docx";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";

/** A text-based PDF with one page per entry of `pages` (each a list of lines). */
export async function textPdf(pages: string[][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([595, 842]);
    lines.forEach((line, i) => page.drawText(line, { x: 50, y: 780 - i * 22, size: 12, font }));
  }
  return doc.save();
}

/** A "scanned" PDF: pages that are only images, no text layer. */
export async function imageOnlyPdf(png: Uint8Array, pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(png);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawImage(img, { x: 40, y: 400, width: 500, height: 400 });
  }
  return doc.save();
}

/** 1×1 transparent PNG. */
export const TINY_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

/** A .docx with headings, an MCQ, a native Word equation and an image. */
export async function sampleDocx(): Promise<Uint8Array> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: "Section A — Mathematics", bold: true })] }),
        new Paragraph({ children: [new TextRun("1. Simplify: "), new DocxMath({ children: [new MathFraction({ numerator: [new MathRun("3")], denominator: [new MathRun("4")] }), new MathRun("+"), new MathSuperScript({ children: [new MathRun("x")], superScript: [new MathRun("2")] })] })] }),
        new Paragraph({ children: [new TextRun("2. Which is a prime number?")] }),
        new Paragraph({ children: [new TextRun("(a) 4   (b) 6   (c) 7   (d) 9")] }),
        new Paragraph({ children: [new TextRun("3. Find the area of the triangle shown.")] }),
        new Paragraph({ children: [new ImageRun({ type: "png", data: TINY_PNG, transformation: { width: 40, height: 40 } })] }),
      ],
    }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** Turns a .docx into a macro-enabled one (content type + vbaProject.bin). */
export async function makeMacroDocx(docx: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(docx);
  const types = (await zip.file("[Content_Types].xml")!.async("string"))
    .replace("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "application/vnd.ms-word.document.macroEnabled.main+xml");
  zip.file("[Content_Types].xml", types);
  zip.file("word/vbaProject.bin", new Uint8Array([1, 2, 3]));
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}
