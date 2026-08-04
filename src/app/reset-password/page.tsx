import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Logo } from "@/components/brand";
import { getSession } from "@/actions/auth";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage() {
  const user = await getSession();

  return (
    <div
      className="min-h-screen flex items-center justify-center relative graph-bg"
      style={{ background: "var(--paper)", backgroundSize: "26px 26px" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(80% 60% at 50% 0%, oklch(0.52 0.195 259 / 0.10), transparent 60%)" }}
      />

      {user ? (
        <ResetPasswordForm />
      ) : (
        <div
          className="oa-fade relative w-[380px] rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] p-8 text-center"
          style={{ background: "var(--surface)" }}
        >
          <Logo size={32} />

          <div
            className="w-16 h-16 mx-auto mt-7 mb-5 rounded-full flex items-center justify-center"
            style={{ background: "var(--danger-bg)" }}
          >
            <AlertTriangle size={28} style={{ color: "var(--danger)" }} />
          </div>

          <h1
            className="font-bold text-[24px] tracking-tight mb-2"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
          >
            Link expired.
          </h1>
          <p className="text-[14px] leading-[1.6] mb-6" style={{ color: "var(--fg-muted)" }}>
            This password reset link is invalid or has expired. Request a new one to continue.
          </p>

          <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            <Link href="/forgot-password" className="font-semibold" style={{ color: "var(--brand)" }}>
              Request a new link
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
