// Answer sheet → editable Word document (.docx). Uses real heading styles,
// lists, tables, A4 pages with header/footer and page numbers, and native
// Word equations converted from LaTeX.

import "server-only";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, LevelFormat, Math as DocxMath,
  MathAngledBrackets, MathCurlyBrackets, MathFraction, MathRadical, MathRoundBrackets, MathRun,
  MathSquareBrackets, MathSubScript, MathSubSuperScript, MathSuperScript, Packer, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType, type IRunOptions, type MathComponent,
  type ParagraphChild,
} from "docx";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Root, RootContent, PhrasingContent, List, Table as MdTable } from "mdast";
import { parseLatex, type MathNode } from "./latex";
import { BRAND, DISCLAIMER, type SheetModel, type SheetQuestion } from "./sheet";

const hex = (c: string) => c.replace("#", "");
const FONT = "Calibri";

/* ── LaTeX → Word equation ─────────────────────────────────────────────── */

function mathComponents(nodes: MathNode[]): MathComponent[] {
  const out: MathComponent[] = [];
  for (const n of nodes) {
    switch (n.t) {
      case "text":
        if (n.v) out.push(new MathRun(n.v));
        break;
      case "frac":
        out.push(new MathFraction({ numerator: mathComponents(n.num), denominator: mathComponents(n.den) }));
        break;
      case "sup":
        out.push(new MathSuperScript({ children: orBlank(mathComponents(n.base)), superScript: mathComponents(n.sup) }));
        break;
      case "sub":
        out.push(new MathSubScript({ children: orBlank(mathComponents(n.base)), subScript: mathComponents(n.sub) }));
        break;
      case "subsup":
        out.push(new MathSubSuperScript({ children: orBlank(mathComponents(n.base)), subScript: mathComponents(n.sub), superScript: mathComponents(n.sup) }));
        break;
      case "sqrt":
        out.push(new MathRadical({ children: mathComponents(n.body), ...(n.degree ? { degree: mathComponents(n.degree) } : {}) }));
        break;
      case "brackets": {
        const children = mathComponents(n.body);
        if (n.kind === "round") out.push(new MathRoundBrackets({ children }));
        else if (n.kind === "square") out.push(new MathSquareBrackets({ children }));
        else if (n.kind === "curly") out.push(new MathCurlyBrackets({ children }));
        else if (n.kind === "angle") out.push(new MathAngledBrackets({ children }));
        else out.push(new MathRun("|"), ...children, new MathRun("|"));
        break;
      }
      case "op": {
        const sym = new MathRun({ sum: "∑", int: "∫", prod: "∏" }[n.op]);
        if (n.sub && n.sup) out.push(new MathSubSuperScript({ children: [sym], subScript: mathComponents(n.sub), superScript: mathComponents(n.sup) }));
        else if (n.sub) out.push(new MathSubScript({ children: [sym], subScript: mathComponents(n.sub) }));
        else if (n.sup) out.push(new MathSuperScript({ children: [sym], superScript: mathComponents(n.sup) }));
        else out.push(sym);
        break;
      }
    }
  }
  return out;
}

function orBlank(c: MathComponent[]): MathComponent[] {
  return c.length ? c : [new MathRun(" ")];
}

function equation(latex: string): DocxMath {
  return new DocxMath({ children: orBlank(mathComponents(parseLatex(latex))) });
}

/* ── Markdown → paragraphs ─────────────────────────────────────────────── */

const mdParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

interface RunStyle { bold?: boolean; italics?: boolean; color?: string; size?: number; font?: string }

function inline(nodes: PhrasingContent[], style: RunStyle = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case "text":
        out.push(new TextRun({ text: n.value, ...style } as IRunOptions));
        break;
      case "strong":
        out.push(...inline(n.children, { ...style, bold: true }));
        break;
      case "emphasis":
        out.push(...inline(n.children, { ...style, italics: true }));
        break;
      case "delete":
        out.push(...inline(n.children, style));
        break;
      case "inlineCode":
        out.push(new TextRun({ text: n.value, ...style, font: "Consolas" }));
        break;
      case "inlineMath":
        out.push(equation(n.value));
        break;
      case "break":
        out.push(new TextRun({ text: "", break: 1 }));
        break;
      case "link":
        out.push(...inline(n.children, { ...style, color: hex(BRAND.blue) }));
        break;
      default:
        if ("children" in n) out.push(...inline((n as { children: PhrasingContent[] }).children, style));
        else if ("value" in n) out.push(new TextRun({ text: String((n as { value: unknown }).value), ...style }));
    }
  }
  return out;
}

