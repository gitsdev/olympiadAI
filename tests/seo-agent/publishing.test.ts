import { describe, expect, it } from "vitest";
import {
  canTransition, parseSchedule, planStatusFor, textSimilarity, validateForPublish,
  type PublishCandidate, type PublishContext,
} from "@/lib/seo-agent/publishing/rules";
import { articleHtmlToBlogMarkdown } from "@/lib/seo-agent/publishing/markdown";
import { verifyBearer } from "@/lib/seo-agent/publishing/auth";
import { looksLikeImage } from "@/lib/seo-agent/publishing/publisher";

describe("workflow transitions (article approval)", () => {
  it("only approves drafts and reviewed articles, and only publishes approved/scheduled ones", () => {
    expect(canTransition("DRAFT", "APPROVE")).toBe(true);
    expect(canTransition("REVIEW_REQUIRED", "APPROVE")).toBe(true);
    expect(canTransition("PUBLISHED", "APPROVE")).toBe(false);
    expect(canTransition("DRAFT", "PUBLISH")).toBe(false);
    expect(canTransition("REVIEW", "PUBLISH")).toBe(false);
    expect(canTransition("APPROVED", "PUBLISH")).toBe(true);
    expect(canTransition("SCHEDULED", "PUBLISH")).toBe(true);
    expect(canTransition("DRAFT", "SCHEDULE")).toBe(false);
    expect(canTransition("SCHEDULED", "WITHDRAW_APPROVAL")).toBe(true);
  });

  it("mirrors article status onto the content plan", () => {
    expect(planStatusFor("REVIEW_REQUIRED")).toBe("REVIEW");
    expect(planStatusFor("SCHEDULED")).toBe("SCHEDULED");
    expect(planStatusFor("GENERATING")).toBeNull();
  });
});

describe("parseSchedule (scheduling in Asia/Kolkata)", () => {
  const now = new Date("2026-10-07T12:00:00Z"); // 17:30 IST

  it("converts tomorrow 10:00 IST to UTC", () => {
    const r = parseSchedule("2026-10-08", "10:00", "Asia/Kolkata", now);
    expect(r).toEqual({ ok: true, at: new Date("2026-10-08T04:30:00.000Z") });
  });

  it("rejects the past, the next few minutes and malformed input", () => {
    expect(parseSchedule("2026-10-07", "17:00", "Asia/Kolkata", now).ok).toBe(false); // 30 min ago
    expect(parseSchedule("2026-10-07", "17:32", "Asia/Kolkata", now).ok).toBe(false); // < 5 min lead
    expect(parseSchedule("2026-10-07", "17:40", "Asia/Kolkata", now).ok).toBe(true);
    expect(parseSchedule("08/10/2026", "10:00", "Asia/Kolkata", now).ok).toBe(false);
    expect(parseSchedule("2028-01-01", "10:00", "Asia/Kolkata", now).ok).toBe(false); // > 1 year
  });
});

describe("textSimilarity (duplicate-content check)", () => {
  const a = "Preparing for the maths olympiad in class five needs a steady plan with daily practice and weekly mock tests";
  it("scores identical text 1, unrelated text ~0, and partial overlap in between", () => {
    expect(textSimilarity(a, a)).toBe(1);
    expect(textSimilarity(a, "Science fairs reward curiosity and careful observation of the natural world around us")).toBe(0);
    const partial = textSimilarity(a, `${a} plus extra revision of fractions decimals and geometry every single weekend morning`);
    expect(partial).toBeGreaterThan(0.3);
    expect(partial).toBeLessThan(1);
  });
});

const ok: PublishCandidate = {
  status: "APPROVED", title: "Maths Olympiad Class 5 Guide", slug: "maths-olympiad-class-5", metaTitle: "Maths Olympiad Class 5: Guide",
  metaDescription: "A practical guide.", excerpt: "A guide.", category: "Olympiad Prep", wordCount: 1500, ctaCount: 1,
  featuredImageUrl: "https://cdn.example/a.png", featuredImageAlt: "Child solving puzzles",
  approvedAt: "2026-10-07T10:00:00Z", approvedBy: "admin-1", internalLinks: ["/blog/syllabus", "/brain-booster"],
  seo: { score: 92, critical: [], stale: false },
};
const ctx: PublishContext = {
  mode: "MANUAL_APPROVAL", knownPaths: new Set(["/blog/syllabus", "/brain-booster"]),
  slugOwner: null, closestExisting: { title: "Other", slug: "other", similarity: 0.05 }, titleClash: null,
};

