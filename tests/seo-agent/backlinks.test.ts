import { describe, expect, it } from "vitest";
import { isPublicIp, validateFetchUrl } from "@/lib/seo-agent/backlinks/url-safety";
import { findLinksTo, parsePage } from "@/lib/seo-agent/backlinks/page-parse";
import { nextBacklinkStatus, prospectInputSchema, websiteFromUrl } from "@/lib/seo-agent/backlinks/model";
import { detectSpamSignals, evaluateBacklinkProspect, postProcessEvaluation, type BacklinkEvaluationDraft } from "@/lib/seo-agent/agents/backlink-evaluator";
import { assembleOutreach, outreachSchema, writeOutreach } from "@/lib/seo-agent/agents/outreach-writer";
import { DEFAULT_BRAND } from "@/lib/seo-agent/settings-schema";
import { FakeProvider } from "./helpers";

describe("URL safety (server-side fetching of admin-entered URLs)", () => {
  it.each([
    ["127.0.0.1", false], ["10.1.2.3", false], ["172.20.0.1", false], ["192.168.1.1", false], ["169.254.169.254", false],
    ["100.64.0.1", false], ["0.0.0.0", false], ["::1", false], ["fd00::1", false], ["fe80::1", false], ["::ffff:127.0.0.1", false],
    ["8.8.8.8", true], ["104.16.0.1", true], ["2606:4700::1", true],
  ])("isPublicIp(%s) = %s", (ip, expected) => {
    expect(isPublicIp(ip)).toBe(expected);
  });

  it.each([
    ["https://example.org/resources", true],
    ["http://example.org", true],
    ["ftp://example.org", false],
    ["file:///etc/passwd", false],
    ["https://user:pass@example.org", false],
    ["https://example.org:8080/", false],
    ["http://127.0.0.1/admin", false],
    ["http://[::1]/", false],
    ["http://localhost:80/", false],
    ["http://metadata.google.internal/", false],
    ["not a url", false],
  ])("validateFetchUrl(%s) ok=%s", (url, ok) => {
    expect(validateFetchUrl(url).ok).toBe(ok);
  });
});

const html = `<!doctype html><html lang="en"><head><title>Maths Resources for Kids</title>
<meta name="description" content="Free maths resources for primary students."></head><body>
<script>var x = "write for us";</script>
<h1>Maths resources</h1><h2>Olympiad practice</h2>
<p>We collect free resources for parents and teachers. Useful links for students below.</p>
<ul>
<li><a href="https://www.olympiadiq.in/brain-booster/">Brain Booster Games</a></li>
<li><a href="https://olympiadiq.in/blog/olympiad-practice-test" rel="nofollow ugc">Practice tests</a></li>
<li><a href="/about">About us</a></li>
<li><a href="mailto:editor@mathskids.org">Email the editor</a></li>
<li><a href="javascript:alert(1)">bad</a></li>
</ul><p>Want to contribute? <a href="/write-for-us">Write for us</a>.</p></body></html>`;

describe("parsePage", () => {
  const page = parsePage(html, "https://mathskids.org/resources");

  it("extracts title, description, language, headings and readable text (not scripts)", () => {
    expect(page.title).toBe("Maths Resources for Kids");
    expect(page.description).toBe("Free maths resources for primary students.");
    expect(page.lang).toBe("en");
    expect(page.headings).toEqual(["Maths resources", "Olympiad practice"]);
    expect(page.textExcerpt).not.toContain("var x");
  });

  it("resolves links, keeps rel values, finds emails and drops javascript: links", () => {
    expect(page.links.map((l) => l.href)).toEqual([
      "https://www.olympiadiq.in/brain-booster/",
      "https://olympiadiq.in/blog/olympiad-practice-test",
      "https://mathskids.org/about",
      "https://mathskids.org/write-for-us",
    ]);
    expect(page.links[1].rel).toEqual(["nofollow", "ugc"]);
    expect(page.emails).toEqual(["editor@mathskids.org"]);
    expect(page.outboundLinkCount).toBe(2);
    expect(page.signals.writeForUs).toBe(true);
    expect(page.signals.casinoOrAdultTerms).toBe(false);
  });
});

