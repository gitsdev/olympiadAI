import { describe, expect, it } from "vitest";
import { articleSaveSchema, differsFromVersion, EDITABLE_ARTICLE_STATUSES, versionMetadata } from "@/lib/seo-agent/articles";

const valid = { title: "Class 5 Guide", slug: "class-5-guide", contentHtml: "<p>x</p>", category: "Olympiad Prep" };

describe("articleSaveSchema", () => {
  it("accepts a minimal save and fills defaults", () => {
    expect(articleSaveSchema.parse(valid)).toMatchObject({ metaTitle: "", featuredImageUrl: "", ctaType: null });
  });

  it.each([
    ["uppercase slug", { slug: "Class-5" }],
    ["slug with spaces", { slug: "class 5" }],
    ["double hyphen slug", { slug: "class--5" }],
    ["http image", { featuredImageUrl: "http://x.example/a.png" }],
    ["unknown category", { category: "Gossip" }],
    ["unknown CTA", { ctaType: "NEWSLETTER" }],
  ])("rejects %s", (_l, patch) => {
    expect(articleSaveSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe("versioning helpers (§13)", () => {
  const meta = versionMetadata({ slug: "a", metaTitle: "m", metaDescription: null, excerpt: null, featuredImageUrl: null, featuredImageAlt: null, category: "Olympiad Prep", ctaType: "MOCK_TEST" });
  const version = { title: "T", content_html: "<p>x</p>", metadata: meta };

  it("detects no change against the last version", () => {
    expect(differsFromVersion({ title: "T", contentHtml: "<p>x</p>", metadata: { ...meta } }, version)).toBe(false);
  });

  it("detects title, body and metadata changes", () => {
    expect(differsFromVersion({ title: "T2", contentHtml: "<p>x</p>", metadata: meta }, version)).toBe(true);
    expect(differsFromVersion({ title: "T", contentHtml: "<p>y</p>", metadata: meta }, version)).toBe(true);
    expect(differsFromVersion({ title: "T", contentHtml: "<p>x</p>", metadata: { ...meta, metaTitle: "new" } }, version)).toBe(true);
  });

  it("treats a missing previous version as a change", () => {
    expect(differsFromVersion({ title: "T", contentHtml: "", metadata: {} }, null)).toBe(true);
  });

  it("locks editing once an article is approved, scheduled or published", () => {
    for (const s of ["APPROVED", "SCHEDULED", "PUBLISHED", "GENERATING", "ARCHIVED"]) expect(EDITABLE_ARTICLE_STATUSES).not.toContain(s);
    for (const s of ["DRAFT", "REVIEW", "REVIEW_REQUIRED"]) expect(EDITABLE_ARTICLE_STATUSES).toContain(s);
  });
});
