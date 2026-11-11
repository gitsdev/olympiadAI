// The AI steps of the pipeline as pure functions (bytes in, data out, no
// database). The worker wires them to Storage and Postgres; tests call them
// directly.

import "server-only";
import { callStructured, type ContentPart, type Effort } from "./ai";
import type { DocxImage } from "./docx";
import { extractionSchema, type ChunkExtraction } from "./extract";
import { slicePdf } from "./pdf";
import { EXTRACTION_SYSTEM, solveSystem, type SolveContext } from "./prompts";
import { matchAnswers, renderBatch, solveSchema, type SolvableQuestion } from "./solve";

/** Content for extracting one page range of a PDF. */
export async function pdfChunkContent(bytes: Uint8Array, opts: { from: number; to: number; pageCount: number; chunkIndex: number; chunkCount: number; fileName: string; carrySection?: string | null }): Promise<ContentPart[]> {
  const single = opts.chunkCount === 1;
  const pdf = single ? bytes : await slicePdf(bytes, Array.from({ length: opts.to - opts.from + 1 }, (_, k) => opts.from + k));
  return [
    { kind: "pdf", data: pdf, title: opts.fileName },
    {
      kind: "text",
      text: single
        ? "Transcribe every question in this question paper."
        : `This document is pages ${opts.from}–${opts.to} of a ${opts.pageCount}-page question paper (part ${opts.chunkIndex + 1} of ${opts.chunkCount}). Transcribe every question in it. Report page numbers relative to this document (1 = page ${opts.from}).${opts.carrySection ? ` The section in effect at the start of these pages is "${opts.carrySection}" (its heading is on an earlier page); use it for questions that come before the first section heading shown here.` : ""}`,
    },
  ];
}

const MAX_SOLVE_PAGES = 8;

/** The original pages a batch came from, so the solver can check the transcription. */
export async function pdfSourceParts(bytes: Uint8Array, sourcePages: number[]): Promise<ContentPart[]> {
  const pages = [...new Set(sourcePages)].sort((a, b) => a - b).slice(0, MAX_SOLVE_PAGES);
  if (!pages.length) return [];
  let pdf: Uint8Array;
  try {
    pdf = await slicePdf(bytes, pages);
  } catch {
    // Encrypted PDFs can't be sliced; they're limited to one chunk, so send whole.
    pdf = bytes;
  }
  return [
    { kind: "pdf", data: pdf, title: `Original page(s) ${pages.join(", ")}` },
    { kind: "text", text: `The attached document holds original page(s) ${pages.join(", ")} of the paper, in that order.` },
  ];
}

export type VisionImage = Pick<DocxImage, "id" | "mime" | "bytes">;

export function imageParts(images: VisionImage[]): ContentPart[] {
  return images.flatMap((img): ContentPart[] => [
    { kind: "text", text: `Image ${img.id}:` },
    { kind: "image", data: img.bytes, mime: img.mime as "image/png" },
  ]);
}

/** Content for extracting a converted Word document. */
export function docxContent(markdown: string, images: VisionImage[]): ContentPart[] {
  return [
    { kind: "text", text: `Question paper converted from a Word document:\n\n<paper>\n${markdown}\n</paper>` },
    ...imageParts(images),
    { kind: "text", text: "Transcribe every question in this question paper. Page numbers are not available for Word documents; use null or 1." },
  ];
}

export function extractQuestions(content: ContentPart[]) {
  return callStructured<ChunkExtraction>({
    system: EXTRACTION_SYSTEM,
    content,
    schema: extractionSchema,
    effort: "medium",
    maxTokens: 48_000,
  });
}

export function solveEffort(ctx: Pick<SolveContext, "examType" | "detailLevel" | "subject">): Effort {
  return ctx.examType === "olympiad" || ctx.detailLevel === "step_by_step" || ctx.subject === "Mathematics" ? "high" : "medium";
}

/** Solves a batch; `sourceParts` are the original pages/figures for checking. */
export async function solveBatch(ctx: SolveContext, questions: SolvableQuestion[], sourceParts: ContentPart[]) {
  const { data, usage, model } = await callStructured({
    system: solveSystem(ctx),
    content: [...sourceParts, { kind: "text", text: renderBatch(questions) }],
    schema: solveSchema,
    effort: solveEffort(ctx),
    maxTokens: 64_000,
  });
  return { ...matchAnswers(questions.map((q) => q.id), data), usage, model };
}
