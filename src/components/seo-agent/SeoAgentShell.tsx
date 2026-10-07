"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { SeoAgentSidebar } from "./SeoAgentSidebar";

interface SeoAgentShellProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Chrome for /admin/seo-agent/* — same layout as AdminShell, own navigation. */
export function SeoAgentShell({ title, subtitle, actions, children }: SeoAgentShellProps) {
  const pathname = usePathname();
  // The mobile menu is open only for the path it was opened on, so it closes
  // itself on navigation without a state-syncing effect.
  const [menuOpenedAt, setMenuOpenedAt] = useState<string | null>(null);
  const mobileMenuOpen = menuOpenedAt === pathname;

  return (
    <div className="flex h-screen overflow-hidden">
      <SeoAgentSidebar mobileOpen={mobileMenuOpen} onClose={() => setMenuOpenedAt(null)} />
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <AdminTopBar title={title} subtitle={subtitle} actions={actions} onMenuOpen={() => setMenuOpenedAt(pathname)} />
        <main className="oa-scroll flex-1 min-h-0 overflow-y-auto p-4 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
