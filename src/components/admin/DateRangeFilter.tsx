"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATE_RANGE_PRESETS, type DateRangePreset } from "@/lib/admin/date-range";

export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get("range") as DateRangePreset) || "30d";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function setParam(name: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={current} onValueChange={(v) => setParam("range", v)}>
        <SelectTrigger aria-label="Date range" className="h-9">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGE_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {current === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label="Start date"
            value={from}
            onChange={(e) => setParam("from", e.target.value || null)}
            className="h-9 px-2.5 rounded-[var(--r-md)] border text-[13px]"
            style={{ borderColor: "var(--line-300)", background: "var(--surface)", color: "var(--ink-900)" }}
          />
          <span className="text-[12px]" style={{ color: "var(--fg-muted)" }}>to</span>
          <input
            type="date"
            aria-label="End date"
            value={to}
            onChange={(e) => setParam("to", e.target.value || null)}
            className="h-9 px-2.5 rounded-[var(--r-md)] border text-[13px]"
            style={{ borderColor: "var(--line-300)", background: "var(--surface)", color: "var(--ink-900)" }}
          />
        </div>
      )}
    </div>
  );
}