describe("findLinksTo (backlink tracking)", () => {
  const { links } = parsePage(html, "https://mathskids.org/resources");

  it("matches the target path, ignoring www and trailing slashes", () => {
    const m = findLinksTo(links, "https://olympiadiq.in/brain-booster");
    expect(m).toEqual([{ href: "https://www.olympiadiq.in/brain-booster/", anchorText: "Brain Booster Games", rel: [], followed: true }]);
  });

  it("reports nofollow/ugc links as not followed", () => {
    const m = findLinksTo(links, "https://www.olympiadiq.in/blog/olympiad-practice-test");
    expect(m[0].followed).toBe(false);
  });

  it("finds nothing for a page that isn't linked, unless any page on the host counts", () => {
    expect(findLinksTo(links, "https://www.olympiadiq.in/start")).toEqual([]);
    expect(findLinksTo(links, "https://www.olympiadiq.in/start", { anyPathOnHost: true })).toHaveLength(2);
  });
});

describe("nextBacklinkStatus", () => {
  it("marks found links active and live links that disappear as lost", () => {
    expect(nextBacklinkStatus("PUBLISHED", { found: true, error: null, httpStatus: 200 })).toBe("ACTIVE");
    expect(nextBacklinkStatus("ACTIVE", { found: false, error: null, httpStatus: 200 })).toBe("LOST");
    expect(nextBacklinkStatus("ACTIVE", { found: false, error: "gone", httpStatus: 404 })).toBe("LOST");
  });

  it("doesn't flip to lost on a temporary fetch error, and leaves not-yet-live links alone", () => {
    expect(nextBacklinkStatus("ACTIVE", { found: false, error: "timeout", httpStatus: null })).toBe("ACTIVE");
    expect(nextBacklinkStatus("CONTACTED", { found: false, error: null, httpStatus: 200 })).toBe("CONTACTED");
    expect(nextBacklinkStatus("LOST", { found: true, error: null, httpStatus: 200 })).toBe("ACTIVE");
  });
});

describe("prospect input", () => {
  it("requires an http(s) URL and validates email", () => {
    expect(prospectInputSchema.safeParse({ url: "example.org" }).success).toBe(false);
    expect(prospectInputSchema.safeParse({ url: "https://example.org", contactEmail: "nope" }).success).toBe(false);
    expect(prospectInputSchema.parse({ url: "https://example.org", contactEmail: "" })).toMatchObject({ status: "PROSPECT", opportunityType: "OTHER", contactEmail: null });
  });

  it("derives a website name from the URL", () => {
    expect(websiteFromUrl("https://www.mathskids.org/resources")).toBe("mathskids.org");
  });
});

const draft: BacklinkEvaluationDraft = {
  relevanceScore: 85, qualityScore: 70, editorialFit: "Resource list for parents; a free practice link fits.",
  contentQuality: "Original, short descriptions of each resource.", estimatedTraffic: "about 50k/month",
  spamRisk: "LOW", spamSignals: [], suggestedOpportunityType: "RESOURCE_PAGE",
  recommendedApproach: "Suggest the Brain Booster Games page for their list.", confidence: "HIGH",
};

describe("Backlink Agent (backlink scoring)", () => {
  const page = parsePage(html, "https://mathskids.org/resources");

  it("never keeps an AI-provided traffic figure", () => {
    expect(postProcessEvaluation(draft, page).estimatedTraffic).toBe("DATA_UNAVAILABLE");
  });

  it("marks spam risk unavailable and confidence low when the page couldn't be read", () => {
    const e = postProcessEvaluation(draft, { fetchError: "HTTP 403", url: "https://x.org" });
    expect(e.spamRisk).toBe("DATA_UNAVAILABLE");
    expect(e.confidence).toBe("LOW");
    expect(e.page).toMatchObject({ fetched: false, error: "HTTP 403" });
    expect(postProcessEvaluation({ ...draft, spamRisk: "HIGH" }, { fetchError: "x", url: "https://x.org" }).spamRisk).toBe("HIGH");
  });

  it("raises spam risk from signals detected in code", () => {
    const spammy = parsePage(html.replace("We collect free resources", "Buy a backlink! Casino bonuses and we collect free resources"), "https://spam.example");
    expect(detectSpamSignals(spammy).minRisk).toBe("HIGH");
    expect(postProcessEvaluation(draft, spammy).spamRisk).toBe("HIGH");
  });

  it("tells the AI not to invent metrics and doesn't send the raw link list", async () => {
    const ai = new FakeProvider([JSON.stringify(draft)]);
    await evaluateBacklinkProspect(ai, { brand: DEFAULT_BRAND, prospect: { website: "mathskids.org", url: page.url, topic: null, opportunityType: "OTHER", notes: null }, page });
    expect(ai.requests[0].system).toMatch(/Never invent domain authority/);
    expect(ai.requests[0].prompt).toContain("Maths Resources for Kids");
    expect(ai.requests[0].prompt).not.toContain('"links"');
  });
});

