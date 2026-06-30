import Link from "next/link";
import { Mail } from "lucide-react";
import { Logo } from "@/components/brand";

export default function ConfirmPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative graph-bg"
      style={{ background: "var(--paper)", backgroundSize: "26px 26px" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(80% 60% at 50% 0%, oklch(0.52 0.195 259 / 0.10), transparent 60%)" }}
      />

      <div
        className="oa-fade relative w-[380px] rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] p-8 text-center"
        style={{ background: "var(--surface)" }}
      >
        <Logo size={32} />

        <div
          className="w-16 h-16 mx-auto mt-7 mb-5 rounded-full flex items-center justify-center"
          style={{ background: "var(--cobalt-50)" }}
        >
          <Mail size={30} style={{ color: "var(--brand)" }} />
        </div>

        <h1
          className="font-bold text-[24px] tracking-tight mb-2"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          Check your email.
        </h1>
        <p className="text-[14px] leading-[1.6] mb-6" style={{ color: "var(--fg-muted)" }}>
          We sent a confirmation link to your inbox. Click it to activate your account and set up your Olympiad profile.
        </p>

        <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          Already confirmed?{" "}
          <Link href="/login" className="font-semibold" style={{ color: "var(--brand)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
