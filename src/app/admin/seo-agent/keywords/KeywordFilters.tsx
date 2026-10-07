"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KEYWORD_STATUSES, humanizeStatus } from "@/lib/seo-agent/constants";
import { KEYWORD_PRIORITIES, KEYWORD_SUBJECTS } from "@/lib/seo-agent/keywords";

export function KeywordFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(name: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(name, value);
    else params.delete(name);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  const filter = (name: string, label: string, options: { value: string; label: string }[], allLabel: string) => (
    <Select value={searchParams.get(name) ?? "all"} onValueChange={(v) => setParam(name, v as string)}>
      <SelectTrigger aria-label={label} className="h-9"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filter("status", "Filter by status", KEYWORD_STATUSES.map((s) => ({ value: s, label: humanizeStatus(s) })), "Not archived")}
      {filter("priority", "Filter by priority", KEYWORD_PRIORITIES.map((p) => ({ value: p, label: `${humanizeStatus(p)} priority` })), "Any priority")}
      {filter("class", "Filter by class", Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Class ${i + 1}` })), "All classes")}
      {filter("subject", "Filter by subject", KEYWORD_SUBJECTS.map((s) => ({ value: s, label: s })), "All subjects")}
      {filter("clustered", "Filter by clustering", [{ value: "no", label: "Not clustered" }, { value: "yes", label: "Clustered" }], "Clustered or not")}
    </div>
  );
}
