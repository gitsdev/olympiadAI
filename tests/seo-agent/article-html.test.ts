import { describe, expect, it } from "vitest";
import {
  extractCtas, extractLinks, htmlToText, markdownToArticleHtml, sanitizeArticleHtml, wordCount,
} from "@/lib/seo-agent/article-html";

describe("sanitizeArticleHtml (§34)", () => {
  it.each([
    ['<p>Hi<script>alert(1)</script></p>', "<p>Hi</p>"],
    ['<p onclick="steal()">Hi</p>', "<p>Hi</p>"],
    ['<p style="color:red">Hi</p>', "<p>Hi</p>"],
    ['<a href="javascript:alert(1)">x</a>', "<a>x</a>"],
    ['<img src="http://insecure.example/a.png" alt="a">', '<img alt="a">'],
    ['<iframe src="https://evil.example"></iframe><p>ok</p>', "<p>ok</p>"],
    ['<style>p{}</style><p>ok</p>', "<p>ok</p>"],
  ])("removes dangerous markup: %s", (input, expected) => {
    expect(sanitizeArticleHtml(input)).toBe(expected);
  });

  it("keeps the formatting the editor produces", () => {
    const html = '<h2>Plan</h2><p><strong>Bold</strong> <em>it</em> <a href="/blog/x">link</a></p><ul><li><p>one</p></li></ul>'
      + '<blockquote><p>q</p></blockquote><hr><img src="https://cdn.example/a.png" alt="Diagram">';
    expect(sanitizeArticleHtml(html)).toBe(html);
  });

  it("keeps TipTap tables but drops colgroup and inline styles", () => {
    const tiptap = '<table style="min-width: 75px"><colgroup><col style="min-width: 25px"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>Week</p></th></tr><tr><td colspan="1" rowspan="1"><p>1</p></td></tr></tbody></table>';
    expect(sanitizeArticleHtml(tiptap)).toBe('<table><tbody><tr><th colspan="1" rowspan="1"><p>Week</p></th></tr><tr><td colspan="1" rowspan="1"><p>1</p></td></tr></tbody></table>');
  });

  it("keeps valid CTA blocks and unwraps any other div", () => {
    expect(sanitizeArticleHtml('<div data-cta="MOCK_TEST"></div>')).toBe('<div data-cta="MOCK_TEST"></div>');
    expect(sanitizeArticleHtml('<div data-cta="MOCK_TEST"><p>smuggled</p></div>')).toBe('<div data-cta="MOCK_TEST"></div>');
    expect(sanitizeArticleHtml('<div data-cta="EVIL"><p>x</p></div>')).toBe("<p>x</p>");
    expect(sanitizeArticleHtml('<div class="x"><p>x</p></div>')).toBe("<p>x</p>");
  });

  it("strips link target/rel attributes TipTap may add", () => {
    expect(sanitizeArticleHtml('<a href="https://sof.org" target="_blank" rel="noopener">SOF</a>')).toBe('<a href="https://sof.org">SOF</a>');
  });
});

describe("markdownToArticleHtml (writer output)", () => {
  const policy = { allowedInternal: new Set(["/blog/class-5-syllabus", "/brain-booster"]) };

  it("converts Markdown, places one CTA block and drops extra markers", () => {
    const md = "Intro **text**.\n\n## Plan\n\n| Week | Focus |\n|---|---|\n| 1 | Numbers |\n\n[[CTA]]\n\nMore.\n\n[[CTA]]";
    const r = markdownToArticleHtml(md, "MOCK_TEST", policy);
    expect(r.ctaPlaced).toBe(true);
    expect(extractCtas(r.html)).toEqual(["MOCK_TEST"]);
    expect(r.html).toContain("<h2>Plan</h2>");
    expect(r.html).toContain("<table>");
    expect(r.html).not.toContain("[[CTA]]");
  });

  it("does not interpret raw HTML inside the Markdown", () => {
    const r = markdownToArticleHtml('Hello <script>alert(1)</script> <img src=x onerror="alert(1)">', null, policy);
    expect(r.html).not.toMatch(/<script|onerror|<img/);
  });

  it("enforces the internal-link allowlist and reports external links", () => {
    const md = "See the [syllabus](/blog/class-5-syllabus), [games](https://www.olympiadiq.in/brain-booster), "
      + "[made up](/blog/top-10-secrets) and [SOF](https://sofworld.org).";
    const r = markdownToArticleHtml(md, null, policy);
    expect(extractLinks(r.html)).toEqual([
      { href: "/blog/class-5-syllabus", text: "syllabus" },
      { href: "/brain-booster", text: "games" },
      { href: "https://sofworld.org", text: "SOF" },
    ]);
    expect(r.html).toContain("made up"); // text kept, link removed
    expect(r.links.removedInternal).toEqual(["/blog/top-10-secrets"]);
    expect(r.links.external).toEqual(["https://sofworld.org"]);
  });

  it("reports when no CTA marker was placed", () => {
    expect(markdownToArticleHtml("Just text.", "AI_TUTOR", policy).ctaPlaced).toBe(false);
  });
});

describe("text helpers", () => {
  const html = '<h2>Title here</h2><p>One two <a href="/x">three</a>.</p><div data-cta="BATTLE"></div><table><tr><td>a</td><td>b</td></tr></table>';

  it("extracts readable text with block breaks and CTA markers", () => {
    expect(htmlToText(html)).toBe("Title here\nOne two three.\n[CTA: BATTLE]\na b");
  });

  it("counts words without the CTA marker", () => {
    expect(wordCount(html)).toBe(7);
    expect(wordCount("")).toBe(0);
  });
});
