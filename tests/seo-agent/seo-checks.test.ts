import { describe, expect, it } from "vitest";
import {
  articleFingerprint, categoryScores, contentFingerprint, keywordMatch, overallScore, runDeterministicChecks, textStats,
  SEO_CATEGORIES, SEO_WEIGHTS, type SeoCheckInput,
} from "@/lib/seo-agent/seo-checks";

const para = (n: number) => Array.from({ length: n }, (_, i) => `Practice sentence number ${i + 1} keeps things short.`).join(" ");

const goodHtml = [
  "<p>Preparing for the maths olympiad class 5 is simpler with a plan. " + para(4) + "</p>",
  "<h2>What the maths olympiad class 5 tests</h2><p>" + para(6) + ' See the <a href="/blog/class-5-syllabus">Class 5 syllabus</a>.</p>',
  "<h2>A six-week plan</h2><p>" + para(6) + ' Warm up with <a href="/brain-booster">Brain Booster Games</a>.</p>',
  '<div data-cta="MOCK_TEST"></div>',
  "<h2>Conclusion</h2><p>" + para(4) + "</p>",
  ...Array.from({ length: 26 }, (_, i) => `<h3>Tip ${i + 1}</h3><p>${para(5)}</p>`),
].join("");

const good: SeoCheckInput = {
  title: "Maths Olympiad Class 5: Complete Preparation Guide",
  metaTitle: "Maths Olympiad Class 5: Preparation Guide and Tips",
  metaDescription: "Prepare for the maths olympiad class 5 with a clear topic list, a six-week study plan, worked examples and practical tips for students and parents.",
  slug: "maths-olympiad-class-5",
  excerpt: "A practical guide.",
  html: goodHtml,
  primaryKeyword: "maths olympiad class 5",
  featuredImageUrl: "https://cdn.example/a.png",
  featuredImageAlt: "Child solving puzzles",
  knownInternalPaths: new Set(["/blog/class-5-syllabus", "/brain-booster"]),
};

describe("keywordMatch", () => {
  it("finds exact phrases and reordered words, ignoring case and punctuation", () => {
    expect(keywordMatch("Maths Olympiad Class 5: Guide", "maths olympiad class 5")).toBe("exact");
    expect(keywordMatch("Class 5 Maths Olympiad guide", "maths olympiad class 5")).toBe("partial");
    expect(keywordMatch("Science olympiad tips", "maths olympiad class 5")).toBe("none");
  });
});

describe("textStats", () => {
  it("measures words, sentence length and keyword density", () => {
    const s = textStats("<p>Maths olympiad class 5 is fun. Maths olympiad class 5 is hard.</p>", "maths olympiad class 5");
    expect(s.words).toBe(12);
    expect(s.sentences).toBe(2);
    expect(s.keywordCount).toBe(2);
    expect(s.keywordDensity).toBeCloseTo(66.7, 0);
  });
});

describe("runDeterministicChecks (SEO score calculation inputs)", () => {
  it("passes a well-formed article", () => {
    const checks = runDeterministicChecks(good);
    const problems = checks.filter((c) => c.status !== "pass");
    expect(problems).toEqual([]);
  });

  it("catches the common problems", () => {
    const bad: SeoCheckInput = {
      ...good,
      title: "Tips",
      metaTitle: "",
      metaDescription: "x".repeat(200),
      slug: "tips",
      excerpt: "",
      featuredImageUrl: "",
      html: "<h1>Again a title</h1><p>maths olympiad class 5 maths olympiad class 5 maths olympiad class 5 short.</p>"
        + '<h3>Skipped level</h3><p><a href="/blog/does-not-exist">x</a></p>',
    };
    const msgs = runDeterministicChecks(bad).filter((c) => c.status !== "pass").map((c) => `${c.category}:${c.status}`);
    expect(msgs).toEqual(expect.arrayContaining([
      "TITLE:warn", "META_TITLE:fail", "META_DESCRIPTION:fail", "HEADINGS:warn", "HEADINGS:fail",
      "KEYWORD_USAGE:fail", "COMPLETENESS:fail", "INTERNAL_LINKING:fail", "CTA:fail", "OVERALL_QUALITY:warn",
    ]));
  });
});

describe("score composition", () => {
  it("weights sum to 100 and a perfect article scores 100", () => {
    expect(SEO_CATEGORIES.reduce((s, c) => s + SEO_WEIGHTS[c], 0)).toBe(100);
    const perfect = categoryScores([], Object.fromEntries(SEO_CATEGORIES.map((c) => [c, 10])));
    expect(overallScore(perfect)).toBe(100);
  });

  it("blends a failing check with the AI's judgement (40/60)", () => {
    const s = categoryScores([{ category: "SEARCH_INTENT", status: "fail", message: "" }], { SEARCH_INTENT: 10 });
    expect(s.SEARCH_INTENT).toBeCloseTo(0.6);
    expect(categoryScores([{ category: "TITLE", status: "warn", message: "" }], {}).TITLE).toBeCloseTo(0.6);
  });

  it("drops the score when required items are missing", () => {
    // The AI only judges these five categories; the rest are measured.
    const aiPerfect = { SEARCH_INTENT: 10, COMPLETENESS: 10, READABILITY: 10, CTA: 10, OVERALL_QUALITY: 10 };
    expect(overallScore(categoryScores(runDeterministicChecks(good), aiPerfect))).toBe(100);
    const checks = runDeterministicChecks({ ...good, metaTitle: "", metaDescription: "", html: good.html.replace(/<div data-cta="MOCK_TEST"><\/div>/, "") });
    expect(overallScore(categoryScores(checks, aiPerfect))).toBe(84); // −7 meta title, −7 meta description, −2.4 CTA
  });
});

describe("fingerprints", () => {
  it("are stable and change with content", () => {
    expect(contentFingerprint("a", "b")).toBe(contentFingerprint("a", "b"));
    expect(contentFingerprint("a", "b")).not.toBe(contentFingerprint("ab", ""));
    const row = { title: "T", slug: "s", meta_title: null, meta_description: null, excerpt: null, content_html: "<p>x</p>", featured_image_url: null, featured_image_alt: null, cta_type: null };
    expect(articleFingerprint(row)).not.toBe(articleFingerprint({ ...row, content_html: "<p>y</p>" }));
  });
});