interface BlockOpts { indent?: number; keepNext?: boolean }

function blocks(nodes: RootContent[], opts: BlockOpts = {}, listDepth = 0): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  for (const n of nodes) {
    switch (n.type) {
      case "paragraph":
        out.push(new Paragraph({ children: inline(n.children), spacing: { after: 100 }, indent: opts.indent ? { left: opts.indent } : undefined, keepNext: opts.keepNext }));
        break;
      case "heading":
        out.push(new Paragraph({
          children: inline(n.children, { bold: true, color: hex(BRAND.ink) }),
          spacing: { before: 120, after: 60 },
          keepNext: true,
          indent: opts.indent ? { left: opts.indent } : undefined,
        }));
        break;
      case "math":
        out.push(new Paragraph({ children: [equation(n.value)], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120 } }));
        break;
      case "list":
        out.push(...list(n, opts, listDepth));
        break;
      case "table":
        out.push(mdTable(n));
        out.push(new Paragraph({ children: [], spacing: { after: 80 } }));
        break;
      case "blockquote":
        out.push(...blocks(n.children, { ...opts, indent: (opts.indent ?? 0) + 360 }, listDepth));
        break;
      case "code":
        n.value.split("\n").forEach((line) => out.push(new Paragraph({ children: [new TextRun({ text: line, font: "Consolas", size: 20 })] })));
        break;
      case "thematicBreak":
        out.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(BRAND.line), space: 4 } } }));
        break;
      case "html":
        // Raw HTML is never rendered; show it as literal text (as the PDF and preview do).
        out.push(new Paragraph({ children: [new TextRun(n.value)] }));
        break;
      default:
        break;
    }
  }
  return out;
}

function list(n: List, opts: BlockOpts, depth: number): Paragraph[] {
  const out: Paragraph[] = [];
  n.children.forEach((item) => {
    item.children.forEach((child, ci) => {
      if (child.type === "list") {
        out.push(...list(child, opts, depth + 1));
      } else if (child.type === "paragraph" && ci === 0) {
        out.push(new Paragraph({
          children: inline(child.children),
          ...(n.ordered
            ? { numbering: { reference: "qps-numbered", level: Math.min(depth, 2) } }
            : { bullet: { level: Math.min(depth, 2) } }),
          spacing: { after: 60 },
        }));
      } else {
        out.push(...(blocks([child], { ...opts, indent: 720 * (depth + 1) }, depth) as Paragraph[]));
      }
    });
  });
  return out;
}

function cell(children: ParagraphChild[], header = false, fill?: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children })],
    shading: header ? { type: ShadingType.CLEAR, fill: hex(BRAND.blueTint), color: "auto" } : fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

function mdTable(n: MdTable): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: n.children.map((row, ri) => new TableRow({
      tableHeader: ri === 0,
      children: row.children.map((c) => cell(inline(c.children, ri === 0 ? { bold: true } : {}), ri === 0)),
    })),
  });
}

function md(markdown: string | null | undefined, opts: BlockOpts = {}): Array<Paragraph | Table> {
  if (!markdown?.trim()) return [];
  const tree = mdParser.parse(markdown) as Root;
  return blocks(tree.children, opts);
}

/* ── Document ──────────────────────────────────────────────────────────── */

function label(text: string, color = BRAND.blue): TextRun {
  return new TextRun({ text, bold: true, color: hex(color) });
}

