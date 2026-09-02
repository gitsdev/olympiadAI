"use client";

/* ============================================================================
 * /start — OlympiadIQ Facebook / Instagram Ad landing page
 * ----------------------------------------------------------------------------
 * Structure (edit COPY in landing-content.ts, not here):
 *   Header (simplified) → Hero → Facts → Problem → Features → Skills →
 *   How it works → Demo dashboard → Parent benefits → Kids → Social proof →
 *   FAQ → Final CTA → mini footer
 * ==========================================================================*/

import * as React from "react";
import Link from "next/link";
import {
  Brain, Sparkles, Target, Trophy, ChevronDown, Check, Rocket, Play,
  BookOpen, Gauge, ShieldCheck, Puzzle, Layers,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { OAButton, OARing } from "@/components/ui";
import { CTAButton } from "./CTAButton";
import { StickyMobileCTA } from "./StickyMobileCTA";
import { Reveal, Counter } from "./motion";
import { track } from "./analytics";
import {
  HERO, FACTS, PROBLEM, FEATURES, SKILLS, HOW, DEMO, PARENTS, KIDS,
  TRUST, FAQ, FINAL, EVENTS,
} from "./landing-content";

const PROBLEM_ICONS: Record<string, React.ElementType> = {
  brain: Brain, sparkles: Sparkles, target: Target, trophy: Trophy,
};

const TRUST_ICONS: Record<string, React.ElementType> = {
  book: BookOpen, gauge: Gauge, shield: ShieldCheck, puzzle: Puzzle, layers: Layers, play: Play,
};

/* ── shared section heading ─────────────────────────────────────────────── */
function Head({ eyebrow, title, sub, light }: {
  eyebrow: string; title: string; sub?: string; light?: boolean;
}) {
  return (
    <div className="text-center max-w-[640px] mx-auto mb-9 sm:mb-12">
      <p className="t-overline mb-3" style={{ color: light ? "var(--gold-400)" : "var(--brand)" }}>
        {eyebrow}
      </p>
      <h2
        className="font-bold leading-[1.12] tracking-tight mb-3.5"
        style={{
          fontFamily: "var(--font-display)",
          letterSpacing: "-0.025em",
          fontSize: "clamp(25px, 4vw, 37px)",
          color: light ? "#fff" : "var(--ink-900)",
        }}
      >
        {title}
      </h2>
      {sub && (
        <p className="text-[15px] sm:text-[17px] leading-[1.6]"
          style={{ color: light ? "oklch(0.9 0.03 258)" : "var(--ink-700)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ── 0. Simplified header ───────────────────────────────────────────────── */
function Header() {
  return (
    <header
      className="sticky top-0 z-30 border-b border-[var(--line-200)]"
      style={{ background: "oklch(0.992 0.004 95 / 0.92)", backdropFilter: "blur(12px)" }}
    >
      <div className="max-w-[1100px] mx-auto px-4 sm:px-8 h-[58px] flex items-center">
        {/* Logo returns to the main site — kept for trust; not part of the funnel */}
        <Link href="/" aria-label="OlympiadIQ home">
          <Logo size={26} />
        </Link>
        <span className="flex-1" />
        <CTAButton event={EVENTS.header} size="sm" arrow={false} className="!h-9">
          {HERO.primaryCta}
        </CTAButton>
      </div>
    </header>
  );
}

/* ── 1. Hero ────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--line-200)]">
      <div className="absolute inset-0 graph-bg opacity-60" style={{ backgroundSize: "26px 26px" }} />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(70% 55% at 50% -10%, oklch(0.52 0.195 259 / 0.13), transparent 62%)" }}
      />
      <div className="relative max-w-[1100px] mx-auto px-4 sm:px-8 pt-10 sm:pt-16 pb-12 sm:pb-16">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-8 items-center">
          {/* Left — copy */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--line-300)] bg-[var(--surface)] shadow-[var(--shadow-xs)] mb-5">
              <Sparkles size={14} style={{ color: "var(--gold-500)" }} />
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--ink-700)" }}>
                {HERO.badge}
              </span>
            </div>

            <h1
              className="font-black tracking-tight mb-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(31px, 6vw, 56px)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "var(--ink-900)",
              }}
            >
              {HERO.headline}
            </h1>

            <p className="text-[16px] sm:text-[19px] font-semibold leading-[1.5] mb-3"
              style={{ color: "var(--brand)" }}>
              {HERO.subhead}
            </p>
            <p className="text-[14.5px] sm:text-[16px] leading-[1.6] max-w-[520px] mx-auto lg:mx-0 mb-7"
              style={{ color: "var(--ink-700)" }}>
              {HERO.paragraph}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <CTAButton event={EVENTS.heroPrimary} block>
                {HERO.primaryCta}
              </CTAButton>
              <a href="#features" onClick={() => track(EVENTS.heroSecondary, { location: EVENTS.heroSecondary })}>
                <OAButton variant="secondary" size="lg" className="w-full sm:w-auto">
                  <Play size={18} aria-hidden /> {HERO.secondaryCta}
                </OAButton>
              </a>
            </div>
            <p className="text-[12.5px] mt-4" style={{ color: "var(--fg-muted)" }}>
              {HERO.reassurance}
            </p>
          </div>

          {/* Right — decorative gamified panel (CSS + SVG only, no images) */}
          <HeroArt />
        </div>
      </div>
    </section>
  );
}

