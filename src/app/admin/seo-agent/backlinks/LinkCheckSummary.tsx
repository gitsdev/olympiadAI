import { formatZoned } from "@/lib/seo-agent/datetime";
import type { LinkCheckResult } from "@/lib/seo-agent/backlinks/model";

/** One-line summary of the latest link check. */
export function LinkCheckSummary({ check, timezone }: { check: LinkCheckResult | null; timezone: string }) {
  if (!check) return <span style={{ color: "var(--fg-subtle)" }}>Not checked yet</span>;
  const when = formatZoned(check.checkedAt, timezone);
  if (check.error) return <span style={{ color: "var(--danger-tx)" }}>{when}: couldn&apos;t check ({check.error})</span>;
  if (!check.found) return <span style={{ color: "var(--danger-tx)" }}>{when}: link not found on the page</span>;
  return (
    <span style={{ color: "var(--success-tx)" }}>
      {when}: found{check.anchorText ? ` ("${check.anchorText}")` : ""}
      {check.followed === false && <span style={{ color: "var(--warning-tx)" }}> · {check.rel.join(", ")}</span>}
    </span>
  );
}
