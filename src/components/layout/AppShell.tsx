"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SearchPalette } from "./SearchPalette";
import { useStudent } from "@/contexts/StudentContext";

interface AppShellProps {
  title: string;
  subtitle?: string;
  noScroll?: boolean;
  children: React.ReactNode;
}

export function AppShell({ title, subtitle, noScroll = false, children }: AppShellProps) {
  const user = useStudent();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userName={user.name}
        board={user.board}
        cls={user.cls}
        streakDays={user.streakDays}
      />

      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <TopBar
          title={title}
          subtitle={subtitle}
          onSearchOpen={() => setSearchOpen(true)}
        />

        {noScroll ? (
          <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
        ) : (
          <main className="oa-scroll flex-1 min-h-0 overflow-y-auto">
            {children}
          </main>
        )}
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
