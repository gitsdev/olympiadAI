// PDF inspection and slicing. Text extraction here is only used to decide
// whether a paper is scanned and to sanity-check that the file parses; the
// actual reading (text, OCR, equations, diagrams) is done by Claude, which
// receives each page as both its text layer and an image.

import "server-only";
import { PDFDocument } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { MAX_PAGES } from "./constants";
import { FileRejectedError } from "./file-check";

/** Pages with fewer non-space characters than this are treated as scanned. */
const SCANNED_PAGE_CHARS = 20;
/** Pages per extraction call. Keeps each call's output well within limits. */
export const EXTRACT_PAGES_PER_CHUNK = 10;

export interface PdfInfo {
  pageCount: number;
  scannedPages: number[];
  isScanned: boolean;
  encrypted: boolean;
}

export async function inspectPdf(bytes: Uint8Array): Promise<PdfInfo> {
  let pageCount: number;
  let pageTexts: string[];
  try {
    // unpdf may take ownership of the buffer, so hand it a copy.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    pageCount = totalPages;
    pageTexts = text;
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "PasswordException") {
      throw new FileRejectedError("This PDF is password-protected. Remove the password and upload it again.");
    }
    throw new FileRejectedError("This PDF is damaged or can't be read. Try re-saving or re-exporting it as PDF.");
  }

  if (pageCount < 1) throw new FileRejectedError("This PDF has no pages.");
  if (pageCount > MAX_PAGES) {
    throw new FileRejectedError(`This paper has ${pageCount} pages. The limit is ${MAX_PAGES} pages; split it and upload each part.`);
  }

  const scannedPages = pageTexts
    .map((t, i) => ({ page: i + 1, chars: t.replace(/\s+/g, "").length }))
    .filter((p) => p.chars < SCANNED_PAGE_CHARS)
    .map((p) => p.page);

  let encrypted = false;
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    encrypted = doc.isEncrypted;
  } catch {
    // pdf.js could read it but pdf-lib can't; we can still send it whole.
    encrypted = true;
  }

  return {
    pageCount,
    scannedPages,
    isScanned: scannedPages.length > pageCount / 2,
    encrypted,
  };
}

/** Page ranges (1-based, inclusive) for chunked extraction. */
export function planChunks(pageCount: number, perChunk = EXTRACT_PAGES_PER_CHUNK): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let start = 1; start <= pageCount; start += perChunk) {
    out.push([start, Math.min(pageCount, start + perChunk - 1)]);
  }
  return out;
}

/**
 * A new PDF holding only `pages` (1-based), in the given order. Encrypted
 * PDFs can't be sliced reliably, so callers send those whole (they are
 * limited to a single chunk at upload time).
 */
export async function slicePdf(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { updateMetadata: false });
  const out = await PDFDocument.create();
  const indices = pages.filter((p) => p >= 1 && p <= src.getPageCount()).map((p) => p - 1);
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  return out.save();
}
