import { describe, expect, it } from "vitest";
import { planContent, postProcessPlan, type ContentPlanDraft } from "@/lib/seo-agent/agents/content-planner";
import { DEFAULT_BRAND } from "@/lib/seo-agent/settings-schema";
import { STATIC_LINK_CANDIDATES, type LinkCandidate } from "@/lib/seo-agent/site-pages";
import { FakeProvider } from "./helpers";

const candidates: LinkCandidate[] = [
  { url: "/blog/class-5-maths-olympiad-syllabus", title: "Class 5 Maths Olympiad Syllabus", kind: "BLOG_POST" },
  ...STATIC_LINK_CANDIDATES,
];

const draft: ContentPlanDraft = {
  title: "Class 5 Maths Olympiad: Complete Preparation Guide",
  contentType: "GUIDE",
  targetAudience: "STUDENTS_AND_PARENTS",
  searchIntent: "INFORMATIONAL",
  secondaryKeywords: ["class 5 maths olympiad", "maths olympiad class 5", "IMO class 5", "IMO class 5"],
  outline: [
    { heading: "What the Class 5 Maths Olympiad tests", points: ["Topics usually covered", "How it differs from school maths"] },
    { heading: "A 6-week study plan", points: ["Week-by-week focus"] },
    { heading: "Practice and mock tests", points: ["How to review mistakes"] },
  ],
  recommendedCta: "MOCK_TEST",
  ctaReason: "Readers preparing for the exam benefit most from timed practice.",
  internalLinks: [
    { url: "/blog/class-5-maths-olympiad-syllabus", anchorText: "Class 5 Maths Olympiad syllabus", reason: "Readers want the topic list." },
    { url: "https://www.olympiadiq.in/brain-booster/number-ninja", anchorText: "Number Ninja", reason: "Mental maths practice." },
    { url: "/blog/made-up-article", anchorText: "Top 10 tricks", reason: "Invented page." },
    { url: "/blog/class-5-maths-olympiad-syllabus", anchorText: "syllabus again", reason: "Duplicate." },
  ],
  factCheckNotes: ["Confirm this year's IMO exam dates on the official SOF website."],
};

describe("postProcessPlan (internal link suggestions)", () => {
  const r = postProcessPlan(draft, candidates, "maths olympiad class 5");

  it("keeps only links to real pages, normalising absolute site URLs and removing duplicates", () => {
    expect(r.internalLinks.map((l) => l.url)).toEqual(["/blog/class-5-maths-olympiad-syllabus", "/brain-booster/number-ninja"]);
    expect(r.warnings).toEqual(['Removed link to "/blog/made-up-article": not an existing OlympiadIQ page.']);
  });

  it("drops the primary keyword and duplicates from secondary keywords", () => {
    expect(r.secondaryKeywords).toEqual(["class 5 maths olympiad", "IMO class 5"]);
  });

  it("puts the CTA reason and fact-check notes into the plan notes", () => {
    expect(r.notes).toContain("CTA: Readers preparing for the exam");
    expect(r.notes).toContain("Verify before publishing:\n- Confirm this year's IMO exam dates");
  });
});

describe("planContent (content plan generation, mocked AI)", () => {
  it("sends the cluster, link candidates and honesty rules, and returns a validated plan", async () => {
    const ai = new FakeProvider([JSON.stringify(draft)]);
    const plan = await planContent(ai, {
      brand: DEFAULT_BRAND,
      cluster: {
        name: "Class 5 Maths Olympiad", primaryKeyword: "maths olympiad class 5", secondaryKeywords: [], questionKeywords: [],
        searchIntent: "INFORMATIONAL", recommendedTitle: "Class 5 Maths Olympiad: Complete Preparation Guide", targetClass: 5, subject: "Mathematics",
      },
      opportunityReason: "No existing guide covers Class 5 preparation.",
      linkCandidates: candidates,
      ctaOptions: [{ type: "MOCK_TEST", label: "Free Unlimited Mock Tests", description: "x" }],
    });

    expect(plan.title).toBe("Class 5 Maths Olympiad: Complete Preparation Guide");
    expect(plan.outline).toHaveLength(3);
    expect(plan.recommendedCta).toBe("MOCK_TEST");
    expect(ai.requests[0].system).toMatch(/People first/);
    expect(ai.requests[0].system).toMatch(/Never invent/);
    expect(ai.requests[0].prompt).toContain("/blog/class-5-maths-olympiad-syllabus");
    expect(ai.requests[0].prompt).toMatch(/MUST be copied exactly from the link candidates/);
  });

  it("retries once when the plan has too few sections, then accepts a valid one", async () => {
    const tooShort = { ...draft, outline: draft.outline.slice(0, 1) };
    const ai = new FakeProvider([JSON.stringify(tooShort), JSON.stringify(draft)]);
    const plan = await planContent(ai, {
      brand: DEFAULT_BRAND,
      cluster: { name: "c", primaryKeyword: "maths olympiad class 5", secondaryKeywords: [], questionKeywords: [], searchIntent: null, recommendedTitle: null, targetClass: null, subject: null },
      opportunityReason: "r", linkCandidates: candidates, ctaOptions: [],
    });
    expect(plan.outline).toHaveLength(3);
    expect(ai.requests).toHaveLength(2);
    expect(ai.requests[1].prompt).toMatch(/outline/);
  });
});
