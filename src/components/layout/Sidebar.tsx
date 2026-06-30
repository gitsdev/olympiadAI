"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Sparkles, PencilLine, BarChart2,
  Route, FileText, Trophy, Flame,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { OAAvatar } from "@/components/ui";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard",     label: "Home",          Icon: Home },
  { href: "/tutor",         label: "AI Tutor",      Icon: Sparkles },
  { href: "/practice",      label: "Practice",      Icon: PencilLine },
  { href: "/results",       label: "Progress",      Icon: BarChart2 },
];

const LIBRARY_ITEMS = [
  { href: "/learn",         label: "Learning paths",  Icon: Route },
  { href: "/tests",         label: "Mock tests",      Icon: FileText },
  { href: "/achievements",  label: "Achievements",    Icon: Trophy },
];

interface SidebarProps {
  userName: string;
  board: string;
  cls: number;
  streakDays: number;
}

export function Sidebar({ userName, board, cls, streakDays }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col h-full border-r border-[var(--line-200)] bg-[var(--surface)]"
      style={{ width: 232, flexShrink: 0 }}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <Logo size={28} />
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || (href === "/dashboard" && pathname === "/");
          return (
            <NavItem key={href} href={href} label={label} Icon={Icon} active={active} />
          );
        })}
      </nav>

      {/* Library section */}
      <div className="px-5 pt-5 pb-2 t-overline">Library</div>
      <nav className="flex flex-col gap-0.5 px-3">
        {LIBRARY_ITEMS.map(({ href, label, Icon }) => (
          <NavItem key={href} href={href} label={label} Icon={Icon} active={pathname === href} />
        ))}
      </nav>

      <div className="flex-1" />

      {/* Streak widget */}
      {streakDays > 0 && (
        <div
          className="mx-3 mb-3 rounded-[var(--r-lg)] p-3 graph-bg"
          style={{ background: "var(--paper-2)", backgroundSize: "18px 18px" }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Flame size={16} style={{ color: "var(--gold-500)" }} />
            <span
              className="text-[13px] font-bold"
              style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}
            >
              {streakDays}-day streak
            </span>
          </div>
          <p className="text-[11.5px] leading-[1.4]" style={{ color: "var(--ink-700)" }}>
            Practice today to keep it alive.
          </p>
        </div>
      )}

      {/* User row */}
      <Link
        href="/settings"
        className={cn(
          "flex items-center gap-2.5 mx-3 mb-3 px-2 py-2 rounded-[var(--r-md)]",
          "transition-colors duration-[140ms] hover:bg-[var(--fill-100)]"
        )}
      >
        <OAAvatar name={userName} size={32} />
        <div className="flex flex-col overflow-hidden">
          <span className="text-[13px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>
            {userName}
          </span>
          <span className="text-[11px] truncate" style={{ color: "var(--fg-muted)" }}>
            {board} · Class {cls}
          </span>
        </div>
      </Link>
    </aside>
  );
}

function NavItem({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-[11px] px-[11px] py-[9px] rounded-[var(--r-md)]",
        "text-[14px] font-medium transition-colors duration-[140ms]",
        active
          ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)] font-semibold"
          : "text-[var(--ink-700)] hover:bg-[var(--fill-100)]"
      )}
    >
      <Icon
        size={19}
        style={{ color: active ? "var(--cobalt-500)" : "var(--ink-500)", flexShrink: 0 }}
      />
      {label}
    </Link>
  );
}
