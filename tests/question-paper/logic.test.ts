// Question merging/coverage (nothing silently skipped), answer matching,
// review flags, the LaTeX parser and the answer-sheet model.

import { describe, expect, it } from "vitest";
import { labelsMatch, mergeChunks, normalizeLabel, type ExtractedQuestion, type StoredChunk } from "@/lib/question-paper/extract";
import { batchSize, matchAnswers, renderBatch, type SolvableQuestion, type SolvedAnswer } from "@/lib/question-paper/solve";
import { answerUpdate } from "@/lib/question-paper/worker";
import { displayLabel, questionHeading } from "@/lib/question-paper/constants";
import { latexToPlain, parseLatex } from "@/lib/question-paper/latex";
import { buildSheet, exportFileName } from "@/lib/question-paper/sheet";
import type { PublicJob, PublicQuestion } from "@/lib/question-paper/types";

function q(label: string, over: Partial<ExtractedQuestion> = {}): ExtractedQuestion {
  return {
    label, section: "Section A", type: "short", context_md: null, text_md: `Question ${label} text`,
    options: [], match_left: [], match_right: [], has_diagram: false, diagram_description: null,
    image_refs: [], pages: [1], marks: 1, confidence: "high", issues: [],
    continues_on_next_page: false, continued_from_previous_page: false, ...over,
  };
}

function chunk(questions: ExtractedQuestion[], opts: { offset?: number; index?: string[]; unreadable?: StoredChunk["result"]["unreadable_regions"] } = {}): StoredChunk {
  return {
    pageOffset: opts.offset ?? 1,
    result: {
      paper: { title: null, detected_class: null, detected_board: null, detected_subject: null, detected_exam_type: null },
      question_index: (opts.index ?? questions.map((x) => x.label)).map((label) => ({ label, page: 1 })),
      questions,
      unreadable_regions: opts.unreadable ?? [],
    },
  };
}

describe("labels", () => {
  it("normalises printed numbering", () => {
    expect(normalizeLabel("Q. 5 (b)")).toBe("5(b)");
    expect(normalizeLabel("Question 12.")).toBe("12");
    expect(normalizeLabel("5[a]")).toBe("5(a)");
  });

  it("matches parents to sub-parts but not different numbers", () => {
    expect(labelsMatch("5", "5(a)")).toBe(true);
    expect(labelsMatch("5.1", "5")).toBe(true);
    expect(labelsMatch("1", "10")).toBe(false);
    expect(labelsMatch("Q3", "3")).toBe(true);
  });
});

