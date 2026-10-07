import { describe, expect, it } from "vitest";
import {
  buildMonthGrid, isValidMonth, nextFreePublishDate, planInputSchema, planInputToRow, rescheduleTo, shiftMonth,
} from "@/lib/seo-agent/content-plans";

const IST = "Asia/Kolkata";

describe("nextFreePublishDate (scheduling)", () => {
  // 2026-10-07 20:00 UTC = 2026-10-08 01:30 IST, so "tomorrow" in IST is Oct 9.
  const now = new Date("2026-10-07T20:00:00Z");

  it("defaults to tomorrow (in IST) at the default publishing time", () => {
    expect(nextFreePublishDate([], now, IST, "10:00").toISOString()).toBe("2026-10-09T04:30:00.000Z");
  });

  it("skips days that already have a plan", () => {
    expect(nextFreePublishDate(["2026-10-09", "2026-10-10"], now, IST, "10:00").toISOString()).toBe("2026-10-11T04:30:00.000Z");
  });
});

describe("rescheduleTo (drag and drop)", () => {
  it("keeps the plan's time of day in IST", () => {
    // 2026-10-09 15:45 IST → move to 2026-10-20
    expect(rescheduleTo("2026-10-20", "2026-10-09T10:15:00Z", IST, "10:00").toISOString()).toBe("2026-10-20T10:15:00.000Z");
  });

  it("uses the default time when the plan had no date", () => {
    expect(rescheduleTo("2026-10-20", null, IST, "10:00").toISOString()).toBe("2026-10-20T04:30:00.000Z");
  });
});

describe("month grid", () => {
  it("builds Monday-first weeks covering the month", () => {
    const weeks = buildMonthGrid("2026-10"); // Oct 1 2026 is a Thursday
    expect(weeks[0][0]).toEqual({ date: "2026-09-28", inMonth: false });
    expect(weeks[0][3]).toEqual({ date: "2026-10-01", inMonth: true });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(31);
    expect(weeks[weeks.length - 1][6].date).toBe("2026-11-01");
  });

  it("handles a month that starts on Monday", () => {
    expect(buildMonthGrid("2026-06")[0][0]).toEqual({ date: "2026-06-01", inMonth: true });
  });

  it("shifts months across years and validates input", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(isValidMonth("2026-10")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth(undefined)).toBe(false);
  });
});

describe("planInputSchema", () => {
  const base = { title: "Class 5 Maths Olympiad Guide", primaryKeyword: "maths olympiad class 5" };

  it("accepts an idea without a date and fills defaults", () => {
    const p = planInputSchema.parse({ ...base, status: "IDEA" });
    expect(p).toMatchObject({ status: "IDEA", plannedDate: null, outline: [], internalLinks: [], secondaryKeywords: [] });
  });

  it("requires a date for PLANNED", () => {
    const r = planInputSchema.safeParse({ ...base, status: "PLANNED" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["plannedDate"]);
  });

  it("only allows the statuses an admin may set by hand", () => {
    expect(planInputSchema.safeParse({ ...base, status: "PUBLISHED", plannedDate: "2026-10-10" }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...base, status: "APPROVED", plannedDate: "2026-10-10" }).success).toBe(false);
  });

  it("rejects external or malformed internal link URLs", () => {
    const bad = { ...base, status: "IDEA", internalLinks: [{ url: "https://evil.example", anchorText: "x" }] };
    expect(planInputSchema.safeParse(bad).success).toBe(false);
  });

  it("stores the planned time in UTC, interpreted in IST", () => {
    const p = planInputSchema.parse({ ...base, status: "PLANNED", plannedDate: "2026-10-09", plannedTime: null });
    expect(planInputToRow(p, IST, "10:00").planned_publish_at).toBe("2026-10-09T04:30:00.000Z");
    const p2 = planInputSchema.parse({ ...base, status: "PLANNED", plannedDate: "2026-10-09", plannedTime: "18:30" });
    expect(planInputToRow(p2, IST, "10:00").planned_publish_at).toBe("2026-10-09T13:00:00.000Z");
  });
});