function questionBlock(q: SheetQuestion): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  out.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({ text: `${q.heading}.` }),
      new TextRun({ text: `   ${q.typeLabel}${q.marks !== null ? ` · ${q.marks} mark${q.marks === 1 ? "" : "s"}` : ""}`, size: 18, color: hex(BRAND.inkSoft), bold: false }),
    ],
    keepNext: true,
  }));
  if (q.contextMd) out.push(...md(q.contextMd, { indent: 360, keepNext: true }));
  out.push(...md(q.questionMd, { keepNext: true }));

  if (q.options.length) {
    for (const o of q.options) {
      out.push(new Paragraph({
        indent: { left: 360 },
        spacing: { after: 40 },
        keepNext: true,
        children: [
          new TextRun({ text: `(${o.label}) `, bold: o.correct, color: o.correct ? hex(BRAND.green) : undefined }),
          ...inlineMd(o.text, o.correct ? { bold: true, color: hex(BRAND.green) } : {}),
          ...(o.correct ? [new TextRun({ text: "  ✓", bold: true, color: hex(BRAND.green) })] : []),
        ],
      }));
    }
  }

  if (q.match) {
    const rows = Math.max(q.match.left.length, q.match.right.length);
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: [cell([new TextRun({ text: "Column A", bold: true })], true), cell([new TextRun({ text: "Column B", bold: true })], true)] }),
        ...Array.from({ length: rows }, (_, i) => new TableRow({
          children: [
            cell(q.match!.left[i] ? [new TextRun(`${i + 1}. `), ...inlineMd(q.match!.left[i])] : []),
            cell(q.match!.right[i] ? [new TextRun(`${String.fromCharCode(97 + i)}. `), ...inlineMd(q.match!.right[i])] : []),
          ],
        })),
      ],
    }));
  }

  if (q.diagramNote) {
    out.push(new Paragraph({ children: [new TextRun({ text: "Figure: ", italics: true, bold: true }), new TextRun({ text: q.diagramNote, italics: true, color: hex(BRAND.inkSoft) })], spacing: { before: 60, after: 60 } }));
  }

  if (q.status === "answered") {
    if (q.correctOption) out.push(new Paragraph({ children: [label("Correct option: "), new TextRun({ text: q.correctOption, bold: true })], spacing: { before: 120 }, keepNext: true }));
    out.push(new Paragraph({ children: [label("Answer:")], spacing: { before: q.correctOption ? 40 : 120, after: 40 }, keepNext: true }));
    out.push(...md(q.answerMd));
    if (q.explanationMd?.trim()) {
      out.push(new Paragraph({ children: [label("Explanation:")], spacing: { before: 80, after: 40 }, keepNext: true }));
      out.push(...md(q.explanationMd));
    }
    if (q.finalAnswer) {
      out.push(new Paragraph({
        children: [label("Final answer: ", BRAND.blueDark), ...inlineMd(q.finalAnswer, { bold: true })],
        shading: { type: ShadingType.CLEAR, fill: hex(BRAND.blueTint), color: "auto" },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: hex(BRAND.blue), space: 6 } },
        spacing: { before: 80, after: 80 },
      }));
    }
  } else {
    out.push(new Paragraph({
      children: [label("Answer: ", BRAND.warnText), new TextRun({ text: q.status === "cannot_answer" ? "Not answered. This question needs to be checked manually." : "Not generated. Please regenerate or answer manually." })],
      spacing: { before: 120 },
    }));
    if (q.answerMd?.trim()) out.push(...md(q.answerMd));
  }

  if (q.needsReview) {
    out.push(new Paragraph({
      children: [new TextRun({ text: "⚑ Needs review: ", bold: true, color: hex(BRAND.warnText) }), new TextRun({ text: q.reviewReason ?? "Please check this answer.", color: hex(BRAND.warnText) })],
      shading: { type: ShadingType.CLEAR, fill: hex(BRAND.warnBg), color: "auto" },
      spacing: { before: 80, after: 80 },
    }));
  }
  out.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(BRAND.line), space: 8 } }, spacing: { after: 160 } }));
  return out;
}

/** Inline-only Markdown (for option text, final answers). */
function inlineMd(text: string, style: RunStyle = {}): ParagraphChild[] {
  const tree = mdParser.parse(text) as Root;
  const first = tree.children[0];
  if (first?.type === "paragraph") return inline(first.children, style);
  return [new TextRun({ text, ...style })];
}

