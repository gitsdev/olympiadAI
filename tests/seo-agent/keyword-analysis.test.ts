import { describe, expect, it } from "vitest";
import {
  analyzeKeywords, keywordAnalysisSchema, postProcessAnalysis,
  type AnalysisKeyword, type ExistingCluster, type ExistingContent, type KeywordAnalysis,
} from "@/lib/seo-agent/agents/keyword-analysis";
import { DEFAULT_BRAND } from "@/lib/seo-agent/settings-schema";
import { FakeProvider } from "./helpers";

const kws: AnalysisKeyword[] = [
  { id: "k1", keyword: "maths olympiad class 5", targetClass: 5, subject: "Mathematics" },
  { id: "k2", keyword: "IMO class 5", targetClass: 5, subject: "Mathematics" },
  { id: "k3", keyword: "how to prepare for maths olympiad class 5", targetClass: 5, subject: "Mathematics" },
  { id: "k4", keyword: "nso class 6 sample paper", targetClass: 6, subject: "Science" },
];

const content: ExistingContent[] = [
  { slug: "class-5-maths-olympiad-syllabus", title: "Class 5 Maths Olympiad Syllabus", source: "blog", blogPostId: "post-1" },
];

function cluster(over: Partial<KeywordAnalysis["clusters"][number]> = {}): KeywordAnalysis["clusters"][number] {
  return {
    name: "Class 5 Maths Olympiad",
    primaryKeyword: "maths olympiad class 5",
    searchIntent: "INFORMATIONAL",
    memberKeywords: ["maths olympiad class 5", "IMO class 5", "how to prepare for maths olympiad class 5"],
    secondaryKeywords: ["class 5 maths olympiad", "math olympiad class 5", "maths olympiad class 5"],
    questionKeywords: ["how to prepare for maths olympiad class 5", "math olympiad questions class 5"],
    recommendedTitle: "Class 5 Maths Olympiad: Complete Preparation Guide",
    recommendation: { type: "NEW_ARTICLE", reason: "No existing guide covers preparation for Class 5.", relatedSlugs: ["class-5-maths-olympiad-syllabus"], cannibalizationRisk: "LOW" },
    ...over,
  };
}

