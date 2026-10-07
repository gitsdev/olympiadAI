import { describe, expect, it } from "vitest";
import { analyzeArticleSeo, combineAnalysis, type SeoReview } from "@/lib/seo-agent/agents/seo-analyst";
import { bodyTextWithoutHeadings, validateLinkSuggestions } from "@/lib/seo-agent/agents/internal-linker";
import { planLinkSync } from "@/lib/seo-agent/link-sync";
import { ctaCardHtml, withCtaCards } from "@/lib/seo-agent/cta";
import { inferClassAndSubject } from "@/lib/seo-agent/keywords";
import { DEFAULT_BRAND } from "@/lib/seo-agent/settings-schema";
import type { SeoCheck } from "@/lib/seo-agent/seo-checks";
import { FakeProvider } from "./helpers";

const review: SeoReview = {
  intentMatch: { score: 9, note: "Answers quickly." },
  completeness: { score: 8, note: "Covers topics and plan." },
  readability: { score: 8, note: "Clear." },
  ctaRelevance: { score: 7, note: "OK.", recommendedCta: "MOCK_TEST", reason: "Readers want practice." },
  overallQuality: { score: 9, note: "Useful." },
  recommendations: [
    { priority: "LOW", area: "TITLE", message: "Consider a shorter title." },
    { priority: "HIGH", area: "SEARCH_INTENT", message: "Answer what the exam is in the first paragraph." },
  ],
  factIssues: [],
};

describe("combineAnalysis (SEO score calculation)", () => {
  const meta = { fingerprint: "f", articleVersion: 3, currentCta: "BATTLE", model: "m", bodyText: "The IMO is held every year in December." };

  it("produces an internal 0–100 score with sorted recommendations and the CTA recommendation", () => {
    const a = combineAnalysis([], review, meta);
    expect(a.score).toBeGreaterThan(80);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.recommendations[0].priority).toBe("HIGH");
    expect(a.cta).toEqual({ current: "BATTLE", recommended: "MOCK_TEST", reason: "Readers want practice." });
    expect(a.critical).toEqual([]);
    expect(a.categories).toHaveLength(12);
  });

  it("matches fact-issue quotes against visible text, ignoring Markdown link syntax", () => {
    const linked = { ...meta, bodyText: "Warm up with [Number Ninja](/brain-booster/number-ninja) daily." };
    const r = combineAnalysis([], { ...review, factIssues: [{ excerpt: "Warm up with Number Ninja daily", issue: "x x x x x", kind: "UNVERIFIED_CLAIM", severity: "LOW" }] }, linked);
    expect(r.factIssues[0].foundInText).toBe(true);
  });

  it("treats HIGH-severity fact issues as critical and caps overall quality", () => {
    const withFact: SeoReview = { ...review, factIssues: [{ excerpt: "held every year in December", issue: "Exam month not verified.", kind: "COMPETITION_DETAIL", severity: "HIGH" }] };
    const clean = combineAnalysis([], review, meta);
    const flagged = combineAnalysis([], withFact, meta);
    expect(flagged.critical).toEqual(['Fact check: "held every year in December": Exam month not verified.']);
    expect(flagged.score).toBeLessThan(clean.score);
    expect(flagged.factIssues[0].foundInText).toBe(true);
  });

  it("treats failed meta/link/CTA checks as critical", () => {
    const checks: SeoCheck[] = [{ category: "CTA", status: "fail", message: "No CTA block in the article." }];
    expect(combineAnalysis(checks, review, meta).critical).toEqual(["No CTA block in the article."]);
  });
});

describe("analyzeArticleSeo (mocked AI)", () => {
  it("passes automatic findings and the no-ranking-promise rule to the reviewer", async () => {
    const ai = new FakeProvider([JSON.stringify(review)]);
    const a = await analyzeArticleSeo(ai, {
      checkInput: {
        title: "Tips", metaTitle: "", metaDescription: "", slug: "tips", excerpt: "", html: "<h2>One</h2><p>Some text here.</p>",
        primaryKeyword: "maths olympiad class 5", featuredImageUrl: "", featuredImageAlt: "", knownInternalPaths: new Set(),
      },
      prompt: { brand: DEFAULT_BRAND, article: { title: "Tips", metaTitle: "", metaDescription: "", primaryKeyword: "maths olympiad class 5", secondaryKeywords: [], searchIntent: null, targetAudience: null, ctaType: null }, ctaOptions: [], verifiedPages: [{ url: "/brain-booster/number-ninja", title: "Number Ninja (Brain Booster game)" }] },
    }, { fingerprint: "f", articleVersion: 1, currentCta: null });

    expect(ai.requests[0].system).toMatch(/not predicting Google rankings/);
    expect(ai.requests[0].prompt).toContain("Meta title is missing.");
    expect(ai.requests[0].prompt).toContain("## One");
    expect(ai.requests[0].prompt).toContain("Number Ninja (Brain Booster game)");
    expect(ai.requests[0].system).toMatch(/do not flag them/);
    expect(a.score).toBeLessThan(80); // missing meta, thin content, no CTA/links
    expect(a.critical.length).toBeGreaterThan(0);
  });
});

