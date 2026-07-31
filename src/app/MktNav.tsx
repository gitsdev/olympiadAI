"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand";
import { OAButton } from "@/components/ui";

const NAV_LINKS = ["Platform", "AI Tutor", "Subjects", "For parents", "Pricing"];

export function MktNav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-30 border-b border-[var(--line-200)]"
      style={{ background: "oklch(0.992 0.004 95 / 0.92)", backdropFilter: "blur(12px)" }}
    >
      {/* ── Top bar ── */}
      <div className="max-w-[1160px] mx-auto px-5 sm:px-8 py-[14px] flex items-center gap-4 sm:gap-8">
        <Logo size={28} />

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-6 ml-3">
          {NAV_LINKS.map((l) => (
            <a
              key={l}
              href="#"
              className="text-[14px] font-medium transition-colors duration-[120ms] hover:text-[var(--ink-900)]"
              style={{ color: "var(--ink-700)", textDecoration: "none" }}
            >
              {l}
            </a>
          ))}
        </nav>

        <span className="flex-1" />

        {/* Desktop: Log in + CTA */}
        <Link href="/login" className="hidden md:block text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>
          Log in
        </Link>
        <Link href="/onboarding" className="hidden sm:block">
          <OAButton variant="primary" size="sm">
            Register Now <ArrowRight size={14} />
          </OAButton>
        </Link>

        {/* Mobile: hamburger */}
        <button
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-[var(--r-md)] border border-[var(--line-300)] cursor-pointer transition-colors hover:bg-[var(--fill-100)]"
          style={{ background: "var(--surface)" }}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={18} style={{ color: "var(--ink-700)" }} /> : <Menu size={18} style={{ color: "var(--ink-700)" }} />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {open && (
        <div
          className="md:hidden border-t border-[var(--line-200)] px-5 py-4 flex flex-col gap-1"
          style={{ background: "var(--surface)" }}
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l}
              href="#"
              onClick={() => setOpen(false)}
              className="text-[15px] font-medium py-2.5 px-3 rounded-[var(--r-md)] transition-colors hover:bg-[var(--fill-100)]"
              style={{ color: "var(--ink-800)", textDecoration: "none" }}
            >
              {l}
            </a>
          ))}

          <div className="h-px my-2" style={{ background: "var(--line-200)" }} />

          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="text-[15px] font-semibold py-2.5 px-3 rounded-[var(--r-md)] transition-colors hover:bg-[var(--fill-100)]"
            style={{ color: "var(--ink-900)", textDecoration: "none" }}
          >
            Log in
          </Link>
          <Link href="/onboarding" onClick={() => setOpen(false)}>
            <OAButton variant="primary" size="md" className="w-full mt-1">
              Register Now <ArrowRight size={15} />
            </OAButton>
          </Link>
        </div>
      )}
    </header>
  );
}
