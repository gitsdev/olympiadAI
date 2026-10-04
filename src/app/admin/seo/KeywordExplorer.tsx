"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { OABadge } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  KEYWORD_CLUSTERS, type KeywordCluster, type SeoKeyword, type Difficulty, type Priority, type VolumeBand,
} from "@/lib/admin/seo-data";

const PRIORITY_TONE: Record<Priority, "red" | "amber" | "neutral"> = { P1: "red", P2: "amber", P3: "neutral" };
const DIFFICULTY_TONE: Record<Difficulty, "green" | "amber" | "red"> = { low: "green", medium: "amber", high: "red" };
const PRIORITY_ORDER: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };
const VOLUME_ORDER: Record<VolumeBand, number> = { "100K+": 0, "10K–100K": 1, "1K–10K": 2, "<1K": 3 };

export function KeywordExplorer({ keywords }: { keywords: SeoKeyword[] }) {
  const [query, setQuery] = useState("");
  const [cluster, setCluster] = useState<KeywordCluster | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return keywords
      .filter((kw) => cluster === "all" || kw.cluster === cluster)
      .filter((kw) => priority === "all" || kw.priority === priority)
      .filter((kw) => !q || kw.keyword.includes(q) || kw.targetPage.includes(q))
      .sort((a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || VOLUME_ORDER[a.volume] - VOLUME_ORDER[b.volume],
      );
  }, [keywords, query, cluster, priority]);

  const counts = useMemo(() => {
    const m = new Map<KeywordCluster, number>();
    for (const kw of keywords) m.set(kw.cluster, (m.get(kw.cluster) ?? 0) + 1);
    return m;
  }, [keywords]);

  const chip = (selected: boolean) =>
    cn(
      "px-3 py-1.5 rounded-[var(--r-md)] border text-[12.5px] font-medium transition-colors whitespace-nowrap",
      selected
        ? "bg-[var(--cobalt-50)] border-[var(--cobalt-200)] text-[var(--cobalt-700)]"
        : "border-[var(--line-200)] hover:bg-[var(--fill-100)]",
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button className={chip(cluster === "all")} onClick={() => setCluster("all")}>
          All ({keywords.length})
        </button>
        {KEYWORD_CLUSTERS.map((c) => (
          <button key={c} className={chip(cluster === c)} onClick={() => setCluster(c)}>
            {c} ({counts.get(c) ?? 0})
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] border w-full sm:w-[280px]"
          style={{ borderColor: "var(--line-300)", background: "var(--surface)" }}
        >
          <Search size={15} style={{ color: "var(--fg-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords or pages…"
            className="flex-1 bg-transparent outline-none text-[13.5px]"
            aria-label="Search keywords"
          />
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span style={{ color: "var(--fg-muted)" }}>Priority:</span>
          {(["all", "P1", "P2", "P3"] as const).map((p) => (
            <button key={p} className={chip(priority === p)} onClick={() => setPriority(p)}>
              {p === "all" ? "All" : p}
            </button>
          ))}
        </div>
        <span className="sm:ml-auto text-[12.5px]" style={{ color: "var(--fg-subtle)" }}>
          {rows.length} keyword{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Keyword</TableHead>
            <TableHead>Cluster</TableHead>
            <TableHead>Intent</TableHead>
            <TableHead>Monthly volume</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Target page</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((kw) => (
            <TableRow key={kw.keyword}>
              <TableCell className="font-semibold" style={{ color: "var(--ink-900)" }}>{kw.keyword}</TableCell>
              <TableCell className="text-[12.5px]">{kw.cluster}</TableCell>
              <TableCell className="text-[12.5px] capitalize" style={{ color: "var(--fg-muted)" }}>{kw.intent}</TableCell>
              <TableCell className="text-[12.5px] tabular-nums">{kw.volume}</TableCell>
              <TableCell><OABadge tone={DIFFICULTY_TONE[kw.difficulty]} className="capitalize">{kw.difficulty}</OABadge></TableCell>
              <TableCell><OABadge tone={PRIORITY_TONE[kw.priority]}>{kw.priority}</OABadge></TableCell>
              <TableCell>
                <Link href={kw.targetPage} target="_blank" className="text-[12.5px] font-mono hover:underline" style={{ color: "var(--cobalt-700)" }}>
                  {kw.targetPage}
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8" style={{ color: "var(--fg-muted)" }}>
                No keywords match.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
