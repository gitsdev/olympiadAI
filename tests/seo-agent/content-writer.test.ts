import { describe, expect, it } from "vitest";
import { articleDraftSchema, postProcessArticle, writeArticle, type ArticleDraft } from "@/lib/seo-agent/agents/content-writer";
import { extractCtas, extractLinks } from "@/lib/seo-agent/article-html";
import { DEFAULT_BRAND } from "@/lib/seo-agent/settings-schema";
import { FakeProvider } from "./helpers";

const body = [
  "Preparing for the maths Olympiad in Class 5 is easier with a clear plan. This guide covers topics, a study plan and practice tips.",
  "## What the exam tests",
  "Olympiad papers test reasoning as well as school maths. " + "Practise word problems and patterns regularly. ".repeat(12),
  "Revise with our [Class 5 syllabus guide](/blog/class-5-maths-olympiad-syllabus) and warm up with [Number Ninja](/brain-booster/number-ninja).",
  "## A six-week plan",
  "| Week | Focus |\n|---|---|\n| 1–2 | Numbers and operations |\n| 3–4 | Geometry and measurement |\n| 5–6 | Mock tests and revision |",
  "[[CTA]]",
  "## Conclusion",
  "Steady practice beats last-minute cramming. " + "Keep a mistake notebook and review it weekly. ".repeat(10),
].join("\n\n");

const draft: ArticleDraft = {
  title: "Class 5 Maths Olympiad: Complete Preparation Guide",
  slug: "Class 5 Maths Olympiad Preparation Guide!",
  metaTitle: "Class 5 Maths Olympiad: Preparation Guide and Tips",
  metaDescription: "Prepare for the Class 5 Maths Olympiad with a clear topic list, a six-week study plan, worked examples and practical tips for students and parents.",
  excerpt: "A practical guide to preparing for the Class 5 Maths Olympiad.",
  bodyMarkdown: body,
  ctaType: "MOCK_TEST",
  featuredImagePrompt: "A friendly flat illustration of a child solving maths puzzles at a desk, no text.",
  featuredImageAlt: "Child solving maths puzzles",
  needsVerification: ["Confirm the current IMO paper pattern on the official SOF website."],
};
const allowed = ["/blog/class-5-maths-olympiad-syllabus", "/brain-booster/number-ninja"];

describe("postProcessArticle (article generation validation)", () => {
  it("produces sanitized HTML with the CTA block where the writer put the marker", () => {
    const a = postProcessArticle(draft, allowed);
    expect(a.slug).toBe("class-5-maths-olympiad-preparation-guide");
    expect(extractCtas(a.contentHtml)).toEqual(["MOCK_TEST"]);
    expect(a.contentHtml.indexOf('data-cta')).toBeLessThan(a.contentHtml.indexOf("Conclusion"));
    expect(extractLinks(a.contentHtml).map((l) => l.href)).toEqual(allowed);
    expect(a.qualityFlags).toEqual([{ kind: "VERIFY_CLAIM", message: "Confirm the current IMO paper pattern on the official SOF website." }]);
    expect(a.wordCount).toBeGreaterThan(150);
  });

  it("adds the CTA at the end and flags it when the marker is missing", () => {
    const a = postProcessArticle({ ...draft, bodyMarkdown: body.replace("[[CTA]]", "") }, allowed);
    expect(a.contentHtml.trim().endsWith('<div data-cta="MOCK_TEST"></div>')).toBe(true);
    expect(a.qualityFlags.map((f) => f.kind)).toContain("CTA_ADDED");
  });

  it("removes invented internal links and flags external ones", () => {
    const md = body + "\n\nSee [secret tricks](/blog/secret-tricks) and [SOF](https://sofworld.org).";
    const a = postProcessArticle({ ...draft, bodyMarkdown: md }, allowed);
    expect(extractLinks(a.contentHtml).map((l) => l.href)).not.toContain("/blog/secret-tricks");
    expect(a.qualityFlags.map((f) => f.kind)).toEqual(expect.arrayContaining(["REMOVED_LINK", "EXTERNAL_LINK"]));
  });

  it("rejects drafts that are too thin or have no meta description", () => {
    expect(articleDraftSchema.safeParse({ ...draft, bodyMarkdown: "Too short." }).success).toBe(false);
    expect(articleDraftSchema.safeParse({ ...draft, metaDescription: "" }).success).toBe(false);
  });
});

describe("writeArticle (mocked AI)", () => {
  it("passes plan, allowed links and the quality rules to the writer", async () => {
    const ai = new FakeProvider([JSON.stringify(draft)]);
    const a = await writeArticle(ai, {
      brand: DEFAULT_BRAND,
      plan: { title: draft.title, primaryKeyword: "maths olympiad class 5", secondaryKeywords: [], searchIntent: "INFORMATIONAL",
        contentType: "GUIDE", targetAudience: "STUDENTS_AND_PARENTS", outline: [{ heading: "What the exam tests", points: ["Reasoning"] }], notes: null },
      cta: { type: "MOCK_TEST", label: "Free Unlimited Mock Tests", description: "x", path: "/signup" } as never,
      internalLinks: allowed.map((url) => ({ url, anchorText: "x", reason: "y" })),
      existingTitles: ["Class 5 Maths Olympiad Syllabus"],
    });
    expect(a.title).toBe(draft.title);
    const sys = ai.requests[0].system;
    expect(sys).toMatch(/Do not keyword stuff/);
    expect(sys).toMatch(/Do not invent statistics/);
    expect(sys).toMatch(/Never invent search volumes/);
    expect(ai.requests[0].prompt).toContain("[[CTA]]");
    expect(ai.requests[0].prompt).toContain("/brain-booster/number-ninja");
    expect(ai.requests[0].maxOutputTokens).toBe(32000);
  });
});
