"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OACard } from "@/components/ui";
import { useStudent } from "@/contexts/StudentContext";

interface Trick {
  emoji: string;
  title: string;
  desc: string;
  prompt: string;
}

const BASE_TRICKS: Trick[] = [
  { emoji: "⚡", title: "Speed Addition & Subtraction", desc: "Add and subtract large numbers in seconds.",       prompt: "Teach me speed tricks for addition and subtraction." },
  { emoji: "✖️", title: "Fast Multiplication",           desc: "Multiply two- and three-digit numbers instantly.", prompt: "Teach me fast multiplication tricks." },
  { emoji: "➗", title: "Division Shortcuts",             desc: "Spot divisibility and divide without long division.", prompt: "Teach me division shortcuts." },
  { emoji: "🔢", title: "Square & Cube Tricks",           desc: "Squares and cubes of numbers, mentally.",         prompt: "Teach me tricks for calculating squares and cubes quickly." },
  { emoji: "💯", title: "Percentage Tricks",              desc: "Work out percentages without a calculator.",      prompt: "Teach me percentage calculation tricks." },
  { emoji: "🍕", title: "Fractions & Decimals",           desc: "Convert and compare fractions and decimals fast.", prompt: "Teach me tricks for fractions and decimals." },
  { emoji: "📐", title: "Geometry Shortcuts",             desc: "Quick formulas and angle-spotting tricks.",       prompt: "Teach me geometry shortcuts and formulas." },
  { emoji: "🧠", title: "Mental Maths",                   desc: "Do arithmetic entirely in your head.",            prompt: "Teach me mental maths tricks." },
  { emoji: "⏱️", title: "10-Second Calculation Tricks",   desc: "Solve common problems before the clock moves.",   prompt: "Teach me 10-second calculation tricks." },
  { emoji: "🏆", title: "Olympiad-Specific Tricks",       desc: "Shortcuts built for Olympiad-style questions.",   prompt: "Teach me Olympiad-specific maths tricks." },
  { emoji: "🎯", title: "Tricks by Class (1–10)",         desc: "Tricks matched to your class level.",             prompt: "" },
  { emoji: "🔥", title: "Daily Maths Trick",              desc: "A fresh trick to learn today.",                   prompt: "Give me a fun maths trick to learn today." },
];

export default function MathsTricksPage() {
  const user = useStudent();

  const tricks = BASE_TRICKS.map((t) =>
    t.title === "Tricks by Class (1–10)"
      ? { ...t, prompt: `Teach me maths tricks appropriate for Class ${user.cls}.`, desc: `Tricks matched to Class ${user.cls}.` }
      : t
  );

  return (
    <AppShell title="Maths Tricks" subtitle="Quick tricks and shortcuts, taught by your AI tutor">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-7 py-6 pb-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {tricks.map((t) => (
            <Link key={t.title} href={`/tutor?q=${encodeURIComponent(t.prompt)}`} className="group">
              <OACard
                hover
                noPadding
                className="flex flex-col overflow-hidden h-full transition-all duration-[140ms] group-hover:shadow-[var(--shadow-md)]"
              >
                <div className="p-5 flex flex-col gap-2.5 flex-1">
                  <div
                    className="w-11 h-11 rounded-[var(--r-md)] flex items-center justify-center text-[22px]"
                    style={{ background: "var(--cobalt-50)" }}
                  >
                    {t.emoji}
                  </div>
                  <h3
                    className="font-bold text-[14.5px] leading-snug tracking-tight mt-0.5"
                    style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
                  >
                    {t.title}
                  </h3>
                  <p className="text-[12px] leading-[1.5] flex-1" style={{ color: "var(--fg-muted)" }}>
                    {t.desc}
                  </p>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold mt-1" style={{ color: "var(--brand)" }}>
                    Ask the tutor
                    <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </OACard>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
