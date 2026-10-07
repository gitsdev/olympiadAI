import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isRunDay, nextStatusAfterGeneration, pickKeywords } from "@/lib/seo-agent/cron/rules";
import { GET as publishScheduled } from "@/app/api/cron/publish-scheduled/route";
import { GET as dailyArticle } from "@/app/api/cron/daily-article/route";
import { POST as publishApi } from "@/app/api/content/publish/route";

const IST = "Asia/Kolkata";

describe("isRunDay", () => {
  it("runs daily, never when OFF, and weekly only on Mondays in IST", () => {
    const mondayIst = new Date("2026-10-11T19:00:00Z"); // Mon 12 Oct 00:30 IST (still Sunday in UTC)
    const tuesdayIst = new Date("2026-10-13T05:00:00Z");
    expect(isRunDay("DAILY", tuesdayIst, IST)).toBe(true);
    expect(isRunDay("OFF", mondayIst, IST)).toBe(false);
    expect(isRunDay("WEEKLY", mondayIst, IST)).toBe(true);
    expect(isRunDay("WEEKLY", tuesdayIst, IST)).toBe(false);
  });
});

describe("nextStatusAfterGeneration (tomorrow's article workflow)", () => {
  const clean = { errors: [], warnings: [] };
  it("waits for a human in manual mode, even if every check passes", () => {
    expect(nextStatusAfterGeneration("MANUAL_APPROVAL", clean).status).toBe("REVIEW");
  });

  it("schedules in auto-publish mode only when every check passes", () => {
    expect(nextStatusAfterGeneration("AUTO_PUBLISH", clean).status).toBe("SCHEDULED");
    const blocked = nextStatusAfterGeneration("AUTO_PUBLISH", { errors: [{ code: "SEO_CRITICAL", message: "Fact check: x" }], warnings: [] });
    expect(blocked.status).toBe("REVIEW_REQUIRED");
    expect(blocked.reason).toContain("Fact check: x");
    expect(nextStatusAfterGeneration("AUTO_PUBLISH", null).status).toBe("REVIEW_REQUIRED");
  });
});

describe("pickKeywords", () => {
  it("takes high priority first, then the oldest", () => {
    const rows = [
      { id: "a", priority: "LOW", created_at: "2026-01-01" },
      { id: "b", priority: "HIGH", created_at: "2026-03-01" },
      { id: "c", priority: "HIGH", created_at: "2026-02-01" },
      { id: "d", priority: "MEDIUM", created_at: "2026-01-01" },
    ];
    expect(pickKeywords(rows, 3).map((r) => r.id)).toEqual(["c", "b", "d"]);
  });
});

describe("vercel.json", () => {
  const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] };

  it("schedules both jobs", () => {
    expect(config.crons.map((c) => c.path).sort()).toEqual(["/api/cron/daily-article", "/api/cron/publish-scheduled"]);
  });

  it("runs each cron at most once a day, so deploys work on Vercel Hobby", () => {
    for (const c of config.crons) {
      const [minute, hour] = c.schedule.split(" ");
      expect(minute, c.schedule).toMatch(/^\d+$/);
      expect(hour, c.schedule).toMatch(/^\d+$/);
    }
  });

  it("matches the times shown on the Agent Tasks page", () => {
    const page = readFileSync(join(process.cwd(), "src/app/admin/seo-agent/agent-tasks/page.tsx"), "utf8");
    const toHHMM = (s: string) => { const [m, h] = s.split(" "); return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`; };
    const daily = config.crons.find((c) => c.path.endsWith("daily-article"))!.schedule;
    const publish = config.crons.find((c) => c.path.endsWith("publish-scheduled"))!.schedule;
    expect(page).toContain(`daily: "${toHHMM(daily)}"`);
    expect(page).toContain(`publish: "${toHHMM(publish)}"`);
  });
});

describe("cron + publishing API authentication (no DB access when unauthorised)", () => {
  afterEach(() => vi.unstubAllEnvs());
  const SECRET = "c".repeat(64);

  it.each([
    ["no header", undefined],
    ["wrong secret", `Bearer ${"x".repeat(64)}`],
    ["not a bearer token", SECRET],
  ])("cron routes reject %s", async (_l, auth) => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const headers = auth ? { authorization: auth } : undefined;
    expect((await publishScheduled(new Request("https://x/api/cron/publish-scheduled", { headers }))).status).toBe(401);
    expect((await dailyArticle(new Request("https://x/api/cron/daily-article", { headers }))).status).toBe(401);
  });

  it("cron routes fail closed when CRON_SECRET isn't configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await publishScheduled(new Request("https://x/api/cron/publish-scheduled", { headers: { authorization: "Bearer " } }));
    expect(res.status).toBe(401);
  });

  it("the publish API rejects requests without the BLOG_API_SECRET bearer token", async () => {
    vi.stubEnv("BLOG_API_SECRET", SECRET);
    const body = JSON.stringify({ articleId: "00000000-0000-0000-0000-000000000000" });
    expect((await publishApi(new Request("https://x/api/content/publish", { method: "POST", body }))).status).toBe(401);
    expect((await publishApi(new Request("https://x/api/content/publish", { method: "POST", body, headers: { authorization: "Bearer nope-nope-nope-nope" } }))).status).toBe(401);
  });

  it("the publish API validates the body once authorised", async () => {
    vi.stubEnv("BLOG_API_SECRET", SECRET);
    const res = await publishApi(new Request("https://x/api/content/publish", { method: "POST", body: "{\"articleId\":\"not-a-uuid\"}", headers: { authorization: `Bearer ${SECRET}` } }));
    expect(res.status).toBe(400);
  });
});
