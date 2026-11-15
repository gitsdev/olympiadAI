"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { SearchInput } from "@/components/admin/SearchInput";

interface Option { value: string; label: string }

interface ReportFiltersProps {
  /** Select filters, keyed by URL param. */
  selects?: { param: string; label: string; options: Option[] }[];
  /** Base API path for CSV export (current filters are appended). */
  csvHref?: string;
  searchPlaceholder?: string;
}

/** URL-driven filters (date range, selects, search) + CSV export link. */
export function ReportFilters({ selects = [], csvHref, searchPlaceholder = "Search student name or email…" }: ReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function set(name: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  const exportParams = new URLSearchParams(sp.toString());
  exportParams.delete("page");
  exportParams.set("format", "csv");

  const control = "h-9 px-2.5 rounded-[var(--r-md)] border text-[13px] bg-[var(--surface)]";
  const controlStyle = { borderColor: "var(--line-300)", color: "var(--ink-900)" };

  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <SearchInput placeholder={searchPlaceholder} />
      <label className="flex flex-col gap-1 text-[11.5px] font-semibold" style={{ color: "var(--fg-muted)" }}>
        From
        <input type="date" value={sp.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} className={control} style={controlStyle} />
      </label>
      <label className="flex flex-col gap-1 text-[11.5px] font-semibold" style={{ color: "var(--fg-muted)" }}>
        To
        <input type="date" value={sp.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} className={control} style={controlStyle} />
      </label>
      {selects.map((s) => (
        <label key={s.param} className="flex flex-col gap-1 text-[11.5px] font-semibold" style={{ color: "var(--fg-muted)" }}>
          {s.label}
          <select value={sp.get(s.param) ?? ""} onChange={(e) => set(s.param, e.target.value)} className={control} style={controlStyle}>
            <option value="">All</option>
            {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      ))}
      {sp.get("student") && (
        <button type="button" onClick={() => set("student", "")} className="h-9 px-3 rounded-[var(--r-md)] text-[12.5px] font-semibold"
          style={{ background: "var(--cobalt-50)", color: "var(--cobalt-700)" }}>
          One student · clear ✕
        </button>
      )}
      {csvHref && (
        <a href={`${csvHref}?${exportParams.toString()}`}
          className="h-9 inline-flex items-center gap-1.5 px-3 rounded-[var(--r-md)] border text-[13px] font-semibold ml-auto hover:bg-[var(--fill-100)]"
          style={{ borderColor: "var(--line-300)", color: "var(--ink-900)" }}>
          <Download size={14} /> Export CSV
        </a>
      )}
    </div>
  );
}
