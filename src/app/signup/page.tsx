"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand";
import { OAButton } from "@/components/ui";
import { signup } from "@/actions/auth";

const initialState = { error: "" };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const result = await signup(formData);
      return result ?? initialState;
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

      <form
        action={formAction}
        className="oa-fade relative w-[380px] rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] p-8"
        style={{ background: "var(--surface)" }}
      >
        <Logo size={32} />

        <h1
          className="font-bold text-[26px] tracking-tight mt-6 mb-1.5"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          Create your account.
        </h1>
        <p className="text-[14px] leading-[1.5] mb-6" style={{ color: "var(--fg-muted)" }}>
          Free to start. Your personal Olympiad coach is ready in minutes.
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
          Full name
        </label>
        <input
          name="full_name"
          type="text"
          required
          placeholder="Aarav Sharma"
          className="mt-1.5 mb-3.5 w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[11px] text-[14px] outline-none focus:border-[var(--cobalt-400)] focus:ring-2 focus:ring-[var(--cobalt-500)]/20 transition-colors"
          style={{ background: "var(--surface)", color: "var(--ink-900)" }}
        />

        <label className="text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder="you@school.edu"
          className="mt-1.5 mb-3.5 w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[11px] text-[14px] outline-none focus:border-[var(--cobalt-400)] focus:ring-2 focus:ring-[var(--cobalt-500)]/20 transition-colors"
          style={{ background: "var(--surface)", color: "var(--ink-900)" }}
        />

        <label className="text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="At least 6 characters"
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
          {pending ? "Creating account…" : "Get started free"}
          <ArrowRight size={18} />
        </OAButton>

        <p className="text-center text-[12.5px] mt-4" style={{ color: "var(--fg-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold" style={{ color: "var(--brand)" }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
