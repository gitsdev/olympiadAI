"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminTopBarProps {
  title: string;
  subtitle?: string;
  onMenuOpen: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function AdminTopBar({ title, subtitle, onMenuOpen, actions, className }: AdminTopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 px-4 lg:px-7 border-b border-[var(--line-200)]",
        "bg-[oklch(0.992_0.004_95_/_0.82)] backdrop-blur-[10px]",
        subtitle ? "py-3" : "py-[14px]",
        className
      )}
    >
      <button
        onClick={onMenuOpen}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-[var(--r-md)] border border-[var(--line-200)] bg-[var(--surface)] transition-colors hover:bg-[var(--fill-100)] shrink-0"
        aria-label="Open menu"
      >
        <Menu size={18} style={{ color: "var(--ink-700)" }} />
      </button>

      <div className="min-w-0 flex-1">
        <h1
          className="font-bold text-[18px] lg:text-[21px] leading-tight tracking-[-0.015em] truncate"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[12px] lg:text-[13px] mt-0.5 truncate" style={{ color: "var(--fg-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}

      <Link
        href="/blog"
        className="hidden sm:inline text-[12.5px] hover:underline shrink-0"
        style={{ color: "var(--fg-muted)" }}
      >
        View site ↗
      </Link>
    </header>
  );
}
