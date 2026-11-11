// Question extraction: the schema Claude fills for each chunk of the paper,
// and the pure merge step that turns chunk results into ordered question
// rows — stitching questions split across chunks and adding a flagged
// placeholder for anything seen but not extracted, so no question is ever
// skipped silently.

import { z } from "zod";
import { EXAM_TYPES, QUESTION_TYPES, type Confidence, type QuestionType } from "./constants";

export const extractionSchema = z.object({
  paper: z.object({
    title: z.string().nullable(),
    detected_class: z.number().int().nullable().describe("Class/grade 1-10 if stated or clearly implied, else null"),
    detected_board: z.string().nullable().describe("CBSE, ICSE or another board if identifiable, else null"),
    detected_subject: z.string().nullable(),
    detected_exam_type: z.enum(EXAM_TYPES.map((e) => e.value) as [string, ...string[]]).nullable(),
  }),
  question_index: z.array(z.object({
    label: z.string().describe("Question number exactly as printed, e.g. '5', '5(b)', 'II.3'"),
    page: z.number().int().nullable().describe("Page within this document, 1 = first page shown"),
  })).describe("EVERY question number visible in this document, in order, even ones you could not read fully"),
  questions: z.array(z.object({
    label: z.string(),
    section: z.string().nullable().describe("Section heading this question belongs to, e.g. 'Section A — MCQs'"),
    type: z.enum(QUESTION_TYPES),
    context_md: z.string().nullable().describe("Shared passage, data table or instruction needed to answer (repeat it on every question that needs it)"),
    text_md: z.string().describe("Full question text in Markdown, maths in LaTeX ($...$)"),
    options: z.array(z.object({ label: z.string(), text: z.string() })),
    match_left: z.array(z.string()),
    match_right: z.array(z.string()),
    has_diagram: z.boolean(),
    diagram_description: z.string().nullable().describe("Precise description of the figure: labels, values, shapes, axes"),
    image_refs: z.array(z.string()).describe("IDs from ⟦IMAGE imgN⟧ markers this question uses (Word documents only)"),
    pages: z.array(z.number().int()),
    marks: z.number().nullable(),
    confidence: z.enum(["high", "medium", "low"]).describe("How sure you are the question was read completely and correctly"),
    issues: z.array(z.string()).describe("Anything unreadable, cut off, ambiguous or missing (e.g. 'figure is blurred')"),
    continues_on_next_page: z.boolean().describe("True only if this question is cut off at the END of this document"),
    continued_from_previous_page: z.boolean().describe("True only if this question started BEFORE the first page of this document"),
  })),
  unreadable_regions: z.array(z.object({
    page: z.number().int().nullable(),
    description: z.string(),
  })).describe("Parts of the paper that look like questions but cannot be read at all"),
});

export type ChunkExtraction = z.infer<typeof extractionSchema>;
export type ExtractedQuestion = ChunkExtraction["questions"][number];

export interface StoredChunk {
  /** 1-based first page of the chunk in the original paper (1 for DOCX). */
  pageOffset: number;
  result: ChunkExtraction;
}

export interface QuestionRow {
  order_index: number;
  section: string | null;
  number_label: string;
  type: QuestionType;
  context_md: string | null;
  question_md: string;
  options: Array<{ label: string; text: string }> | null;
  match_pairs: { left: string[]; right: string[] } | null;
  has_diagram: boolean;
  diagram_description: string | null;
  image_refs: string[];
  source_pages: number[];
  marks: number | null;
  extraction_confidence: Confidence;
  needs_review: boolean;
  review_reason: string | null;
  review_source: "extraction" | null;
  answer_status: "pending" | "cannot_answer";
}

/** "Q. 5 (b)" → "5(b)"; used only for matching, never displayed. */
export function normalizeLabel(label: string): string {
  let s = label
    .toLowerCase()
    .replace(/^(q(uestion)?|no)\.?\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/[.:]+$/g, "");
  // "5)" → "5", but keep the bracket in "5(b)".
  if (s.endsWith(")") && !s.includes("(")) s = s.slice(0, -1);
  return s;
}

const unique = (a: number[]) => [...new Set(a)].sort((x, y) => x - y);

