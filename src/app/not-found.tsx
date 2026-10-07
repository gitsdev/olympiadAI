import Link from "next/link";
import { Compass, ArrowRight, BookOpen, Brain, PenLine } from "lucide-react";
import { Logo } from "@/components/brand";
import { OAButton } from "@/components/ui";

const SUGGESTIONS = [
  { href: "/learn/subject/mathematics", Icon: BookOpen, label: "Free topic guides" },
  { href: "/brain-booster",             Icon: Brain,    label: "Brain Booster games" },
  { href: "/blog",                      Icon: PenLine,  label: "Olympiad prep blog" },
];

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative graph-bg px-4"
      style={{ background: "var(--paper)", backgroundSize: "26px 26px" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(80% 60% at 50% 0%, oklch(0.52 0.195 259 / 0.10), transparent 60%)" }}
      />

      <div
        className="oa-fade relative w-full max-w-[420px] rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] p-8 text-center"
        style={{ background: "var(--surface)" }}
      >
        <Link href="/" className="inline-block w-fit">
          <Logo size={32} />
        </Link>

        <div
          className="w-16 h-16 mx-auto mt-7 mb-4 rounded-full flex items-center justify-center"
          style={{ background: "var(--cobalt-50)" }}
        >
          <Compass size={30} style={{ color: "var(--brand)" }} />
        </div>

        <p
          className="text-[13px] font-semibold tracking-wide mb-1"
          style={{ fontFamily: "var(--font-mono)", color: "var(--brand)" }}
        >
          ERROR 404
        </p>
        <h1
          className="font-bold text-[24px] tracking-tight mb-2"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          This page went off the syllabus.
        </h1>
        <p className="text-[14px] leading-[1.6] mb-6" style={{ color: "var(--fg-muted)" }}>
          The page you're looking for doesn't exist or has moved. Let's get you back to preparing.
        </p>

        <Link href="/" className="block mb-6">
          <OAButton variant="primary" size="lg" className="w-full">
            Back to home
          </OAButton>
        </Link>

        <div className="border-t border-[var(--line-200)] pt-5 text-left">
          <p className="text-[12.5px] font-semibold mb-2" style={{ color: "var(--fg-muted)" }}>
            Or try one of these
          </p>
          <ul className="flex flex-col gap-1">
            {SUGGESTIONS.map(({ href, Icon, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--r-md)] text-[14px] font-medium transition-colors hover:bg-[var(--cobalt-50)]"
                  style={{ color: "var(--ink-900)" }}
                >
                  <Icon size={16} style={{ color: "var(--brand)" }} />
                  <span className="flex-1">{label}</span>
                  <ArrowRight size={14} style={{ color: "var(--fg-muted)" }} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
