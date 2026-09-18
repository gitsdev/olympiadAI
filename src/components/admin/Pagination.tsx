"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

export function Pagination({ page, totalPages, totalCount, pageSize }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `${pathname}?${params.toString()}`;
  }

  if (totalCount === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <nav className="flex items-center justify-between gap-3 pt-4 flex-wrap" aria-label="Pagination">
      <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
        Showing {start}–{end} of {totalCount}
      </span>
      <div className="flex items-center gap-1.5">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={15} />
        </PageLink>
        <span className="text-[12.5px] px-2" style={{ color: "var(--ink-700)" }}>
          Page {page} of {totalPages}
        </span>
        <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight size={15} />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href, disabled, children, "aria-label": ariaLabel,
}: { href: string; disabled: boolean; children: React.ReactNode; "aria-label": string }) {
  if (disabled) {
    return (
      <span
        aria-disabled
        aria-label={ariaLabel}
        className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] border opacity-40 cursor-not-allowed"
        style={{ borderColor: "var(--line-200)", color: "var(--fg-muted)" }}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] border transition-colors",
        "hover:bg-[var(--fill-100)]"
      )}
      style={{ borderColor: "var(--line-200)", color: "var(--ink-700)" }}
    >
      {children}
    </Link>
  );
}
