import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand";
import { OAButton } from "@/components/ui";

export function PublicHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-[var(--line-200)]"
      style={{ background: "oklch(0.992 0.004 95 / 0.92)", backdropFilter: "blur(12px)" }}
    >
      <div className="max-w-[1160px] mx-auto px-5 sm:px-8 py-[14px] flex items-center gap-4">
        <Link href={loggedIn ? "/dashboard" : "/"}>
          <Logo size={28} />
        </Link>
        <nav className="hidden sm:flex items-center gap-5 ml-2">
          <Link href="/blog" className="text-[14px] font-medium" style={{ color: "var(--ink-700)" }}>
            Blog
          </Link>
          <Link href="/learn/subject/mathematics" className="text-[14px] font-medium" style={{ color: "var(--ink-700)" }}>
            Study guides
          </Link>
        </nav>
        <span className="flex-1" />
        {loggedIn ? (
          <Link href="/dashboard">
            <OAButton variant="secondary" size="sm">
              Go to dashboard <ArrowRight size={14} />
            </OAButton>
          </Link>
        ) : (
          <>
            <Link href="/login" className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>
              Log in
            </Link>
            <Link href="/onboarding">
              <OAButton variant="primary" size="sm">
                Try for free <ArrowRight size={14} />
              </OAButton>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
