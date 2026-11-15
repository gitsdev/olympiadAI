"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/credits", label: "Overview", exact: true },
  { href: "/admin/credits/pricing", label: "Feature pricing" },
  { href: "/admin/credits/students", label: "Student wallets" },
  { href: "/admin/credits/purchases", label: "Purchases" },
  { href: "/admin/credits/transactions", label: "Reports" },
];

export function CreditsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 mb-5" aria-label="Credit management">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 rounded-[var(--r-md)] text-[13.5px] font-semibold whitespace-nowrap transition-colors",
              active ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)]" : "text-[var(--ink-500)] hover:bg-[var(--fill-100)]",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
