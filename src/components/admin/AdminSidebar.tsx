"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, Sparkles, TrendingUp,
  Newspaper, Settings, X, ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/students", label: "Students", Icon: Users },
  { href: "/admin/mock-tests", label: "Mock Tests", Icon: FileText },
  { href: "/admin/ai-tutor", label: "AI Tutor", Icon: Sparkles },
  { href: "/admin/progress", label: "Student Progress", Icon: TrendingUp },
];

const SECONDARY_ITEMS = [
  { href: "/admin/blog", label: "Blog", Icon: Newspaper },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

interface AdminSidebarProps {
  adminName: string;
  mobileOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ adminName, mobileOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const inner = (
    <aside
      className={cn(
        "flex flex-col border-r border-[var(--line-200)] bg-[var(--surface)]",
        "fixed top-0 left-0 h-screen z-50 transition-transform duration-200 ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:static lg:translate-x-0 lg:h-full lg:z-auto lg:transition-none",
      )}
      style={{ width: 240, flexShrink: 0 }}
    >
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <span
            className="text-[12px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: "var(--cobalt-50)", color: "var(--cobalt-700)" }}
          >
            Admin
          </span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] transition-colors hover:bg-[var(--fill-100)]"
          aria-label="Close menu"
        >
          <X size={18} style={{ color: "var(--ink-700)" }} />
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-3" aria-label="Admin navigation">
        {NAV_ITEMS.map(({ href, label, Icon }) => (
          <NavItem key={href} href={href} label={label} Icon={Icon} active={pathname.startsWith(href)} onClick={onClose} />
        ))}
      </nav>

      <div className="px-5 pt-5 pb-2 t-overline">Platform</div>
      <nav className="flex flex-col gap-0.5 px-3" aria-label="Platform administration">
        {SECONDARY_ITEMS.map(({ href, label, Icon }) => (
          <NavItem key={href} href={href} label={label} Icon={Icon} active={pathname.startsWith(href)} onClick={onClose} />
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5 mx-3 mb-4 px-2 py-2 rounded-[var(--r-md)]" style={{ background: "var(--paper-2)" }}>
        <ShieldCheck size={18} style={{ color: "var(--cobalt-500)", flexShrink: 0 }} />
        <div className="flex flex-col overflow-hidden">
          <span className="text-[12.5px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>
            {adminName}
          </span>
          <span className="text-[11px] truncate" style={{ color: "var(--fg-muted)" }}>
            Platform admin
          </span>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 lg:hidden transition-opacity duration-200",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden
      />
      {inner}
    </>
  );
}

function NavItem({
  href, label, Icon, active, onClick,
}: {
  href: string; label: string; Icon: React.ElementType; active: boolean; onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-[11px] px-[11px] py-[9px] rounded-[var(--r-md)]",
        "text-[14px] font-medium transition-colors duration-[140ms]",
        active
          ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)] font-semibold"
          : "text-[var(--ink-700)] hover:bg-[var(--fill-100)]"
      )}
    >
      <Icon size={19} style={{ color: active ? "var(--cobalt-500)" : "var(--ink-500)", flexShrink: 0 }} />
      {label}
    </Link>
  );
}