/**
 * True if an index label and a question label refer to the same question,
 * including parent/sub-part pairs ("5" ↔ "5(a)", "5" ↔ "5.1") but not
 * different numbers ("1" vs "10").
 */
export function labelsMatch(a: string, b: string): boolean {
  const x = normalizeLabel(a);
  const y = normalizeLabel(b);
  if (x === y) return true;
  const sub = (long: string, short: string) => long.startsWith(short) && /^[(.a-z]/.test(long.slice(short.length));
  return sub(x, y) || sub(y, x);
}

function stitch(a: ExtractedQuestion, b: ExtractedQuestion): ExtractedQuestion {
  return {
    ...a,
    text_md: `${a.text_md}\n\n${b.text_md}`.trim(),
    options: [...a.options, ...b.options],
    match_left: [...a.match_left, ...b.match_left],
    match_right: [...a.match_right, ...b.match_right],
    has_diagram: a.has_diagram || b.has_diagram,
    diagram_description: [a.diagram_description, b.diagram_description].filter(Boolean).join(" ") || null,
    image_refs: [...a.image_refs, ...b.image_refs],
    pages: [...a.pages, ...b.pages],
    confidence: a.confidence === "low" || b.confidence === "low" ? "low" : a.confidence === "medium" || b.confidence === "medium" ? "medium" : "high",
    issues: [...a.issues, ...b.issues],
    continues_on_next_page: b.continues_on_next_page,
  };
}

function placeholder(label: string, section: string | null, page: number | null, reason: string): ExtractedQuestion {
  return {
    label, section, type: "other", context_md: null,
    text_md: "",
    options: [], match_left: [], match_right: [],
    has_diagram: false, diagram_description: null, image_refs: [],
    pages: page ? [page] : [], marks: null,
    confidence: "low", issues: [reason],
    continues_on_next_page: false, continued_from_previous_page: false,
  };
}

/**
 * Merges chunk extractions (in page order) into ordered question rows.
 * `unsupportedImages` are DOCX image ids that couldn't be sent to vision.
 */
export function mergeChunks(chunks: StoredChunk[], unsupportedImages: string[] = []): QuestionRow[] {
  // 1. Flatten with absolute page numbers, stitching cross-chunk questions.
  const flat: ExtractedQuestion[] = [];
  const index: Array<{ label: string; page: number | null }> = [];
  const unreadable: Array<{ page: number | null; description: string }> = [];

  for (const [ci, { pageOffset, result }] of chunks.entries()) {
    const abs = (p: number) => p + pageOffset - 1;
    // Questions before the first heading of a later chunk belong to the
    // section that was in effect at the end of the previous chunk.
    let carry = ci > 0 ? flat[flat.length - 1]?.section ?? null : null;
    index.push(...result.question_index.map((i) => ({ label: i.label, page: i.page === null ? null : abs(i.page) })));
    unreadable.push(...result.unreadable_regions.map((u) => ({ ...u, page: u.page === null ? null : abs(u.page) })));

    result.questions.forEach((q0, i) => {
      if (q0.section) carry = null;
      const q = { ...q0, section: q0.section ?? carry, pages: q0.pages.map(abs) };
      const prev = flat[flat.length - 1];
      if (i === 0 && q.continued_from_previous_page && prev?.continues_on_next_page) {
        flat[flat.length - 1] = stitch(prev, q);
      } else {
        flat.push(q);
      }
    });
  }

  // 2. Anything in the index that wasn't extracted → flagged placeholder,
  //    inserted after the question that precedes it in the index.
  const out: ExtractedQuestion[] = [...flat];
  let lastFoundAt = -1;
  for (const entry of index) {
    const at = out.findIndex((q, i) => i > lastFoundAt && labelsMatch(q.label, entry.label));
    if (at >= 0) {
      lastFoundAt = at;
      continue;
    }
    if (out.some((q) => labelsMatch(q.label, entry.label))) continue; // extracted, just out of index order
    const section = out[lastFoundAt]?.section ?? null;
    out.splice(lastFoundAt + 1, 0, placeholder(entry.label, section, entry.page, "This question was seen in the paper but could not be read. Please check the original."));
    lastFoundAt += 1;
  }

  // 3. Gaps in numbering (…6, 7, 9…) → flagged placeholder for 8. Compares
  //    leading numbers, so "4" → "6(a)" is a gap but "5(a)" → "5(b)" isn't.
  //    Only small gaps within one section; a restart (9 → 1) is a new section.
  for (let i = 1; i < out.length; i++) {
    const a = /^(\d+)/.exec(normalizeLabel(out[i - 1].label));
    const b = /^(\d+)/.exec(normalizeLabel(out[i].label));
    if (!a || !b || out[i - 1].section !== out[i].section) continue;
    const gap = Number(b[1]) - Number(a[1]);
    if (gap >= 2 && gap <= 4) {
      const missing: ExtractedQuestion[] = [];
      for (let n = Number(a[1]) + 1; n < Number(b[1]); n++) {
        missing.push(placeholder(String(n), out[i].section, out[i - 1].pages.at(-1) ?? null,
          `Question ${n} was expected here (numbering jumps from ${a[1]} to ${b[1]}) but was not found. Please check the original.`));
      }
      out.splice(i, 0, ...missing);
      i += missing.length;
    }
  }

  // 4. Unreadable regions that don't map to a question → flagged rows at the end
  //    of their page (or the end of the paper).
  for (const u of unreadable) {
    // A region that names a question we already have is a problem with that
    // question, not a separate one: attach it instead of adding a row.
    const named = /\b(?:q(?:uestion)?|no)\.?\s*([0-9]+(?:\s*\(?[a-z]\))?)/i.exec(u.description);
    const owner = named ? out.find((q) => labelsMatch(q.label, named[1])) : undefined;
    if (owner) {
      owner.issues = [...owner.issues, u.description];
      if (owner.confidence === "high") owner.confidence = "medium";
      continue;
    }
    const pos = u.page === null ? out.length : (() => {
      let last = -1;
      out.forEach((q, i) => { if (q.pages.some((p) => p <= u.page!)) last = i; });
      return last + 1;
    })();
    out.splice(pos, 0, placeholder(`Unreadable (page ${u.page ?? "?"})`, out[pos - 1]?.section ?? null, u.page,
      `Unreadable content: ${u.description}`));
  }

  // 5. Rows.
  const unsupported = new Set(unsupportedImages);
  return out.map((q, i): QuestionRow => {
    const badImages = q.image_refs.filter((r) => unsupported.has(r));
    const issues = [...q.issues];
    if (badImages.length) issues.push("A figure in this question is in a format that can't be read.");
    const isPlaceholder = q.text_md.trim() === "";
    const needsReview = isPlaceholder || q.confidence === "low" || issues.length > 0;
    return {
      order_index: i,
      section: q.section,
      number_label: q.label.trim() || String(i + 1),
      type: q.type,
      context_md: q.context_md,
      question_md: q.text_md,
      options: q.options.length ? q.options : null,
      match_pairs: q.match_left.length || q.match_right.length ? { left: q.match_left, right: q.match_right } : null,
      has_diagram: q.has_diagram,
      diagram_description: q.diagram_description,
      image_refs: q.image_refs,
      source_pages: unique(q.pages),
      marks: q.marks,
      extraction_confidence: q.confidence,
      needs_review: needsReview,
      review_reason: needsReview ? (issues.join(" ") || "The question may not have been read completely.") : null,
      review_source: needsReview ? "extraction" : null,
      // A placeholder has no text to solve; everything else is attempted,
      // even if flagged — the solver itself refuses to guess.
      answer_status: isPlaceholder ? "cannot_answer" : "pending",
    };
  });
}

/** Detected academic info from the first chunk that has each field. */
export function detectedMeta(chunks: StoredChunk[]) {
  const pick = <K extends keyof ChunkExtraction["paper"]>(k: K) =>
    chunks.map((c) => c.result.paper[k]).find((v) => v !== null && v !== undefined) ?? null;
  const cls = pick("detected_class");
  return {
    title: pick("title"),
    class_level: typeof cls === "number" && cls >= 1 && cls <= 10 ? cls : null,
    board: pick("detected_board"),
    subject: pick("detected_subject"),
    exam_type: pick("detected_exam_type"),
  };
}