export async function renderDocx(sheet: SheetModel): Promise<Uint8Array> {
  const children: Array<Paragraph | Table> = [];

  // Cover / header block
  children.push(new Paragraph({
    children: [new TextRun({ text: "Olympiad", bold: true, size: 32, color: hex(BRAND.ink) }), new TextRun({ text: "IQ", bold: true, size: 32, color: hex(BRAND.blue) })],
    spacing: { after: 120 },
  }));
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(sheet.title)] }));
  children.push(new Paragraph({ children: [new TextRun({ text: sheet.fileName, color: hex(BRAND.inkSoft), size: 20 })], spacing: { after: 160 } }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [...sheet.meta, { label: "Generated on", value: sheet.generatedOn }].map((m) => new TableRow({
      children: [cell([new TextRun({ text: m.label, bold: true })], true), cell([new TextRun(m.value)])],
    })),
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `${sheet.stats.total} questions · ${sheet.stats.answered} answered · ${sheet.stats.flagged} flagged for review`, color: hex(BRAND.inkSoft), size: 20 })],
    spacing: { before: 120, after: 240 },
  }));

  for (const section of sheet.sections) {
    if (section.title) children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(section.title)], keepNext: true }));
    for (const q of section.questions) children.push(...questionBlock(q));
  }

  // Quick answer key
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Quick Answer Key")], pageBreakBefore: true }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [cell([new TextRun({ text: "Question", bold: true })], true), cell([new TextRun({ text: "Answer", bold: true })], true), cell([new TextRun({ text: "Review", bold: true })], true)] }),
      ...sheet.answerKey.map((k) => new TableRow({
        cantSplit: true,
        children: [
          cell([new TextRun({ text: k.label, bold: true })]),
          cell(inlineMd(k.answer)),
          cell(k.flagged ? [new TextRun({ text: "⚑ Check", color: hex(BRAND.warnText), bold: true })] : [], false, k.flagged ? hex(BRAND.warnBg) : undefined),
        ],
      })),
    ],
  }));

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Questions Flagged for Manual Review")], spacing: { before: 360 } }));
  if (sheet.flagged.length === 0) {
    children.push(new Paragraph({ children: [new TextRun("None. Every question was read and answered with confidence.")] }));
  } else {
    for (const f of sheet.flagged) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${f.label}: `, bold: true }), new TextRun(f.reason)] }));
    }
  }
  children.push(new Paragraph({ children: [new TextRun({ text: DISCLAIMER, italics: true, size: 18, color: hex(BRAND.inkSoft) })], spacing: { before: 360 } }));

  const doc = new Document({
    creator: "OlympiadIQ",
    title: `${sheet.title} – ${sheet.fileName}`,
    description: "AI-generated answer sheet",
    styles: {
      default: { document: { run: { font: FONT, size: 22, color: hex(BRAND.ink) }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 44, bold: true, color: hex(BRAND.ink) }, paragraph: { spacing: { after: 60 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 30, bold: true, color: hex(BRAND.blueDark) }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true, color: hex(BRAND.ink) }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [{
        reference: "qps-numbered",
        levels: [0, 1, 2].map((level) => ({
          level,
          format: level === 1 ? LevelFormat.LOWER_LETTER : level === 2 ? LevelFormat.LOWER_ROMAN : LevelFormat.DECIMAL,
          text: `%${level + 1}.`,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 360 * (level + 1), hanging: 260 } } },
        })),
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4 in twips
          margin: { top: 1300, bottom: 1200, left: 1134, right: 1134, header: 600, footer: 600 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: "Olympiad", bold: true, color: hex(BRAND.ink), size: 18 }),
              new TextRun({ text: "IQ", bold: true, color: hex(BRAND.blue), size: 18 }),
              new TextRun({ text: `  ·  ${sheet.title}`, color: hex(BRAND.inkSoft), size: 18 }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(BRAND.line), space: 4 } },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 18, color: hex(BRAND.inkSoft) })],
          })],
        }),
      },
      children,
    }],
  });

  return new Uint8Array(await Packer.toBuffer(doc));
}
