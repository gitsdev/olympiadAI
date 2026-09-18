"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";

interface AdminShellProps {
  adminName: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function AdminShell({ adminName, title, subtitle, actions, children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar adminName={adminName} mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <AdminTopBar title={title} subtitle={subtitle} actions={actions} onMenuOpen={() => setMobileMenuOpen(true)} />
        <main className="oa-scroll flex-1 min-h-0 overflow-y-auto p-4 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
