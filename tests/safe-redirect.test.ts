// "Return after login" paths must stay on this site (no open redirects).

import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("accepts same-site paths, keeping query and hash", () => {
    expect(safeNextPath("/question-paper-solver")).toBe("/question-paper-solver");
    expect(safeNextPath("/question-paper-solver/abc?x=1#top")).toBe("/question-paper-solver/abc?x=1#top");
    expect(safeNextPath("/admin/blog")).toBe("/admin/blog");
  });

  it.each([
    "https://evil.com",
    "//evil.com/path",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "evil.com",
    "/%0d%0aSet-Cookie:x",
    "/ok\nhttps://evil.com",
    "",
  ])("rejects %j", (v) => {
    const out = safeNextPath(v);
    if (out !== null) expect(out.startsWith("/") && !out.startsWith("//")).toBe(true);
    expect(out === null || new URL(out, "https://olympiadiq.in").origin === "https://olympiadiq.in").toBe(true);
    if (!v.startsWith("/%0d")) expect(out).toBeNull();
  });

  it("rejects non-strings and pages that would loop", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(42)).toBeNull();
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/login?next=/x")).toBeNull();
    expect(safeNextPath("/verify-email")).toBeNull();
    expect(safeNextPath("/auth/callback")).toBeNull();
    expect(safeNextPath("/api/question-paper/jobs")).toBeNull();
  });
});