describe("validateLinkSuggestions (internal linking)", () => {
  const ctx = {
    bodyText: "Revise the Class 5 syllabus first, then warm up with mental maths games.",
    alreadyLinked: ["/blog/exam-tips"],
    candidates: [
      { url: "/blog/class-5-syllabus", title: "Syllabus", kind: "BLOG_POST" as const },
      { url: "/brain-booster/number-ninja", title: "Number Ninja", kind: "FEATURE_PAGE" as const },
      { url: "/blog/exam-tips", title: "Exam tips", kind: "BLOG_POST" as const },
    ],
  };

  it("keeps real, new pages whose anchor is in the text", () => {
    const r = validateLinkSuggestions([
      { url: "/blog/class-5-syllabus", anchorText: "Class 5 syllabus", reason: "Topic list." },
      { url: "https://www.olympiadiq.in/brain-booster/number-ninja", anchorText: "mental maths games", reason: "Practice." },
    ], ctx);
    expect(r.links).toEqual([
      { url: "/blog/class-5-syllabus", anchorText: "Class 5 syllabus", reason: "Topic list.", targetType: "ARTICLE" },
      { url: "/brain-booster/number-ninja", anchorText: "mental maths games", reason: "Practice.", targetType: "FEATURE_PAGE" },
    ]);
  });

  it("rejects headings and over-long anchors", () => {
    const bodyText = bodyTextWithoutHeadings("<h2>Topics That Commonly Appear in Class 5 Maths Olympiads</h2><p>Revise the Class 5 syllabus first.</p>");
    const r = validateLinkSuggestions([
      { url: "/blog/class-5-syllabus", anchorText: "Topics That Commonly Appear in Class 5 Maths Olympiads", reason: "x x x x x" },
      { url: "/blog/class-5-syllabus", anchorText: "Topics That Commonly Appear", reason: "x x x x x" },
      { url: "/blog/class-5-syllabus", anchorText: "Class 5 syllabus", reason: "Topic list." },
    ], { ...ctx, bodyText });
    expect(r.links.map((l) => l.anchorText)).toEqual(["Class 5 syllabus"]);
    expect(r.dropped).toHaveLength(2);
  });

  it("drops invented pages, already-linked pages, duplicates and anchors not in the text", () => {
    const r = validateLinkSuggestions([
      { url: "/blog/invented", anchorText: "Class 5 syllabus", reason: "x x x x x" },
      { url: "/blog/exam-tips", anchorText: "warm up", reason: "x x x x x" },
      { url: "/blog/class-5-syllabus", anchorText: "Olympiad syllabus PDF", reason: "x x x x x" },
    ], ctx);
    expect(r.links).toEqual([]);
    expect(r.dropped).toHaveLength(3);
  });
});

describe("planLinkSync", () => {
  const existing = [
    { id: "1", target_url: "/blog/a", status: "INSERTED", reason: "why a" },
    { id: "2", target_url: "/blog/b", status: "SUGGESTED", reason: "why b" },
    { id: "3", target_url: "/blog/c", status: "REJECTED", reason: null },
    { id: "4", target_url: "/blog/d", status: "SUGGESTED", reason: null },
  ];

  it("rebuilds body links, retires applied suggestions and keeps dismissals", () => {
    const p = planLinkSync(existing, [{ href: "/blog/a", text: "A" }, { href: "/blog/b", text: "B" }, { href: "/blog/a", text: "A again" }]);
    expect(p.deleteIds.sort()).toEqual(["1", "2"]);
    expect(p.insertInserted).toEqual([
      { url: "/blog/a", anchorText: "A", reason: "why a" },
      { url: "/blog/b", anchorText: "B", reason: "why b" },
    ]);
  });

  it("never re-suggests dismissed, pending or already-linked pages", () => {
    const p = planLinkSync(existing, [{ href: "/blog/a", text: "A" }], [
      { url: "/blog/c", anchorText: "c", reason: "r" },
      { url: "/blog/d", anchorText: "d", reason: "r" },
      { url: "/blog/a", anchorText: "a", reason: "r" },
      { url: "/blog/e", anchorText: "e", reason: "r" },
      { url: "/blog/e", anchorText: "e2", reason: "r" },
    ]);
    expect(p.insertSuggested.map((s) => s.url)).toEqual(["/blog/e"]);
  });
});

describe("CTA system", () => {
  it("renders reusable CTA cards with the right destination and drops unknown types", () => {
    const html = withCtaCards('<p>x</p><div data-cta="BRAIN_BOOSTER"></div><div data-cta="FAKE"></div>');
    expect(html).toContain('href="/brain-booster"');
    expect(html).toContain("Brain Booster Games");
    expect(html).not.toContain("FAKE");
    expect(ctaCardHtml("MOCK_TEST")).toContain('href="/signup"');
  });
});

describe("inferClassAndSubject", () => {
  it.each([
    ["maths olympiad class 5", 5, "Mathematics"],
    ["NSO class 10 sample paper", 10, "Science"],
    ["IEO preparation tips", null, "English"],
    ["olympiad study plan", null, null],
    ["class 15 maths", null, "Mathematics"],
  ])("%s → %s / %s", (text, cls, subject) => {
    expect(inferClassAndSubject(text)).toEqual({ targetClass: cls, subject });
  });
});
