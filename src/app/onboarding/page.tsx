"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Play, Target } from "lucide-react";
import { Logo } from "@/components/brand";
import { OAButton, OASubjectDot, type Subject } from "@/components/ui";
import { cn } from "@/lib/utils";
import { saveOnboarding } from "@/actions/onboarding";

const STEPS = ["Your class", "Your subjects", "Diagnostic"];
const SUBJECTS: Subject[] = ["Mathematics", "Science", "English", "General Knowledge", "Cyber"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [board, setBoard] = useState<"CBSE" | "ICSE">("CBSE");
  const [cls, setCls] = useState(7);
  const [subs, setSubs] = useState<Subject[]>(["Mathematics", "Science"]);
  const [saving, setSaving] = useState(false);

  const toggle = (s: Subject) =>
    setSubs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <div
      className="min-h-screen flex flex-col relative graph-bg"
      style={{ background: "var(--paper)", backgroundSize: "26px 26px" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(70% 50% at 50% 0%, oklch(0.52 0.195 259 / 0.08), transparent 60%)",
        }}
      />

      <div className="relative px-7 py-5">
        <Logo size={28} />
      </div>

      <div className="relative flex-1 flex items-center justify-center p-6">
        <div
          key={step}
          className="oa-fade w-[540px] rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] px-9 py-8"
          style={{ background: "var(--surface)" }}
        >
          {/* Step progress */}
          <div className="flex gap-2 mb-7">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div
                  className="h-[5px] rounded-full transition-colors duration-300"
                  style={{ background: i <= step ? "var(--brand)" : "var(--fill-200)" }}
                />
                <div
                  className="text-[11px] font-semibold mt-1.5"
                  style={{ color: i === step ? "var(--brand)" : "var(--fg-subtle)" }}
                >
                  {s}
                </div>
              </div>
            ))}
          </div>

          {/* Step 0 — Board & Class */}
          {step === 0 && (
            <div>
              <h1 className="t-h2 mb-1.5">Let&apos;s set up your coach.</h1>
              <p className="text-[14.5px] mb-6" style={{ color: "var(--fg-muted)" }}>
                Tell us your board and class — we&apos;ll load the right syllabus.
              </p>

              <p className="text-[12.5px] font-semibold mb-2.5" style={{ color: "var(--ink-700)" }}>
                Board
              </p>
              <div className="flex gap-2.5 mb-6">
                {(["CBSE", "ICSE"] as const).map((b) => (
                  <PickButton key={b} active={board === b} onClick={() => setBoard(b)}>
                    {b}
                  </PickButton>
                ))}
              </div>

              <p className="text-[12.5px] font-semibold mb-2.5" style={{ color: "var(--ink-700)" }}>
                Class
              </p>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => (
                  <PickButton
                    key={c}
                    active={cls === c}
                    onClick={() => setCls(c)}
                    className="py-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {c}
                  </PickButton>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Subjects */}
          {step === 1 && (
            <div>
              <h1 className="t-h2 mb-1.5">What do you want to master?</h1>
              <p className="text-[14.5px] mb-6" style={{ color: "var(--fg-muted)" }}>
                Pick your Olympiad subjects. You can change these later.
              </p>
              <div className="flex flex-col gap-2.5">
                {SUBJECTS.map((s) => {
                  const on = subs.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggle(s)}
                      className={cn(
                        "flex items-center gap-3 text-left px-4 py-3.5 rounded-[var(--r-md)] cursor-pointer border-[1.5px] transition-all duration-[140ms]",
                        on
                          ? "border-[var(--cobalt-400)] bg-[var(--cobalt-50)]"
                          : "border-[var(--line-300)] bg-[var(--surface)]"
                      )}
                    >
                      <OASubjectDot subject={s} size={11} />
                      <span className="flex-1 text-[15px] font-semibold" style={{ color: "var(--ink-900)" }}>
                        {s}
                      </span>
                      <div
                        className={cn(
                          "w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 transition-all duration-[140ms]",
                          on ? "bg-[var(--brand)]" : "border-2 border-[var(--line-300)]"
                        )}
                      >
                        {on && <Check size={13} color="#fff" strokeWidth={2.5} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2 — Diagnostic */}
          {step === 2 && (
            <div className="text-center py-2">
              <div
                className="w-[76px] h-[76px] mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{ background: "var(--cobalt-50)" }}
              >
                <Target size={38} style={{ color: "var(--brand)" }} />
              </div>
              <h1 className="t-h2 mb-2.5">Take a 10-minute diagnostic.</h1>
              <p
                className="text-[15px] leading-[1.6] max-w-[400px] mx-auto mb-2"
                style={{ color: "var(--ink-700)" }}
              >
                A quick adaptive test maps what you already know across every chapter — then your
                tutor builds a plan around your gaps.
              </p>
              <div
                className="inline-flex gap-4 mt-4 mb-1"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--fg-muted)",
                }}
              >
                <span>~10 min</span>
                <span>·</span>
                <span>20 questions</span>
                <span>·</span>
                <span>
                  {board} Class {cls}
                </span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center mt-7">
            {step > 0 ? (
              <OAButton variant="ghost" size="md" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} />
                Back
              </OAButton>
            ) : (
              <span />
            )}
            <div className="flex-1" />
            {step < 2 ? (
              <OAButton variant="primary" size="md" onClick={() => setStep(step + 1)}>
                Continue
                <ArrowRight size={16} />
              </OAButton>
            ) : (
              <OAButton
                variant="primary"
                size="md"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await saveOnboarding({ board, classLevel: cls, subjects: subs });
                  } catch {
                    // redirect() throws internally — navigation already happened
                  }
                  setSaving(false);
                }}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Start diagnostic
              </OAButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PickButton({
  active,
  onClick,
  children,
  className,
  style,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 text-[15px] font-semibold py-3 rounded-[var(--r-md)] cursor-pointer border-[1.5px] transition-all duration-[140ms]",
        active
          ? "border-[var(--cobalt-400)] bg-[var(--cobalt-50)] text-[var(--cobalt-700)]"
          : "border-[var(--line-300)] bg-[var(--surface)] text-[var(--ink-700)]",
        className
      )}
      style={style}
    >
      {children}
    </button>
  );
}