function HeroArt() {
  return (
    <div className="relative mx-auto w-full max-w-[380px] lg:max-w-none" aria-hidden>
      <div
        className="relative rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] p-5 sm:p-6"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <OARing value={78} size={64} stroke={8} color="var(--cobalt-500)">
            <span className="font-bold" style={{ fontFamily: "var(--font-mono)", fontSize: 17, color: "var(--ink-900)" }}>
              78
            </span>
          </OARing>
          <div>
            <p className="t-overline mb-1">Today&apos;s challenge</p>
            <p className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)" }}>
              Logical Reasoning
            </p>
          </div>
        </div>

        <div className="rounded-[var(--r-md)] border border-[var(--line-200)] p-3.5 mb-3" style={{ background: "var(--paper-2)" }}>
          <p className="text-[12.5px] font-semibold mb-2" style={{ color: "var(--ink-700)" }}>
            Which number comes next?  2, 4, 8, 16, …
          </p>
          <div className="grid grid-cols-3 gap-2">
            {["24", "32", "20"].map((n, i) => (
              <span
                key={n}
                className="text-center text-[13px] font-bold py-2 rounded-[var(--r-sm)] border"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: i === 1 ? "var(--cobalt-50)" : "var(--surface)",
                  borderColor: i === 1 ? "var(--cobalt-300)" : "var(--line-300)",
                  color: i === 1 ? "var(--cobalt-700)" : "var(--ink-700)",
                }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--success-tx)" }}>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ background: "var(--success-bg)" }}>
            <Check size={12} />
          </span>
          6 / 10 solved · keep going!
        </div>
      </div>

      {/* floating chips */}
      {HERO.floatChips.map((c, i) => (
        <div
          key={c}
          className="absolute hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold shadow-[var(--shadow-md)]"
          style={{
            background: i === 1 ? "var(--gold-400)" : "var(--surface)",
            color: i === 1 ? "var(--ink-900)" : "var(--ink-800)",
            border: "1px solid var(--line-200)",
            top: [12, 120, 240][i],
            [i === 1 ? "left" : "right"]: -18,
            animation: `oa-float 3.6s ease-in-out ${i * 0.5}s infinite alternate`,
          }}
        >
          {i === 0 && "✅"} {i === 1 && "🔥"} {i === 2 && "🏆"} {c}
        </div>
      ))}

      <style>{`
        @keyframes oa-float { from { transform: translateY(0) } to { transform: translateY(-9px) } }
        @media (prefers-reduced-motion: reduce) { [style*="oa-float"] { animation: none !important } }
      `}</style>
    </div>
  );
}

