import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/actions/auth";
import { VerifyEmailForm } from "./VerifyEmailForm";

export const metadata: Metadata = {
  title: "Verify Your Email | OlympiadIQ",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

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
        className="oa-fade relative w-full max-w-[380px] rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] p-8 text-center"
        style={{ background: "var(--surface)" }}
      >
        <Link href="/" className="inline-block w-fit">
          <Logo size={32} />
        </Link>

        <div
          className="w-16 h-16 mx-auto mt-7 mb-5 rounded-full flex items-center justify-center"
          style={{ background: "var(--cobalt-50)" }}
        >
          <MailCheck size={30} style={{ color: "var(--brand)" }} />
        </div>

        <h1
          className="font-bold text-[24px] tracking-tight mb-2"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          Verify your email.
        </h1>
        <p className="text-[14px] leading-[1.6] mb-6" style={{ color: "var(--fg-muted)" }}>
          We sent a 6-digit code to{" "}
          <span className="font-semibold break-all" style={{ color: "var(--ink-900)" }}>{user.email}</span>.
          Enter it below to unlock your account.
        </p>

        <VerifyEmailForm />

        <form action={logout} className="mt-5">
          <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            Wrong email?{" "}
            <button type="submit" className="font-semibold" style={{ color: "var(--brand)" }}>
              Sign out and start over
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
