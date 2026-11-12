// Admin usage analytics for the Question Paper Solver.

import { describe, expect, it } from "vitest";
import { bucketOf, estimateCostUsd, summarizeQps, type QpsJobLite } from "@/lib/admin/question-paper-stats";

let n = 0;
function job(over: Partial<QpsJobLite>): QpsJobLite {
  n++;
  return {
    id: `j${n}`, user_id: "u1", status: "completed", file_ext: "pdf", is_scanned: false, page_count: 2,
    class_level: 7, board: "CBSE", subject: "Mathematics", exam_type: "school_exam", detail_level: "short",
    total_questions: 10, solved_questions: 10, flagged_questions: 1, ai_model: "claude-opus-5-5",
    ai_input_tokens: 100_000, ai_output_tokens: 20_000,
    created_at: "2026-11-10T10:00:00", started_at: "2026-11-10T10:00:00", completed_at: "2026-11-10T10:04:00",
    ...over,
  };
}

describe("bucketOf", () => {
  it("separates failures during processing from rejected and abandoned uploads", () => {
    expect(bucketOf({ status: "completed", started_at: "x" })).toBe("completed");
    expect(bucketOf({ status: "solving", started_at: "x" })).toBe("processing");
    expect(bucketOf({ status: "failed", started_at: "x" })).toBe("failed");
    expect(bucketOf({ status: "failed", started_at: null })).toBe("rejected");
    expect(bucketOf({ status: "awaiting_upload", started_at: null })).toBe("abandoned");
    expect(bucketOf({ status: "cancelled", started_at: null })).toBe("abandoned");
  });
});

describe("estimateCostUsd", () => {
  it("uses list prices and refuses to guess for unknown models", () => {
    expect(estimateCostUsd("claude-opus-5-5", 1_000_000, 1_000_000)).toBe(24);
    expect(estimateCostUsd("mystery-model", 10, 10)).toBeNull();
    expect(estimateCostUsd(null, 0, 0)).toBe(0);
  });
});

describe("summarizeQps", () => {
  const from = new Date(2026, 10, 8);
  const to = new Date(2026, 10, 11, 23, 59, 59);
  const jobs = [
    job({}),
    job({ user_id: "u2", subject: "Science", file_ext: "docx", detail_level: "detailed", total_questions: 20, flagged_questions: 3, completed_at: "2026-11-10T10:08:00" }),
    job({ status: "failed", completed_at: null, total_questions: 0, flagged_questions: 0, ai_input_tokens: 5_000, ai_output_tokens: 0 }),
    job({ status: "failed", started_at: null, completed_at: null, total_questions: 0, flagged_questions: 0, ai_input_tokens: 0, ai_output_tokens: 0 }),
    job({ status: "awaiting_upload", started_at: null, completed_at: null, total_questions: 0, flagged_questions: 0, ai_input_tokens: 0, ai_output_tokens: 0, created_at: "2026-11-09T09:00:00" }),
  ];
  const s = summarizeQps(jobs, [
    { user_id: "u1", kind: "regenerate_answer", created_at: "2026-11-10T11:00:00" },
    { user_id: "u1", kind: "regenerate_answer", created_at: "2026-11-10T11:05:00" },
    { user_id: "u2", kind: "regenerate_sheet", created_at: "2026-11-10T12:00:00" },
  ], from, to);

  it("counts outcomes", () => {
    expect(s.buckets).toEqual({ completed: 2, processing: 0, failed: 1, rejected: 1, abandoned: 1 });
    expect(s.submitted).toBe(3);
    expect(s.uniqueUsers).toBe(2);
    expect(s.successRate).toBeCloseTo(2 / 3);
  });

  it("totals questions, flags, time and regenerations", () => {
    expect(s.questions).toBe(30);
    expect(s.flagged).toBe(4);
    expect(s.flaggedRate).toBeCloseTo(4 / 30);
    expect(s.avgQuestionsPerPaper).toBe(15);
    expect(s.medianMinutes).toBe(6); // 4 and 8 minutes
    expect(s.regenerations).toEqual({ answers: 2, sheets: 1 });
  });

  it("estimates AI cost from recorded tokens", () => {
    // 2 × (100k in, 20k out) + 5k in, at $4 / $20 per M
    expect(s.inputTokens).toBe(205_000);
    expect(s.outputTokens).toBe(40_000);
    expect(s.estimatedCostUsd).toBeCloseTo(0.82 + 0.8);
    expect(s.costPerPaperUsd).toBeCloseTo((0.82 + 0.8) / 2);
  });

  it("builds a zero-filled daily series of submitted papers", () => {
    expect(s.series.map((d) => d.day)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(s.series.map((d) => d.papers)).toEqual([0, 0, 3, 0]); // the abandoned upload on the 9th isn't "submitted"
  });

  it("breaks down submitted papers and ranks users", () => {
    expect(s.breakdowns.subject).toEqual([{ label: "Mathematics", count: 2 }, { label: "Science", count: 1 }]);
    expect(s.breakdowns.format).toEqual([{ label: "Text PDF", count: 2 }, { label: "Word (.docx)", count: 1 }]);
    expect(s.topUsers[0]).toMatchObject({ userId: "u1", papers: 2, completed: 1 });
  });

  it("orders tied class counts numerically (Class 2 before Class 10)", () => {
    const t = summarizeQps([job({ class_level: 10 }), job({ class_level: 2 }), job({ class_level: 1 })], [], from, to);
    expect(t.breakdowns.classLevel.map((c) => c.label)).toEqual(["Class 1", "Class 2", "Class 10"]);
  });

  it("handles an empty period", () => {
    const e = summarizeQps([], [], from, to);
    expect(e.successRate).toBeNull();
    expect(e.medianMinutes).toBeNull();
    expect(e.estimatedCostUsd).toBe(0);
    expect(e.topUsers).toEqual([]);
  });
});
