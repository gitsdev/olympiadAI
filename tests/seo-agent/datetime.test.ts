import { describe, expect, it } from "vitest";
import {
  addDays, formatZoned, isValidTimeZone, zonedDateString, zonedDayRange, zonedMonthRange, zonedTimeToUtc,
} from "@/lib/seo-agent/datetime";

describe("zonedTimeToUtc", () => {
  it("converts 10:00 IST to 04:30 UTC", () => {
    expect(zonedTimeToUtc("2026-10-08", "10:00", "Asia/Kolkata").toISOString()).toBe("2026-10-08T04:30:00.000Z");
  });

  it("handles IST midnight rolling back to the previous UTC day", () => {
    expect(zonedTimeToUtc("2026-10-08", "00:00", "Asia/Kolkata").toISOString()).toBe("2026-10-07T18:30:00.000Z");
  });

  it("respects DST in zones that have it", () => {
    // New York: EDT (UTC-4) in July, EST (UTC-5) in January.
    expect(zonedTimeToUtc("2026-07-01", "10:00", "America/New_York").toISOString()).toBe("2026-07-01T14:00:00.000Z");
    expect(zonedTimeToUtc("2026-01-15", "10:00", "America/New_York").toISOString()).toBe("2026-01-15T15:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(() => zonedTimeToUtc("08-10-2026", "10:00")).toThrow();
    expect(() => zonedTimeToUtc("2026-10-08", "10am")).toThrow();
  });
});

describe("day ranges", () => {
  // 2026-10-07 20:00 UTC is already 2026-10-08 01:30 in India.
  const now = new Date("2026-10-07T20:00:00Z");

  it("uses the calendar date in the configured zone, not UTC", () => {
    expect(zonedDateString(now, "Asia/Kolkata")).toBe("2026-10-08");
    expect(zonedDateString(now, "UTC")).toBe("2026-10-07");
  });

  it("computes tomorrow's UTC bounds in IST", () => {
    const r = zonedDayRange(now, "Asia/Kolkata", 1);
    expect(r.date).toBe("2026-10-09");
    expect(r.start.toISOString()).toBe("2026-10-08T18:30:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-09T18:30:00.000Z");
  });

  it("computes month bounds across a year boundary", () => {
    const r = zonedMonthRange(new Date("2026-12-31T20:00:00Z"), "Asia/Kolkata"); // Jan 1 in IST
    expect(r.start.toISOString()).toBe("2026-12-31T18:30:00.000Z");
    expect(r.end.toISOString()).toBe("2027-01-31T18:30:00.000Z");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("timezone helpers", () => {
  it("validates IANA zones", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  it("formats in the target zone", () => {
    const s = formatZoned("2026-10-08T04:30:00Z", "Asia/Kolkata");
    expect(s).toContain("8 Oct 2026");
    expect(s).toMatch(/10:00/);
  });
});
