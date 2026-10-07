"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bot, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { SEO_NAV, type SeoNavItem } from "./nav";

interface SeoAgentSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function SeoAgentSidebar({ mobileOpen, onClose }: SeoAgentSidebarProps) {
  const pathname = usePathname();

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
      <aside
        className={cn(
          "flex flex-col border-r border-[var(--line-200)] bg-[var(--surface)]",
          "fixed top-0 left-0 h-screen z-50 transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0 lg:h-full lg:z-auto lg:transition-none",
        )}
        style={{ width: 248, flexShrink: 0 }}
      >
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={26} />
            <span
              className="inline-flex items-center gap-1 text-[12px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: "var(--cobalt-50)", color: "var(--cobalt-700)" }}
            >
              <Bot size={12} aria-hidden /> SEO Agent
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

        <Link
          href="/admin/dashboard"
          onClick={onClose}
          className="mx-3 mb-2 flex items-center gap-2 px-[11px] py-[7px] rounded-[var(--r-md)] text-[12.5px] font-medium text-[var(--ink-500)] hover:bg-[var(--fill-100)]"
        >
          <ArrowLeft size={14} aria-hidden /> Back to main admin
        </Link>

        <nav className="oa-scroll flex-1 min-h-0 overflow-y-auto pb-4" aria-label="SEO Agent navigation">
          {SEO_NAV.map((group, i) => (
            <div key={group.label ?? `group-${i}`} className="px-3">
              {group.label && <div className="px-2 pt-4 pb-1.5 t-overline">{group.label}</div>}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.href} item={item} active={isActive(pathname, item.href)} onClick={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavItem({ item, active, onClick }: { item: SeoNavItem; active: boolean; onClick: () => void }) {
  const { href, label, Icon, comingInPhase } = item;
  const base = "flex items-center gap-[11px] px-[11px] py-[8px] rounded-[var(--r-md)] text-[13.5px] font-medium";

  if (comingInPhase) {
    return (
      <span className={cn(base, "text-[var(--ink-400)] cursor-default")} title={`Arrives in build phase ${comingInPhase}`}>
        <Icon size={18} style={{ color: "var(--ink-400)", flexShrink: 0 }} aria-hidden />
        <span className="flex-1 truncate">{label}</span>
        <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--fill-100)", color: "var(--ink-500)" }}>
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        base,
        "transition-colors duration-[140ms]",
        active
          ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)] font-semibold"
          : "text-[var(--ink-700)] hover:bg-[var(--fill-100)]",
      )}
    >
      <Icon size={18} style={{ color: active ? "var(--cobalt-500)" : "var(--ink-500)", flexShrink: 0 }} aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}