describe("validateForPublish (publishing authorization + §21 checks)", () => {
  it("passes a complete, approved article", () => {
    expect(validateForPublish(ok, ctx)).toEqual({ errors: [], warnings: [] });
  });

  it("never publishes without an approval record in manual mode", () => {
    const r = validateForPublish({ ...ok, approvedAt: null, approvedBy: null }, ctx);
    expect(r.errors.map((e) => e.code)).toEqual(["NOT_APPROVED"]);
  });

  it("allows auto-publish without approval but requires a fresh, clean SEO check", () => {
    const auto = { ...ctx, mode: "AUTO_PUBLISH" as const };
    expect(validateForPublish({ ...ok, approvedAt: null, approvedBy: null }, auto).errors).toEqual([]);
    expect(validateForPublish({ ...ok, seo: null }, auto).errors.map((e) => e.code)).toEqual(["NO_SEO_CHECK"]);
    expect(validateForPublish({ ...ok, seo: { score: 80, critical: ["Fact check: x"], stale: false } }, auto).errors.map((e) => e.code)).toEqual(["SEO_CRITICAL"]);
    expect(validateForPublish({ ...ok, seo: { score: 80, critical: [], stale: true } }, auto).errors.map((e) => e.code)).toEqual(["SEO_STALE"]);
    // Manual mode trusts the approver and only warns.
    expect(validateForPublish({ ...ok, seo: null }, ctx).warnings.map((w) => w.code)).toEqual(["NO_SEO_CHECK"]);
  });

  it("blocks missing fields, taken slugs, broken links, bad images and duplicates", () => {
    const r = validateForPublish(
      { ...ok, metaTitle: "", excerpt: " ", slug: "Bad Slug", wordCount: 120, internalLinks: ["/blog/gone"], featuredImageUrl: "http://x/a.png", featuredImageAlt: "" },
      { ...ctx, slugOwner: { blogPostId: "p1", isOwnPost: false }, closestExisting: { title: "Twin", slug: "twin", similarity: 0.8 }, titleClash: "Maths Olympiad Class 5 Guide" },
    );
    expect(r.errors.map((e) => e.code).sort()).toEqual(
      ["BROKEN_LINKS", "CONTENT", "DUPLICATE_CONTENT", "DUPLICATE_TITLE", "EXCERPT", "IMAGE_ALT", "IMAGE_URL", "META_TITLE", "SLUG", "SLUG_TAKEN"].sort(),
    );
  });

  it("lets an article re-publish over its own blog post", () => {
    expect(validateForPublish(ok, { ...ctx, slugOwner: { blogPostId: "p1", isOwnPost: true } }).errors).toEqual([]);
  });

  it("warns (doesn't block) on no image, no CTA and partial overlap", () => {
    const r = validateForPublish({ ...ok, featuredImageUrl: null, ctaCount: 0 }, { ...ctx, closestExisting: { title: "T", slug: "t", similarity: 0.3 } });
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code).sort()).toEqual(["NO_CTA", "NO_IMAGE", "SIMILAR_CONTENT"]);
  });
});

describe("articleHtmlToBlogMarkdown (publishing format)", () => {
  const html = '<h2>Plan</h2><p>Use <strong>daily</strong> practice and <a href="/brain-booster">Brain Booster Games</a>.</p>'
    + "<ul><li><p>One</p></li><li><p>Two</p></li></ul>"
    + "<table><tbody><tr><th><p>Week</p></th><th><p>Focus</p></th></tr><tr><td><p>1</p></td><td><p>Numbers</p></td></tr></tbody></table>"
    + '<div data-cta="MOCK_TEST"></div><p>End.</p><script>alert(1)</script>';
  const md = articleHtmlToBlogMarkdown(html);

  it("produces GFM the blog renders: headings, bold, links, lists and tables", () => {
    expect(md).toContain("## Plan");
    expect(md).toContain("**daily**");
    expect(md).toContain("[Brain Booster Games](/brain-booster)");
    expect(md).toMatch(/^- One$/m);
    expect(md).toMatch(/\| Week \| Focus +\|\n\| -+ \| -+ \|\n\| 1 +\| Numbers \|/); // columns are padded
  });

  it("turns a CTA block into headline, text and a stand-alone button link", () => {
    expect(md).toContain("**Practise with free Olympiad mock tests**");
    // A paragraph that is only a link renders as a button on the blog.
    expect(md).toMatch(/^\[Start a free mock test\]\(\/signup\)$/m);
  });

  it("never carries scripts or raw HTML into the blog", () => {
    expect(md).not.toMatch(/<script|alert\(1\)|<div/);
  });
});

describe("verifyBearer (publishing API authorization)", () => {
  const secret = "s3cret-value-that-is-long-enough";
  it("accepts only the exact bearer secret", () => {
    expect(verifyBearer(`Bearer ${secret}`, secret)).toBe(true);
    expect(verifyBearer(`Bearer ${secret}x`, secret)).toBe(false);
    expect(verifyBearer(secret, secret)).toBe(false);
    expect(verifyBearer(null, secret)).toBe(false);
  });

  it("fails closed when the secret is missing or weak", () => {
    expect(verifyBearer("Bearer anything", undefined)).toBe(false);
    expect(verifyBearer("Bearer short", "short")).toBe(false);
  });
});

describe("image validation", () => {
  it("checks magic bytes against the declared type", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
    expect(looksLikeImage(png, "image/png")).toBe(true);
    expect(looksLikeImage(jpg, "image/jpeg")).toBe(true);
    expect(looksLikeImage(webp, "image/webp")).toBe(true);
    expect(looksLikeImage(png, "image/jpeg")).toBe(false);
    expect(looksLikeImage(new Uint8Array(Buffer.from("<svg onload=alert(1)>")), "image/png")).toBe(false);
  });
});