describe("mergeChunks", () => {
  it("keeps order and numbering across chunks", () => {
    const rows = mergeChunks([chunk([q("1"), q("2")]), chunk([q("3", { pages: [1] })], { offset: 11 })]);
    expect(rows.map((r) => [r.order_index, r.number_label])).toEqual([[0, "1"], [1, "2"], [2, "3"]]);
    expect(rows[2].source_pages).toEqual([11]); // page relative to chunk → absolute
    expect(rows.every((r) => !r.needs_review && r.answer_status === "pending")).toBe(true);
  });

  it("stitches a question split across chunks", () => {
    const rows = mergeChunks([
      chunk([q("1"), q("2", { text_md: "Part one", continues_on_next_page: true, pages: [10] })]),
      chunk([q("2", { text_md: "part two", continued_from_previous_page: true, pages: [1] }), q("3")], { offset: 11 }),
    ]);
    expect(rows.map((r) => r.number_label)).toEqual(["1", "2", "3"]);
    expect(rows[1].question_md).toBe("Part one\n\npart two");
    expect(rows[1].source_pages).toEqual([10, 11]);
  });

  it("adds a flagged placeholder for a question seen in the index but not extracted", () => {
    const rows = mergeChunks([chunk([q("1"), q("3")], { index: ["1", "2", "3"] })]);
    expect(rows.map((r) => r.number_label)).toEqual(["1", "2", "3"]);
    expect(rows[1]).toMatchObject({ needs_review: true, answer_status: "cannot_answer", question_md: "" });
    expect(rows[1].review_reason).toMatch(/could not be read/);
  });

  it("doesn't invent placeholders when a numbered question was split into sub-parts", () => {
    const rows = mergeChunks([chunk([q("4"), q("5(a)"), q("5(b)"), q("6")], { index: ["4", "5", "6"] })]);
    expect(rows.map((r) => r.number_label)).toEqual(["4", "5(a)", "5(b)", "6"]);
    expect(rows.some((r) => r.needs_review)).toBe(false);
  });

  it("flags gaps in numbering", () => {
    const rows = mergeChunks([chunk([q("6"), q("7"), q("9")])]);
    expect(rows.map((r) => r.number_label)).toEqual(["6", "7", "8", "9"]);
    expect(rows[2].review_reason).toMatch(/jumps from 7 to 9/);
  });

  it("treats a numbering restart in a new section as normal", () => {
    const rows = mergeChunks([chunk([q("1"), q("2"), q("1", { section: "Section B" }), q("2", { section: "Section B" })])]);
    expect(rows).toHaveLength(4);
    expect(rows.some((r) => r.needs_review)).toBe(false);
  });

  it("flags low-confidence questions but still sends them to the solver", () => {
    const rows = mergeChunks([chunk([q("1", { confidence: "low", issues: ["Figure is blurred"] })])]);
    expect(rows[0]).toMatchObject({ needs_review: true, answer_status: "pending", review_source: "extraction" });
    expect(rows[0].review_reason).toContain("Figure is blurred");
  });

  it("records unreadable regions as flagged rows", () => {
    const rows = mergeChunks([chunk([q("1"), q("2", { pages: [2] })], { unreadable: [{ page: 1, description: "torn corner" }] })]);
    expect(rows.map((r) => r.number_label)).toEqual(["1", "Unreadable (page 1)", "2"]);
    expect(rows[1].review_reason).toContain("torn corner");
  });

  it("attaches an unreadable region that names an existing question instead of duplicating it", () => {
    const rows = mergeChunks([chunk([q("1"), q("2", { confidence: "low", issues: ["stained"] }), q("3")], {
      unreadable: [{ page: 1, description: "Question 2 is covered by a dark smudge." }],
    })]);
    expect(rows.map((r) => r.number_label)).toEqual(["1", "2", "3"]);
    expect(rows[1].review_reason).toContain("covered by a dark smudge");
  });

  it("carries the section into a chunk that starts mid-section", () => {
    const rows = mergeChunks([
      chunk([q("7", { section: "Section B" })]),
      chunk([q("8", { section: null }), q("9", { section: null }), q("10", { section: "Section C" }), q("11", { section: null })], { offset: 11 }),
    ]);
    expect(rows.map((r) => r.section)).toEqual(["Section B", "Section B", "Section B", "Section C", null]);
  });

  it("flags questions whose image couldn't be read", () => {
    const rows = mergeChunks([chunk([q("1", { image_refs: ["img2"], has_diagram: true })])], ["img2"]);
    expect(rows[0].needs_review).toBe(true);
    expect(rows[0].review_reason).toMatch(/format that can't be read/);
  });

  it("keeps MCQ options and match columns", () => {
    const rows = mergeChunks([chunk([
      q("1", { type: "mcq", options: [{ label: "A", text: "4" }, { label: "B", text: "5" }] }),
      q("2", { type: "match", match_left: ["Dog"], match_right: ["Bark"] }),
    ])]);
    expect(rows[0].options).toHaveLength(2);
    expect(rows[1].match_pairs).toEqual({ left: ["Dog"], right: ["Bark"] });
  });
});

describe("answer matching", () => {
  const sq = (id: string): SolvableQuestion => ({
    id, number_label: id, section: null, type: "mcq", context_md: null, question_md: "x", options: [{ label: "A", text: "1" }],
    match_pairs: null, has_diagram: false, diagram_description: null, image_refs: [], source_pages: [1], marks: null, review_reason: null,
  });
  const ans = (id: string) => ({ question_id: id, status: "answered" as const, correct_option: "A", answer_short: "A", answer_md: "A", explanation_md: "", final_answer: null, confidence: "high" as const, review_reason: null });

  it("matches by id regardless of order, ignores unknown ids, reports missing", () => {
    const { matched, missing } = matchAnswers(["a", "b", "c"], { answers: [ans("c"), ans("zzz"), ans("a")] });
    expect([...matched.keys()].sort()).toEqual(["a", "c"]);
    expect(missing).toEqual(["b"]);
  });

  it("renders a batch with ids and options", () => {
    const text = renderBatch([sq("q1")]);
    expect(text).toContain('<question id="q1">');
    expect(text).toContain("(A) 1");
  });

  it("shrinks batches after failures", () => {
    expect(batchSize("detailed", 0)).toBe(6);
    expect(batchSize("detailed", 1)).toBe(3);
    expect(batchSize("detailed", 5)).toBe(1);
    expect(batchSize("short", 0)).toBe(10);
  });
});

describe("review reasons", () => {
  const solved = (over: Partial<SolvedAnswer>): SolvedAnswer => ({
    question_id: "q", status: "answered", correct_option: null, answer_short: "x", answer_md: "x", explanation_md: "",
    final_answer: null, confidence: "high", review_reason: null, ...over,
  });

  it("doesn't repeat the same problem reported by transcription and the solver", () => {
    const u = answerUpdate(
      solved({ status: "cannot_answer", review_reason: "Question 3 refers to a figure, but no figure appears on the original page." }),
      { needs_review: true, review_source: "extraction", review_reason: "The question refers to a figure, but no figure appears on the page." },
    );
    expect(u.review_reason).toBe("The question refers to a figure, but no figure appears on the page.");
    expect(u.review_source).toBe("extraction");
  });

  it("adds a different solver concern to an extraction flag", () => {
    const u = answerUpdate(solved({ confidence: "medium", review_reason: "Option C may also be correct." }),
      { needs_review: true, review_source: "extraction", review_reason: "Faint print in option D." });
    expect(u.review_reason).toBe("Faint print in option D. Option C may also be correct.");
  });

  it("clears an old solver flag when the new answer is confident", () => {
    const u = answerUpdate(solved({}), { needs_review: true, review_source: "solver", review_reason: "Unsure." });
    expect(u).toMatchObject({ needs_review: false, review_reason: null, review_source: null });
  });

  it("formats question labels", () => {
    expect(displayLabel("Q1")).toBe("1");
    expect(displayLabel("Question 5(b).")).toBe("5(b)");
    expect(displayLabel("II.3")).toBe("II.3");
    expect(questionHeading("Q.12")).toBe("Question 12");
    expect(questionHeading("Unreadable (page 2)")).toBe("Unreadable (page 2)");
  });
});

describe("LaTeX parser", () => {
  it("parses fractions, powers, roots and brackets", () => {
    expect(parseLatex("\\frac{3}{4}")).toEqual([{ t: "frac", num: [{ t: "text", v: "3" }], den: [{ t: "text", v: "4" }] }]);
    expect(parseLatex("2x^2")).toEqual([{ t: "text", v: "2" }, { t: "sup", base: [{ t: "text", v: "x" }], sup: [{ t: "text", v: "2" }] }]);
    expect(parseLatex("\\sqrt[3]{27}")[0]).toMatchObject({ t: "sqrt", degree: [{ t: "text", v: "3" }] });
    expect(parseLatex("\\left(a+b\\right)")[0]).toMatchObject({ t: "brackets", kind: "round" });
  });

  it("renders readable plain text", () => {
    expect(latexToPlain("x^2 + y^{3}")).toBe("x² + y³");
    expect(latexToPlain("\\frac{1}{2}")).toBe("1/2");
    expect(latexToPlain("60^{\\circ}")).toBe("60°");
    expect(latexToPlain("a_{n} \\times \\pi")).toBe("aₙ × π");
    expect(latexToPlain("\\text{Area} = \\sqrt{16}")).toBe("Area = √(16)");
  });

  it("never throws on malformed input", () => {
    expect(() => parseLatex("\\frac{1}{")).not.toThrow();
    expect(() => latexToPlain("}{^_\\")).not.toThrow();
  });
});

describe("answer sheet model", () => {
  const job = {
    id: "j", file_name: "Maths Paper.pdf", file_ext: "pdf", class_level: 7, board: "CBSE", subject: "Mathematics",
    exam_type: "school_exam", detail_level: "detailed", total_questions: 3,
  } as unknown as PublicJob;
  const base = {
    section: "Section A", type: "mcq", context_md: null, match_pairs: null, has_diagram: false, diagram_description: null,
    source_pages: [1], marks: 1, extraction_confidence: "high", review_source: null, answer_md: "B", explanation_md: "Because.",
    final_answer: null, answer_confidence: "high", edited_by_user: false, regen_count: 0, updated_at: "",
  };
  const questions = [
    { ...base, id: "2", order_index: 1, number_label: "2", question_md: "Q2", options: null, needs_review: true, review_reason: "Blurred", answer_status: "cannot_answer", answer_short: null, correct_option: null },
    { ...base, id: "1", order_index: 0, number_label: "1", question_md: "Q1", options: [{ label: "A", text: "3" }, { label: "B", text: "4" }], needs_review: false, review_reason: null, answer_status: "answered", answer_short: "B) 4", correct_option: "(B)" },
    { ...base, id: "3", order_index: 2, number_label: "1", section: "Section B", question_md: "Q1b", options: null, needs_review: false, review_reason: null, answer_status: "answered", answer_short: "x = 7", correct_option: null },
  ] as unknown as PublicQuestion[];

  it("orders questions, groups sections and builds the key and flagged list", () => {
    const sheet = buildSheet(job, questions, new Date("2026-11-11T10:00:00Z"));
    expect(sheet.sections.map((s) => [s.title, s.questions.map((x) => x.label)])).toEqual([["Section A", ["1", "2"]], ["Section B", ["1"]]]);
    expect(sheet.sections[0].questions[0].options.find((o) => o.correct)?.label).toBe("B");
    expect(sheet.answerKey.map((k) => k.answer)).toEqual(["B) 4", "Not answered (see review)", "x = 7"]);
    expect(sheet.flagged).toEqual([{ label: "Question 2", reason: "Blurred" }]);
    expect(sheet.stats).toEqual({ total: 3, answered: 2, flagged: 1 });
    expect(sheet.meta.find((m) => m.label === "Class")?.value).toBe("Class 7");
    expect(sheet.generatedOn).toBe("11 November 2026");
  });

  it("makes safe export names", () => {
    expect(exportFileName("Maths Paper (Final).pdf", "docx")).toBe("Maths-Paper-Final-solutions.docx");
    expect(exportFileName("../../.pdf", "pdf")).toBe("question-paper-solutions.pdf");
  });
});
