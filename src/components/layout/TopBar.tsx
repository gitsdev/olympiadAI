"use client";

import Link from "next/link";
import { Bell, Coins, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudent } from "@/contexts/StudentContext";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onSearchOpen: () => void;
  onMenuOpen: () => void;
  className?: string;
}

export function TopBar({ title, subtitle, onSearchOpen, onMenuOpen, className }: TopBarProps) {
  const { creditBalance } = useStudent();
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 px-4 lg:px-7 border-b border-[var(--line-200)]",
        "bg-[oklch(0.992_0.004_95_/_0.82)] backdrop-blur-[10px]",
        subtitle ? "py-3" : "py-[14px]",
        className
      )}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuOpen}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-[var(--r-md)] border border-[var(--line-200)] bg-[var(--surface)] transition-colors hover:bg-[var(--fill-100)] shrink-0"
        aria-label="Open menu"
      >
        <Menu size={18} style={{ color: "var(--ink-700)" }} />
      </button>

      {/* Title block */}
      <div className="min-w-0 flex-1 lg:flex-none">
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

      <div className="flex-1" />

      {/* Search bar — desktop only */}
      <button
        onClick={onSearchOpen}
        className={cn(
          "hidden lg:flex items-center gap-2.5 w-[280px] px-3 py-2.5 cursor-text",
          "border border-[var(--line-300)] rounded-[var(--r-md)] bg-[var(--surface)]",
          "transition-colors duration-[120ms] hover:border-[var(--cobalt-300)]"
        )}
        aria-label="Open search (⌘K)"
      >
        <Search size={16} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
        <span className="flex-1 text-left text-[13.5px] truncate" style={{ color: "var(--fg-subtle)" }}>
          Teach me anything…
        </span>
        <span
          className="text-[11px] px-1.5 py-0.5 rounded"
          style={{ fontFamily: "var(--font-mono)", background: "var(--fill-100)", color: "var(--fg-muted)" }}
        >
          ⌘K
        </span>
      </button>

      {/* Search icon — mobile only */}
      <button
        onClick={onSearchOpen}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-[var(--r-md)] border border-[var(--line-200)] bg-[var(--surface)] transition-colors hover:bg-[var(--fill-100)] shrink-0"
        aria-label="Search"
      >
        <Search size={18} style={{ color: "var(--ink-700)" }} />
      </button>

      {/* Credit balance → My Credits */}
      {creditBalance !== null && (
        <Link
          href="/credits"
          className={cn(
            "h-9 flex items-center gap-1.5 px-2.5 rounded-[var(--r-md)] shrink-0",
            "border border-[var(--gold-300)] bg-[var(--gold-50)]",
            "transition-colors duration-[120ms] hover:bg-[var(--gold-100)]"
          )}
          aria-label={`${creditBalance} credits — open My Credits`}
          title="My Credits"
        >
          <Coins size={16} style={{ color: "var(--gold-700)" }} />
          <span
            className="text-[13px] font-bold tabular-nums"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}
          >
            {creditBalance.toLocaleString("en-IN")}
          </span>
        </Link>
      )}

      {/* Bell */}
      <button
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-[var(--r-md)]",
          "border border-[var(--line-200)] bg-[var(--surface)]",
          "transition-colors duration-[120ms] hover:bg-[var(--fill-100)]"
        )}
        aria-label="Notifications"
      >
        <Bell size={19} style={{ color: "var(--ink-700)" }} />
      </button>
    </header>
  );
}
