"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { OAButton } from "@/components/ui";
import { resendEmailOtp, verifyEmailOtp } from "@/actions/email-verification";

const RESEND_COOLDOWN_SECONDS = 60;
const initialState = { error: "", notice: "" };

export function VerifyEmailForm() {
  const [code, setCode] = useState("");
  // The signup action just sent a code, so start with the cooldown running.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendState, setResendState] = useState(initialState);
  const [resending, startResend] = useTransition();

  const [state, formAction, pending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const result = await verifyEmailOtp(formData);
      return result ?? initialState;
    },
    initialState
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleResend() {
    startResend(async () => {
      const result = await resendEmailOtp();
      if (!result) return;
      setResendState({ error: result.error, notice: result.notice });
      setCooldown(result.error ? (result.retryAfterSeconds ?? 0) : RESEND_COOLDOWN_SECONDS);
      if (!result.error) setCode("");
    });
  }

  const error = state.error || resendState.error;
  const notice = !state.error ? resendState.notice : "";

  return (
    <form action={formAction} className="text-left">
      {error && (
        <div
          className="mb-4 px-3 py-2.5 rounded-[var(--r-md)] text-[13px] font-medium"
          style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          className="mb-4 px-3 py-2.5 rounded-[var(--r-md)] text-[13px] font-medium"
          style={{ background: "var(--cobalt-50)", color: "var(--brand)" }}
        >
          {notice}
        </div>
      )}

      <label htmlFor="code" className="text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>
        Verification code
      </label>
      <input
        id="code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="••••••"
        className="mt-1.5 mb-5 w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[11px] text-center text-[24px] tracking-[0.5em] outline-none focus:border-[var(--cobalt-400)] focus:ring-2 focus:ring-[var(--cobalt-500)]/20 transition-colors"
        style={{ background: "var(--surface)", color: "var(--ink-900)", fontFamily: "var(--font-mono)" }}
      />

      <OAButton
        type="submit"
        variant="primary"
        size="lg"
        disabled={pending || code.length !== 6}
        className="w-full justify-between"
      >
        {pending ? "Verifying…" : "Verify email"}
        <ArrowRight size={18} />
      </OAButton>

      <p className="text-center text-[12.5px] mt-4" style={{ color: "var(--fg-muted)" }}>
        Didn&rsquo;t get it? Check spam, or{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ color: "var(--brand)" }}
        >
          {resending ? "sending…" : cooldown > 0 ? `resend code in ${cooldown}s` : "resend code"}
        </button>
      </p>
    </form>
  );
}
