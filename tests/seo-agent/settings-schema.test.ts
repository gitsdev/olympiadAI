import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEO_SETTINGS, estimateCost, seoSettingsSchema, settingsFromRow, settingsToRow, type SeoSettingsRow,
} from "@/lib/seo-agent/settings-schema";

const validInput = { ...DEFAULT_SEO_SETTINGS, searchConsoleSiteUrl: "" };

describe("seoSettingsSchema", () => {
  it("accepts the spec defaults (Asia/Kolkata, MANUAL_APPROVAL, 10:00)", () => {
    const parsed = seoSettingsSchema.parse(validInput);
    expect(parsed.timezone).toBe("Asia/Kolkata");
    expect(parsed.publishingMode).toBe("MANUAL_APPROVAL");
    expect(parsed.defaultPublishTime).toBe("10:00");
    expect(parsed.backlinkCheckFrequency).toBe("WEEKLY");
    expect(parsed.searchConsoleSiteUrl).toBeNull();
  });

  it("rejects an unknown timezone", () => {
    expect(seoSettingsSchema.safeParse({ ...validInput, timezone: "Mars/Olympus" }).success).toBe(false);
  });

  it("rejects malformed publish times", () => {
    for (const t of ["24:00", "9:00", "10:60", "10am"]) {
      expect(seoSettingsSchema.safeParse({ ...validInput, defaultPublishTime: t }).success).toBe(false);
    }
  });

  it("rejects unknown publishing modes and CTAs", () => {
    expect(seoSettingsSchema.safeParse({ ...validInput, publishingMode: "YOLO" }).success).toBe(false);
    expect(seoSettingsSchema.safeParse({ ...validInput, defaultCta: "NEWSLETTER" }).success).toBe(false);
  });

  it("requires at least one brand feature", () => {
    const res = seoSettingsSchema.safeParse({ ...validInput, brand: { ...validInput.brand, features: [] } });
    expect(res.success).toBe(false);
  });

  it("rejects negative pricing", () => {
    const res = seoSettingsSchema.safeParse({ ...validInput, aiPricing: { "gpt-x": { input: -1, output: 1 } } });
    expect(res.success).toBe(false);
  });

  it("validates the Search Console property format", () => {
    expect(seoSettingsSchema.safeParse({ ...validInput, searchConsoleSiteUrl: "sc-domain:olympiadiq.in" }).success).toBe(true);
    expect(seoSettingsSchema.safeParse({ ...validInput, searchConsoleSiteUrl: "https://www.olympiadiq.in/" }).success).toBe(true);
    expect(seoSettingsSchema.safeParse({ ...validInput, searchConsoleSiteUrl: "olympiadiq.in" }).success).toBe(false);
  });
});

describe("row mapping", () => {
  it("round-trips through the database row shape", () => {
    const row = { ...settingsToRow(DEFAULT_SEO_SETTINGS), default_publish_time: "10:00:00" } as SeoSettingsRow;
    expect(settingsFromRow(row)).toEqual(DEFAULT_SEO_SETTINGS);
  });

  it("throws on a corrupt row instead of running on bad config", () => {
    const row = { ...settingsToRow(DEFAULT_SEO_SETTINGS), publishing_mode: "SOMETIMES" } as SeoSettingsRow;
    expect(() => settingsFromRow(row)).toThrow();
  });
});

describe("estimateCost", () => {
  const pricing = { "model-a": { input: 0.5, output: 2 } };

  it("prices tokens per million", () => {
    expect(estimateCost(pricing, "model-a", 1_000_000, 500_000)).toBeCloseTo(1.5);
  });

  it("returns null (unknown) for unpriced models rather than guessing", () => {
    expect(estimateCost(pricing, "model-b", 1000, 1000)).toBeNull();
    expect(estimateCost({}, "model-a", 1000, 1000)).toBeNull();
  });
});
