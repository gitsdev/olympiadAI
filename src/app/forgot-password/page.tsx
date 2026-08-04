"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Mail } from "lucide-react";
import { Logo } from "@/components/brand";
import { OAButton } from "@/components/ui";
import { requestPasswordReset } from "@/actions/auth";

const initialState = { error: "", sent: false };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const result = await requestPasswordReset(formData);
      return { error: result?.error ?? "", sent: !result?.error };
    },
    initialState
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center relative graph-bg"
      style={{ background: "var(--paper)", backgroundSize: "26px 26px" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(80% 60% at 50% 0%, oklch(0.52 0.195 259 / 0.10), transparent 60%)" }}
      />

      {state.sent ? (
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
            If an account exists for that address, we&apos;ve sent a link to reset your password. It&apos;s valid for 1 hour.
          </p>

          <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            <Link href="/login" className="font-semibold" style={{ color: "var(--brand)" }}>
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form
          action={formAction}
          className="oa-fade relative w-[380px] rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] p-8"
          style={{ background: "var(--surface)" }}
        >
          <Link href="/login" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold mb-5" style={{ color: "var(--fg-muted)" }}>
            <ArrowLeft size={14} /> Back to sign in
          </Link>

          <Logo size={32} />

          <h1
            className="font-bold text-[26px] tracking-tight mt-6 mb-1.5"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
          >
            Reset your password.
          </h1>
          <p className="text-[14px] leading-[1.5] mb-6" style={{ color: "var(--fg-muted)" }}>
            Enter your email and we&apos;ll send you a link to get back into your account.
          </p>

          {state.error && (
            <div
              className="mb-4 px-3 py-2.5 rounded-[var(--r-md)] text-[13px] font-medium"
              style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}
            >
              {state.error}
            </div>
          )}

          <label className="text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="you@school.edu"
            className="mt-1.5 mb-6 w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[11px] text-[14px] outline-none focus:border-[var(--cobalt-400)] focus:ring-2 focus:ring-[var(--cobalt-500)]/20 transition-colors"
            style={{ background: "var(--surface)", color: "var(--ink-900)" }}
          />

          <OAButton
            type="submit"
            variant="primary"
            size="lg"
            disabled={pending}
            className="w-full justify-between"
          >
            {pending ? "Sending…" : "Send reset link"}
            <ArrowRight size={18} />
          </OAButton>
        </form>
      )}
    </div>
  );
}