describe("postProcessAnalysis", () => {
  it("maps members to keyword ids with roles and keeps real related posts", () => {
    const r = postProcessAnalysis({ clusters: [cluster()], keywordIntents: [{ keyword: "IMO  class 5", searchIntent: "INFORMATIONAL" }] }, kws, content, []);
    const c = r.clusters[0];
    expect(c.primaryKeywordId).toBe("k1");
    expect(c.members).toEqual([
      { keywordId: "k1", role: "PRIMARY" },
      { keywordId: "k2", role: "SECONDARY" },
      { keywordId: "k3", role: "QUESTION" },
    ]);
    // The primary keyword is never repeated as its own variant.
    expect(c.secondaryKeywords).toEqual(["class 5 maths olympiad", "math olympiad class 5"]);
    expect(c.opportunity.relatedBlogPostIds).toEqual(["post-1"]);
    expect(r.intents).toEqual([{ keywordId: "k2", searchIntent: "INFORMATIONAL" }]);
    expect(r.warnings).toEqual(['Not clustered: "nso class 6 sample paper".']);
  });

  it("drops invented member keywords and invented slugs, with warnings", () => {
    const r = postProcessAnalysis({
      clusters: [cluster({
        memberKeywords: ["maths olympiad class 5", "maths olympiad class 5 pdf free download"],
        recommendation: { type: "UPDATE_EXISTING", reason: "An existing page covers this already.", relatedSlugs: ["made-up-slug"], cannibalizationRisk: "HIGH" },
      })],
      keywordIntents: [],
    }, kws, content, []);
    expect(r.clusters[0].members).toEqual([{ keywordId: "k1", role: "PRIMARY" }]);
    // UPDATE_EXISTING with no real page to update falls back to NEW_ARTICLE.
    expect(r.clusters[0].opportunity.type).toBe("NEW_ARTICLE");
    expect(r.warnings.join("\n")).toMatch(/pdf free download/);
    expect(r.warnings.join("\n")).toMatch(/made-up-slug/);
  });

  it("falls back to a real member when the AI's primary keyword wasn't submitted", () => {
    const r = postProcessAnalysis({ clusters: [cluster({ primaryKeyword: "class 5 olympiad maths" })], keywordIntents: [] }, kws, content, []);
    expect(r.clusters[0].primaryKeyword).toBe("maths olympiad class 5");
    expect(r.clusters[0].secondaryKeywords[0]).toBe("class 5 olympiad maths");
  });

  it("assigns each keyword to only one cluster", () => {
    const r = postProcessAnalysis({
      clusters: [cluster(), cluster({ name: "Dup", primaryKeyword: "IMO class 5", memberKeywords: ["IMO class 5", "nso class 6 sample paper"] })],
      keywordIntents: [],
    }, kws, content, []);
    // "IMO class 5" already belongs to the first cluster, so the second keeps
    // only k4 — which becomes its primary because the AI's choice is taken.
    expect(r.clusters[1].members).toEqual([{ keywordId: "k4", role: "PRIMARY" }]);
    expect(r.warnings.join("\n")).toMatch(/primary keyword "IMO class 5" was not a member/);
  });

  it("merges into an existing cluster with the same primary keyword", () => {
    const existing: ExistingCluster[] = [{ id: "cl-1", name: "Class 5 Maths", primaryKeyword: "Maths Olympiad Class 5" }];
    expect(postProcessAnalysis({ clusters: [cluster()], keywordIntents: [] }, kws, content, existing).clusters[0].existingClusterId).toBe("cl-1");
  });

  it("fails when nothing usable comes back", () => {
    expect(() => postProcessAnalysis({ clusters: [cluster({ memberKeywords: ["something else"] })], keywordIntents: [] }, kws, content, []))
      .toThrow(/no usable clusters/);
  });
});

describe("analyzeKeywords (keyword clustering, mocked AI)", () => {
  it("produces the MVP example: a Class 5 cluster recommending the preparation guide", async () => {
    const reply = JSON.stringify({ clusters: [cluster({ memberKeywords: ["maths olympiad class 5"], questionKeywords: [] })], keywordIntents: [] });
    const ai = new FakeProvider([reply]);
    const r = await analyzeKeywords(ai, { brand: DEFAULT_BRAND, keywords: [kws[0]], existingContent: [], existingClusters: [] });

    expect(r.clusters).toHaveLength(1);
    expect(r.clusters[0]).toMatchObject({ name: "Class 5 Maths Olympiad", primaryKeywordId: "k1", recommendedTitle: "Class 5 Maths Olympiad: Complete Preparation Guide" });
    // Prompt carries the brand facts and the honesty rules.
    expect(ai.requests[0].system).toContain("Battle with Friends");
    expect(ai.requests[0].system).toMatch(/Never invent search volumes/);
    expect(ai.requests[0].prompt).toContain('"keyword": "maths olympiad class 5"');
  });

  it("sends de-duplicated keywords to the AI", async () => {
    const ai = new FakeProvider([JSON.stringify({ clusters: [cluster({ memberKeywords: ["maths olympiad class 5"] })], keywordIntents: [] })]);
    await analyzeKeywords(ai, {
      brand: DEFAULT_BRAND,
      keywords: [kws[0], { ...kws[0], id: "k1b", keyword: "Maths  Olympiad Class 5" }],
      existingContent: [], existingClusters: [],
    });
    expect(ai.requests[0].prompt.match(/olympiad class 5"/gi)).toHaveLength(1);
  });

  it("rejects output that doesn't match the schema", () => {
    expect(keywordAnalysisSchema.safeParse({ clusters: [cluster({ recommendation: { type: "WRITE_IT", reason: "x", relatedSlugs: [], cannibalizationRisk: "LOW" } as never })], keywordIntents: [] }).success).toBe(false);
    expect(keywordAnalysisSchema.safeParse({ clusters: [], keywordIntents: [] }).success).toBe(false);
  });
});
