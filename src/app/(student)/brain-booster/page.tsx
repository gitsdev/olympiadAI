"use client";

import Link from "next/link";
import { Brain, Gauge, Eye, Timer, Lock, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout";
import { OACard } from "@/components/ui";

const BENEFITS = [
  { Icon: Gauge, title: "Faster processing", desc: "Short, timed challenges train the brain to recognise patterns and react quicker." },
  { Icon: Eye,   title: "Sharper focus",      desc: "Scanning and sequencing games build the sustained attention exams demand." },
  { Icon: Timer, title: "Calm under time pressure", desc: "Regular practice against the clock makes real test timers feel less stressful." },
];

interface Game {
  slug: string;
  title: string;
  emoji: string;
  desc: string;
  live: boolean;
}

const GAMES: Game[] = [
  { slug: "number-ninja", title: "Number Ninja", emoji: "🥷", desc: "Slice the numbers 1 → N in order, as fast as you can.", live: true },
  { slug: "memory-match",  title: "Memory Match",  emoji: "🧩", desc: "Flip and match pairs to train visual memory.", live: false },
  { slug: "pattern-blitz", title: "Pattern Blitz",  emoji: "🔷", desc: "Spot the next shape in the sequence before time runs out.", live: false },
];

export default function BrainBoosterPage() {
  return (
    <AppShell title="Brain Booster" subtitle="Quick games that sharpen focus, speed & memory">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-7 py-6 pb-10">
        {/* Intro */}
        <OACard className="mb-7 flex flex-col sm:flex-row gap-5 sm:items-center">
          <div
            className="w-14 h-14 rounded-[var(--r-lg)] flex items-center justify-center shrink-0"
            style={{ background: "var(--cobalt-50)" }}
          >
            <Brain size={28} style={{ color: "var(--cobalt-500)" }} />
          </div>
          <div>
            <h2
              className="font-bold text-[17px] leading-snug tracking-tight mb-1.5"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
            >
              Why brain booster games matter
            </h2>
            <p className="text-[13px] leading-[1.6]" style={{ color: "var(--fg-muted)" }}>
              Olympiad and school exams don&apos;t just test what your child knows — they test how quickly and
              calmly they can think under pressure. A few minutes of playful, timed cognitive games alongside
              regular practice builds the focus, mental speed, and working memory that curriculum study alone
              doesn&apos;t always reach.
            </p>
          </div>
        </OACard>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8">
          {BENEFITS.map(({ Icon, title, desc }) => (
            <OACard key={title} className="flex flex-col gap-2">
              <Icon size={18} style={{ color: "var(--cobalt-500)" }} />
              <h3 className="font-bold text-[13.5px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
                {title}
              </h3>
              <p className="text-[12px] leading-[1.5]" style={{ color: "var(--fg-muted)" }}>
                {desc}
              </p>
            </OACard>
          ))}
        </div>

        {/* Game thumbnails */}
        <div className="px-1 pb-3 t-overline">Games</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {GAMES.map((g) => {
            const card = (
              <OACard
                hover={g.live}
                noPadding
                className={`flex flex-col overflow-hidden h-full transition-all duration-[140ms] ${
                  g.live ? "group-hover:shadow-[var(--shadow-md)]" : "opacity-60"
                }`}
              >
                <div
                  className="flex items-center justify-center text-[40px] h-[104px]"
                  style={{ background: "var(--cobalt-50)" }}
                >
                  {g.emoji}
                </div>
                <div className="p-4 flex flex-col gap-1.5 flex-1">
                  <h3
                    className="font-bold text-[14.5px] leading-snug tracking-tight"
                    style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
                  >
                    {g.title}
                  </h3>
                  <p className="text-[12px] leading-[1.5] flex-1" style={{ color: "var(--fg-muted)" }}>
                    {g.desc}
                  </p>
                  {g.live ? (
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold mt-1" style={{ color: "var(--brand)" }}>
                      Play now
                      <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold mt-1" style={{ color: "var(--fg-subtle)" }}>
                      <Lock size={12} />
                      Coming soon
                    </div>
                  )}
                </div>
              </OACard>
            );

            return g.live ? (
              <Link key={g.slug} href={`/brain-booster/${g.slug}`} className="group">
                {card}
              </Link>
            ) : (
              <div key={g.slug} className="cursor-not-allowed">{card}</div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