describe("outreach drafting", () => {
  const resources = [{ url: "/brain-booster", title: "Brain Booster Games" }, { url: "/blog/olympiad-practice-test", title: "Olympiad practice tests" }];
  const parts = {
    subject: "A free brain-games resource for your maths list",
    opening: "Hi, I came across your Maths Resources for Kids page.",
    reason: "Your list helps parents find free practice for primary students.",
    contribution: "You might consider adding our free Brain Booster Games, which need no sign-up.",
    resource: { url: "/brain-booster", why: "Quick mental-maths and logic games for children." },
    callToAction: "If it seems useful, feel free to include it. Thanks for maintaining the list!",
  };

  it("only allows resources from the offered list", () => {
    const schema = outreachSchema(["/brain-booster"]);
    expect(schema.safeParse(parts).success).toBe(true);
    expect(schema.safeParse({ ...parts, resource: { ...parts.resource, url: "/made-up" } }).success).toBe(false);
  });

  it("assembles a plain-text email with an absolute resource link and sign-off", () => {
    const m = assembleOutreach(parts, "Brain Booster Games", "https://www.olympiadiq.in/");
    expect(m.body).toContain("Brain Booster Games: https://www.olympiadiq.in/brain-booster");
    expect(m.body.trim().endsWith("https://www.olympiadiq.in")).toBe(true);
    expect(m.warnings).toEqual([]);
  });

  it("flags link-scheme wording", () => {
    const m = assembleOutreach({ ...parts, contribution: "We could do a link exchange or pay for a dofollow link." }, "x", "https://www.olympiadiq.in");
    expect(m.warnings).toHaveLength(1);
  });

  it("passes honesty rules and only the given resources to the AI", async () => {
    const ai = new FakeProvider([JSON.stringify(parts)]);
    const m = await writeOutreach(ai, {
      brand: DEFAULT_BRAND,
      prospect: { website: "mathskids.org", url: "https://mathskids.org/resources", topic: null, opportunityType: "RESOURCE_PAGE", contactName: null },
      pageFacts: { title: "Maths Resources for Kids", description: "", headings: [] },
      evaluation: null,
      resources,
    });
    expect(m.subject).toBe(parts.subject);
    expect(ai.requests[0].system).toMatch(/Never offer or hint at payment, link exchanges/);
    expect(ai.requests[0].system).toMatch(/Personalise ONLY with facts from the page data/);
  });
});

describe("outreach sign-off", () => {
  it("adds exactly one sign-off even if the AI wrote its own", async () => {
    const { assembleOutreach, stripSignOff } = await import("@/lib/seo-agent/agents/outreach-writer");
    expect(stripSignOff("Thank you for your time. Warm regards, The OlympiadIQ Team")).toBe("Thank you for your time.");
    expect(stripSignOff("Thanks for considering it!")).toBe("Thanks for considering it!");
    const m = assembleOutreach({
      subject: "Hello there", opening: "Hi there, nice page.", reason: "Your list helps parents.", contribution: "Maybe add our games.",
      resource: { url: "/brain-booster", why: "Free games." }, callToAction: "Thanks for your time. Best regards, The OlympiadIQ Team",
    }, "Brain Booster Games", "https://www.olympiadiq.in");
    expect(m.body.match(/regards/gi)).toHaveLength(1);
  });
});