/* ── 2. Facts strip ─────────────────────────────────────────────────────── */
function Facts() {
  return (
    <section className="px-4 sm:px-8 py-8 border-b border-[var(--line-200)]" style={{ background: "var(--paper-2)" }}>
      <div className="max-w-[1000px] mx-auto grid grid-cols-2 sm:grid-cols-4 gap-5">
        {FACTS.map((f) => (
          <div key={f.label} className="text-center">
            <p className="font-bold" style={{ fontFamily: "var(--font-mono)", fontSize: "clamp(24px,4vw,32px)", color: "var(--brand)", letterSpacing: "-0.02em" }}>
              <Counter to={f.value} prefix={f.prefix ?? ""} suffix={f.suffix ?? ""} />
            </p>
            <p className="text-[12px] sm:text-[13px] mt-1" style={{ color: "var(--ink-700)" }}>{f.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── 3. Problem ─────────────────────────────────────────────────────────── */
function Problem() {
  return (
    <section className="px-4 sm:px-8 py-14 sm:py-20" style={{ background: "var(--paper)" }}>
      <div className="max-w-[1100px] mx-auto">
        <Reveal><Head eyebrow={PROBLEM.eyebrow} title={PROBLEM.title} /></Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROBLEM.cards.map((c, i) => {
            const Icon = PROBLEM_ICONS[c.icon] ?? Brain;
            return (
              <Reveal key={c.title} delay={i * 60}>
                <div className="group h-full rounded-[var(--r-lg)] border border-[var(--line-200)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:border-[var(--cobalt-200)]">
                  <div className="w-11 h-11 rounded-[var(--r-md)] flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110" style={{ background: "var(--cobalt-50)" }}>
                    <Icon size={21} style={{ color: "var(--brand)" }} />
                  </div>
                  <h3 className="font-bold text-[17px] mb-1.5 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                    {c.title}
                  </h3>
                  <p className="text-[14px] leading-[1.55]" style={{ color: "var(--ink-700)" }}>{c.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── 4. Features ────────────────────────────────────────────────────────── */
function Features() {
  return (
    <section id="features" className="scroll-mt-16 px-4 sm:px-8 py-14 sm:py-20 border-t border-[var(--line-200)]" style={{ background: "var(--paper-2)" }}>
      <div className="max-w-[1100px] mx-auto">
        <Reveal><Head eyebrow={FEATURES.eyebrow} title={FEATURES.title} sub={FEATURES.sub} /></Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 50}>
              <div className="h-full rounded-[var(--r-lg)] border border-[var(--line-200)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:border-[var(--cobalt-200)]">
                <div className="text-[30px] leading-none mb-3">{c.emoji}</div>
                <h3 className="font-bold text-[17px] mb-1.5 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {c.title}
                </h3>
                <p className="text-[14px] leading-[1.55]" style={{ color: "var(--ink-700)" }}>{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="text-center mt-9">
          <CTAButton event={EVENTS.midPage}>{FINAL.cta}</CTAButton>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 5. Skills selector (interactive) ───────────────────────────────────── */
function Skills() {
  const [active, setActive] = React.useState(SKILLS.items[1].key);
  const current = SKILLS.items.find((s) => s.key === active) ?? SKILLS.items[0];

  return (
    <section className="px-4 sm:px-8 py-14 sm:py-20 border-t border-[var(--line-200)]" style={{ background: "var(--paper)" }}>
      <div className="max-w-[1000px] mx-auto">
        <Reveal><Head eyebrow={SKILLS.eyebrow} title={SKILLS.title} sub={SKILLS.sub} /></Reveal>

        <Reveal className="flex flex-wrap justify-center gap-2 mb-6">
          {SKILLS.items.map((s) => {
            const on = s.key === active;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                aria-pressed={on}
                className="text-[13px] sm:text-[13.5px] font-semibold px-3.5 py-2 rounded-full border transition-all duration-150"
                style={{
                  background: on ? "var(--cobalt-500)" : "var(--surface)",
                  color: on ? "#fff" : "var(--ink-700)",
                  borderColor: on ? "var(--cobalt-500)" : "var(--line-300)",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </Reveal>

        <Reveal>
          <div
            key={current.key}
            className="oa-fade max-w-[560px] mx-auto text-center rounded-[var(--r-xl)] border border-[var(--line-200)] p-6 sm:p-8"
            style={{ background: "var(--cobalt-50)" }}
          >
            <p className="font-bold text-[19px] mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--cobalt-700)" }}>
              {current.label}
            </p>
            <p className="text-[15px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>{current.body}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 6. How it works ────────────────────────────────────────────────────── */
function How() {
  return (
    <section className="px-4 sm:px-8 py-14 sm:py-20 relative overflow-hidden" style={{ background: "var(--cobalt-700)" }}>
      <div className="absolute inset-0 graph-bg opacity-30" style={{ backgroundSize: "26px 26px" }} />
      <div className="relative max-w-[1100px] mx-auto">
        <Reveal><Head eyebrow={HOW.eyebrow} title={HOW.title} light /></Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HOW.steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 70}>
              <div className="h-full rounded-[var(--r-lg)] p-5" style={{ background: "oklch(1 0 0 / 0.07)", border: "1px solid oklch(1 0 0 / 0.13)" }}>
                <p className="font-bold text-[24px] mb-3" style={{ fontFamily: "var(--font-mono)", color: "var(--gold-400)" }}>
                  {String(s.n).padStart(2, "0")}
                </p>
                <h3 className="font-bold text-[16px] text-white mb-1.5" style={{ fontFamily: "var(--font-display)" }}>{s.title}</h3>
                <p className="text-[13px] leading-[1.55]" style={{ color: "oklch(0.88 0.04 258)" }}>{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="text-center mt-9">
          <CTAButton event={EVENTS.midPage} variant="gold">{HERO.primaryCta}</CTAButton>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 7. Demo dashboard ──────────────────────────────────────────────────── */
function Demo() {
  return (
    <section className="px-4 sm:px-8 py-14 sm:py-20 border-t border-[var(--line-200)]" style={{ background: "var(--paper-2)" }}>
      <div className="max-w-[900px] mx-auto">
        <Reveal><Head eyebrow={DEMO.eyebrow} title={DEMO.title} sub={DEMO.sub} /></Reveal>
        <Reveal>
          <div className="rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] overflow-hidden" style={{ background: "var(--surface)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--line-200)]" style={{ background: "var(--paper-2)" }}>
              {[0, 1, 2].map((i) => <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--line-300)" }} />)}
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--warning-bg)", color: "var(--warning-tx)" }}>
                DEMO · ILLUSTRATION ONLY
              </span>
            </div>
            <div className="grid sm:grid-cols-2">
              <div className="p-5 sm:p-7 border-b sm:border-b-0 sm:border-r border-[var(--line-200)]">
                <p className="t-overline mb-3">Today&apos;s challenge</p>
                <p className="font-bold text-[18px] mb-1" style={{ fontFamily: "var(--font-display)" }}>{DEMO.challengeSubject}</p>
                <p className="text-[13px] mb-3" style={{ color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>{DEMO.challengeProgressText}</p>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--fill-200)" }}>
                  <div style={{ width: `${DEMO.challengePercent}%`, height: "100%", background: "var(--cobalt-500)", borderRadius: 999 }} />
                </div>
              </div>
              <div className="p-5 sm:p-7 flex flex-col gap-2.5">
                {DEMO.items.map((it) => (
                  <div key={it.text} className="flex items-center gap-2.5 text-[14px]" style={{ color: "var(--ink-700)" }}>
                    <span className="text-[16px]">{it.emoji}</span>{it.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 8. Parent benefits ─────────────────────────────────────────────────── */
function Parents() {
  return (
    <section className="px-4 sm:px-8 py-14 sm:py-20 border-t border-[var(--line-200)]" style={{ background: "var(--paper)" }}>
      <div className="max-w-[900px] mx-auto">
        <Reveal><Head eyebrow={PARENTS.eyebrow} title={PARENTS.title} /></Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PARENTS.items.map((t, i) => (
            <Reveal key={t} delay={i * 45}>
              <div className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--line-200)] bg-[var(--surface)] p-4">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5" style={{ background: "var(--success-bg)" }}>
                  <Check size={14} style={{ color: "var(--success-tx)" }} />
                </span>
                <span className="text-[14.5px] leading-[1.5]" style={{ color: "var(--ink-700)" }}>{t}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 9. Kids ────────────────────────────────────────────────────────────── */
function Kids() {
  return (
    <section className="px-4 sm:px-8 py-14 sm:py-20" style={{ background: "var(--cobalt-50)" }}>
      <div className="max-w-[900px] mx-auto">
        <Reveal><Head eyebrow={KIDS.eyebrow} title={KIDS.title} /></Reveal>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {KIDS.cards.map((c, i) => (
            <Reveal key={c.label} delay={i * 50}>
              <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border border-[var(--line-200)] bg-[var(--surface)] py-6 transition-transform duration-200 hover:scale-[1.03]">
                <span className="text-[34px] leading-none">{c.emoji}</span>
                <span className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>{c.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 10. Trust (non-testimonial social proof) ───────────────────────────── */
function Trust() {
  if (!TRUST.show) return null;
  return (
    <section className="px-4 sm:px-8 py-14 sm:py-20 border-t border-[var(--line-200)]" style={{ background: "var(--paper)" }}>
      <div className="max-w-[1000px] mx-auto">
        <Reveal><Head eyebrow={TRUST.eyebrow} title={TRUST.title} sub={TRUST.sub} /></Reveal>

        <Reveal className="flex flex-wrap justify-center gap-2 mb-9">
          {TRUST.signals.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-full border border-[var(--line-300)]" style={{ background: "var(--surface)", color: "var(--ink-700)" }}>
              <Check size={13} style={{ color: "var(--success)" }} /> {s}
            </span>
          ))}
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRUST.points.map((p, i) => {
            const Icon = TRUST_ICONS[p.icon] ?? ShieldCheck;
            return (
              <Reveal key={p.title} delay={i * 50}>
                <div className="h-full rounded-[var(--r-lg)] border border-[var(--line-200)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-5 sm:p-6">
                  <div className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center mb-3.5" style={{ background: "var(--cobalt-50)" }}>
                    <Icon size={19} style={{ color: "var(--brand)" }} />
                  </div>
                  <h3 className="font-bold text-[16px] mb-1.5 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{p.title}</h3>
                  <p className="text-[13.5px] leading-[1.55]" style={{ color: "var(--ink-700)" }}>{p.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        {TRUST.footnote && (
          <p className="text-center text-[12.5px] mt-8" style={{ color: "var(--fg-muted)" }}>{TRUST.footnote}</p>
        )}
      </div>
    </section>
  );
}

/* ── 11. FAQ accordion ──────────────────────────────────────────────────── */
function Faqs() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section className="px-4 sm:px-8 py-14 sm:py-20 border-t border-[var(--line-200)]" style={{ background: "var(--paper-2)" }}>
      <div className="max-w-[720px] mx-auto">
        <Reveal><Head eyebrow={FAQ.eyebrow} title={FAQ.title} /></Reveal>
        <div className="flex flex-col gap-2.5">
          {FAQ.items.map((it, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={it.q} delay={i * 30}>
                <div className="rounded-[var(--r-md)] border border-[var(--line-200)] overflow-hidden" style={{ background: "var(--surface)" }}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 text-left px-4 sm:px-5 py-4"
                  >
                    <span className="flex-1 font-semibold text-[14.5px] sm:text-[15px]" style={{ color: "var(--ink-900)" }}>{it.q}</span>
                    <ChevronDown
                      size={18}
                      style={{ color: "var(--fg-muted)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms var(--ease-out)" }}
                    />
                  </button>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateRows: isOpen ? "1fr" : "0fr",
                      transition: "grid-template-rows 260ms var(--ease-out)",
                    }}
                  >
                    <div style={{ overflow: "hidden" }}>
                      <p className="px-4 sm:px-5 pb-4 text-[14px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>{it.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── 12. Final CTA ──────────────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="px-4 sm:px-8 py-16 sm:py-24 relative overflow-hidden" style={{ background: "var(--ink-900)" }}>
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(80% 80% at 50% 0%, oklch(0.52 0.195 259 / 0.35), transparent 60%)" }}
      />
      <div className="absolute inset-0 graph-bg opacity-20" style={{ backgroundSize: "26px 26px" }} />
      <div className="relative max-w-[680px] mx-auto text-center">
        <Reveal>
          <h2
            className="font-black tracking-tight text-white mb-4"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em", fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1.08 }}
          >
            {FINAL.title}
          </h2>
          <p className="text-[16px] sm:text-[18px] mb-8" style={{ color: "oklch(0.82 0.03 258)" }}>{FINAL.sub}</p>
          <CTAButton event={EVENTS.finalCta} variant="gold" size="lg">
            <Rocket size={18} aria-hidden /> {FINAL.cta}
          </CTAButton>
          <p className="text-[13px] mt-4" style={{ color: "oklch(0.7 0.03 258)" }}>{FINAL.footnote}</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 13. Mini footer ────────────────────────────────────────────────────── */
function MiniFooter() {
  return (
    <footer className="px-4 sm:px-8 py-8" style={{ background: "var(--ink-900)", borderTop: "1px solid oklch(1 0 0 / 0.1)" }}>
      <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-center gap-3 text-[12.5px]" style={{ color: "oklch(0.62 0.02 264)" }}>
        <Logo size={22} mono />
        <span className="sm:flex-1" />
        <div className="flex gap-4">
          <Link href="/privacy" style={{ color: "inherit" }}>Privacy</Link>
          <Link href="/login" style={{ color: "inherit" }}>Log in</Link>
        </div>
        <span>© 2026 Guild IT Solutions · OlympiadIQ</span>
      </div>
    </footer>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export function Landing() {
  return (
    <div className="pb-[76px] md:pb-0" style={{ background: "var(--paper)" }}>
      <Header />
      <main>
        <Hero />
        <Facts />
        <Problem />
        <Features />
        <Skills />
        <How />
        <Demo />
        <Parents />
        <Kids />
        <Trust />
        <Faqs />
        <FinalCTA />
      </main>
      <MiniFooter />
      <StickyMobileCTA />
    </div>
  );
}
