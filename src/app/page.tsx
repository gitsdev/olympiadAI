import Link from "next/link";
import {
  Sparkles, PencilLine, Target, BarChart2, Route, Trophy,
  ArrowRight, Play, Check, CircleCheck, Star, Users,
  BookOpen, Sigma, FlaskConical, Globe2, ShieldCheck,
  Brain, Gauge, Eye,
} from "lucide-react";
import { OAButton, OACard, OARing, OASubjectDot, OAAvatar, SUBJECT_COLORS, type Subject } from "@/components/ui";
import { Logo } from "@/components/brand";
import { MktNav } from "./MktNav";

/* ── Hero ────────────────────────────────────────────────────────────── */
function Hero() {
  const subjects: Subject[] = ["Mathematics", "Science", "English", "General Knowledge", "Cyber"];
  return (
    <section className="relative overflow-hidden border-b border-[var(--line-200)]">
      <div className="absolute inset-0 graph-bg opacity-70" style={{ backgroundSize: "28px 28px" }} />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(70% 55% at 50% -8%, oklch(0.52 0.195 259 / 0.12), transparent 60%)" }}
      />
      <div className="relative max-w-[1160px] mx-auto px-5 sm:px-8 pt-12 sm:pt-[72px] pb-12 sm:pb-16 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--line-300)] bg-[var(--surface)] shadow-[var(--shadow-xs)] mb-6">
          <Sparkles size={14} fill="var(--gold-500)" style={{ color: "var(--gold-500)" }} />
          <span className="text-[13px] font-semibold" style={{ color: "var(--ink-700)" }}>
            AI tutor · adaptive tests · knowledge graph
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-black leading-[1.04] tracking-tight max-w-[880px] mx-auto mb-5"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 5vw, 60px)",
            letterSpacing: "-0.03em",
            color: "var(--ink-900)",
          }}
        >
          Your personal Olympiad coach.
          <br />
          <span style={{ color: "var(--brand)" }}>Learn it, practice it, master it.</span>
        </h1>

        <p
          className="text-[16px] sm:text-[19px] leading-[1.6] max-w-[600px] mx-auto mb-8"
          style={{ color: "var(--ink-700)" }}
        >
          OlympiadIQ builds a personalized path for CBSE &amp; ICSE students — Classes 1–10. An AI
          tutor that actually knows your syllabus, adaptive mock tests, and a readiness score that
          tells you exactly what to fix.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
          <Link href="/onboarding">
            <OAButton variant="primary" size="lg" className="w-full sm:w-auto">
              Try for Free <ArrowRight size={18} />
            </OAButton>
          </Link>
          <OAButton variant="secondary" size="lg" className="w-full sm:w-auto">
            <Play size={18} /> See how it works
          </OAButton>
        </div>
        <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          No card needed · 10-minute diagnostic · CBSE &amp; ICSE, Classes 1–10
        </p>

        {/* Hero product panel */}
        <div
          className="mt-10 sm:mt-14 max-w-[960px] mx-auto rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] overflow-hidden text-left"
          style={{ background: "var(--surface)" }}
        >
          {/* Fake browser bar */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-b border-[var(--line-200)]"
            style={{ background: "var(--paper-2)" }}
          >
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-[11px] h-[11px] rounded-full" style={{ background: "var(--line-300)" }} />
            ))}
            <span className="ml-2.5 text-[12px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
              app.olympiadiq.in/learn
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2">
            {/* Tutor panel */}
            <div className="p-5 sm:p-7 border-b sm:border-b-0 sm:border-r border-[var(--line-200)]">
              <p className="t-overline mb-3.5">Ask your tutor</p>
              <div className="flex gap-2.5 mb-3.5">
                <div
                  className="w-[30px] h-[30px] rounded-[9px] shrink-0 flex items-center justify-center"
                  style={{ background: "var(--cobalt-500)" }}
                >
                  <Sparkles size={16} color="#fff" />
                </div>
                <p className="text-[14px] leading-[1.55]" style={{ color: "var(--ink-700)" }}>
                  To convert 3/4 to a decimal, divide 3 by 4 →{" "}
                  <b style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}>0.75</b>. Want to try 5/8?
                </p>
              </div>
              <div
                className="flex items-center gap-2 px-[11px] py-[9px] rounded-[var(--r-md)] border border-[var(--line-200)]"
                style={{ background: "var(--paper-2)" }}
              >
                <BookOpen size={15} style={{ color: "var(--brand)" }} />
                <span className="text-[12.5px] font-semibold flex-1">Fractions &amp; Decimals</span>
                <span className="text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
                  CBSE · Cl 7
                </span>
              </div>
            </div>

            {/* Readiness panel */}
            <div className="p-5 sm:p-7 flex items-center gap-5">
              <OARing value={87} size={88} stroke={9}>
                <span
                  className="font-bold leading-none"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 24, color: "var(--ink-900)" }}
                >
                  87
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-subtle)" }}>
                  / 100
                </span>
              </OARing>
              <div>
                <p className="t-overline mb-1.5">Readiness</p>
                <p className="font-bold text-[17px] mb-2" style={{ fontFamily: "var(--font-display)" }}>
                  Almost exam-ready
                </p>
                <div className="flex flex-wrap gap-1">
                  {subjects.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "var(--fill-100)", color: "var(--ink-700)" }}
                    >
                      <OASubjectDot subject={s} size={7} />
                      {s.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Features ────────────────────────────────────────────────────────── */
const FEATURES = [
  { id: "ai-tutor", Icon: Sparkles,   title: "AI Tutor (RAG)",      desc: "Ask anything. The tutor retrieves your syllabus knowledge first, then explains — never guesses from memory." },
  { Icon: PencilLine, title: "Unlimited practice",  desc: "Original questions generated per concept: MCQ, HOTS, reasoning, and true Olympiad-style problems." },
  { Icon: Target,     title: "Adaptive mock tests", desc: "Difficulty adjusts to your answers in real time to pinpoint your true mastery level." },
  { Icon: BarChart2,  title: "Weakness detection",  desc: "Every wrong answer, slow response, and skip becomes a precise, fixable focus area." },
  { Icon: Route,      title: "Personalized plans",  desc: "Daily, weekly, and monthly plans built from your knowledge graph — and re-built as you improve." },
  { Icon: Trophy,     title: "Readiness & rank",    desc: "A 0–100 readiness score, predicted percentile, and award probability from real platform data." },
];

function Features() {
  return (
    <section id="platform" className="scroll-mt-20 py-12 sm:py-20 px-5 sm:px-8" style={{ background: "var(--paper)" }}>
      <div className="max-w-[1160px] mx-auto">
        <SectionHead
          eyebrow="The platform"
          title="Six engines. One coach."
          sub="OlympiadIQ stores knowledge, not content — discovering, structuring, and teaching from a living knowledge graph of the curriculum."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ id, Icon, title, desc }) => (
            <OACard key={title} id={id} hover className="scroll-mt-20" style={{ padding: "22px 22px 24px" }}>
              <div
                className="w-11 h-11 rounded-[var(--r-md)] flex items-center justify-center mb-4"
                style={{ background: "var(--cobalt-50)" }}
              >
                <Icon size={22} style={{ color: "var(--brand)" }} />
              </div>
              <h3
                className="font-bold text-[19px] mb-2 tracking-tight"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
              >
                {title}
              </h3>
              <p className="text-[14.5px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>
                {desc}
              </p>
            </OACard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Subjects ────────────────────────────────────────────────────────── */
const SUBJECT_INFO: { subject: Subject; Icon: React.ElementType; desc: string }[] = [
  { subject: "Mathematics",         Icon: Sigma,        desc: "Arithmetic to algebra — real Olympiad-style problem-solving." },
  { subject: "Science",             Icon: FlaskConical, desc: "Physics, chemistry & biology, explained and applied." },
  { subject: "English",             Icon: BookOpen,     desc: "Grammar, comprehension & vocabulary, Olympiad-style." },
  { subject: "General Knowledge",   Icon: Globe2,       desc: "Current affairs, reasoning & general awareness." },
  { subject: "Cyber",               Icon: ShieldCheck,  desc: "Computer basics, safe use & digital literacy." },
];

function Subjects() {
  return (
    <section id="subjects" className="scroll-mt-20 py-12 sm:py-20 px-5 sm:px-8 border-t border-[var(--line-200)]" style={{ background: "var(--paper-2)" }}>
      <div className="max-w-[1160px] mx-auto">
        <SectionHead
          eyebrow="Subjects"
          title="Every subject your Olympiad needs."
          sub="CBSE & ICSE, Classes 1–10 — one coach across every subject you're tested on."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {SUBJECT_INFO.map(({ subject, Icon, desc }) => (
            <OACard key={subject} hover style={{ padding: "20px 18px" }}>
              <div
                className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center mb-3.5"
                style={{ background: "var(--fill-100)" }}
              >
                <Icon size={19} style={{ color: SUBJECT_COLORS[subject] }} />
              </div>
              <h3 className="font-bold text-[15px] mb-1.5 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                {subject}
              </h3>
              <p className="text-[12.5px] leading-[1.5]" style={{ color: "var(--ink-700)" }}>{desc}</p>
            </OACard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Brain Booster ───────────────────────────────────────────────────── */
const BOOSTER_POINTS = [
  { Icon: Gauge, text: "Trains faster mental processing" },
  { Icon: Eye,   text: "Builds sharper focus & attention" },
  { Icon: Brain, text: "Free for everyone — no login needed" },
];

function BrainBoosterPromo() {
  return (
    <section className="py-12 sm:py-20 px-5 sm:px-8 border-t border-[var(--line-200)]" style={{ background: "var(--paper)" }}>
      <div className="max-w-[1160px] mx-auto">
        <div
          className="rounded-[var(--r-2xl)] border border-[var(--line-200)] overflow-hidden grid grid-cols-1 lg:grid-cols-2"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="p-7 sm:p-10 flex flex-col justify-center">
            <p className="t-overline mb-3" style={{ color: "var(--brand)" }}>Beyond the syllabus</p>
            <h2
              className="font-bold leading-[1.14] tracking-tight mb-3.5"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.025em", color: "var(--ink-900)", fontSize: "clamp(24px, 3.5vw, 34px)" }}
            >
              Brain Booster: quick games for a sharper mind.
            </h2>
            <p className="text-[15px] leading-[1.6] mb-6" style={{ color: "var(--ink-700)" }}>
              Real exams reward focus and speed, not just knowledge. Brain Booster is a growing set of short,
              playful cognitive games — starting with Number Ninja — that build the mental sharpness curriculum
              study alone doesn&apos;t reach.
            </p>
            <div className="flex flex-col gap-2.5 mb-7">
              {BOOSTER_POINTS.map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5">
                  <Icon size={16} style={{ color: "var(--brand)", flexShrink: 0 }} />
                  <span className="text-[14px]" style={{ color: "var(--ink-700)" }}>{text}</span>
                </div>
              ))}
            </div>
            <Link href="/brain-booster">
              <OAButton variant="primary" size="lg" className="w-full sm:w-auto">
                Play Brain Booster <ArrowRight size={18} />
              </OAButton>
            </Link>
          </div>

          <div
            className="relative flex flex-col items-center justify-center gap-4 p-10"
            style={{ background: "var(--cobalt-50)" }}
          >
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold"
              style={{ background: "var(--gold-400)", color: "var(--ink-900)" }}
            >
              <Sparkles size={13} /> LIVE NOW
            </div>
            <div className="text-[88px] leading-none">🥷</div>
            <p className="font-bold text-[17px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
              Number Ninja
            </p>
            <p className="text-[13px] text-center max-w-[220px]" style={{ color: "var(--ink-700)" }}>
              Slice the numbers 1 → N in order, as fast as you can.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── How it works ────────────────────────────────────────────────────── */
const HOW_STEPS = [
  { n: "01", title: "Take a 10-minute diagnostic",  desc: "A quick adaptive test maps what you know across every chapter." },
  { n: "02", title: "Get your knowledge graph",     desc: "We pinpoint gaps and link them along the right learning path." },
  { n: "03", title: "Follow your daily plan",       desc: "Learn, practice, and test — the plan adapts every single day." },
  { n: "04", title: "Watch readiness climb",        desc: "Track your score, mastery, and predicted rank all the way to the exam." },
];

function HowItWorks() {
  return (
    <section
      className="py-12 sm:py-20 px-5 sm:px-8 relative overflow-hidden"
      style={{ background: "var(--cobalt-700)" }}
    >
      <div className="absolute inset-0 graph-bg opacity-35" style={{ backgroundSize: "28px 28px" }} />
      <div className="relative max-w-[1160px] mx-auto">
        <div className="text-center max-w-[620px] mx-auto mb-10 sm:mb-12">
          <p className="t-overline mb-3" style={{ color: "var(--gold-400)" }}>How it works</p>
          <h2
            className="font-bold leading-[1.12] tracking-tight text-white"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.025em", fontSize: "clamp(26px, 4vw, 38px)" }}
          >
            From &ldquo;I&apos;m not sure&rdquo; to exam-ready.
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HOW_STEPS.map(({ n, title, desc }) => (
            <div
              key={n}
              className="rounded-[var(--r-lg)] p-5"
              style={{
                background: "oklch(1 0 0 / 0.06)",
                border: "1px solid oklch(1 0 0 / 0.12)",
                backdropFilter: "blur(4px)",
              }}
            >
              <p
                className="font-bold text-[26px] mb-3.5 tracking-tight"
                style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", color: "var(--gold-400)" }}
              >
                {n}
              </p>
              <h3
                className="font-bold text-[17px] text-white mb-2 leading-snug"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </h3>
              <p className="text-[13.5px] leading-[1.55]" style={{ color: "oklch(0.88 0.04 258)" }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Audiences ───────────────────────────────────────────────────────── */
const AUDIENCE_CARDS = [
  {
    id: "parents",
    Icon: Users,    who: "For parents",    accent: "var(--brand)",    bg: "var(--cobalt-50)",
    title: "See real progress, not vanity badges.",
    pts: ["Weekly progress reports", "Practice time & test results", "Honest weak-area insights"],
  },
  {
    Icon: Sparkles, who: "Fully AI-driven", accent: "var(--gold-700)", bg: "var(--gold-50)",
    title: "A whole coaching team, in one tutor.",
    pts: ["No tuition centre, no timetable", "Tutor, planner & examiner in one", "Available the moment you have a doubt"],
  },
];

function Audiences() {
  return (
    <section className="py-12 sm:py-20 px-5 sm:px-8" style={{ background: "var(--paper)" }}>
      <div className="max-w-[1160px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
        {AUDIENCE_CARDS.map(({ id, Icon, who, accent, bg, title, pts }) => (
          <OACard key={who} id={id} className="scroll-mt-20" style={{ padding: "24px 24px 26px", position: "relative", overflow: "hidden" }}>
            <div
              className="absolute -top-5 -right-5 w-[120px] h-[120px] rounded-full opacity-70"
              style={{ background: bg }}
            />
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-4">
                <Icon size={20} style={{ color: accent }} />
                <span className="t-overline">{who}</span>
              </div>
              <h3
                className="font-bold text-[22px] sm:text-[25px] tracking-tight mb-4 leading-snug"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
              >
                {title}
              </h3>
              <div className="flex flex-col gap-2.5">
                {pts.map((p) => (
                  <div key={p} className="flex items-center gap-2.5">
                    <CircleCheck size={18} style={{ color: "var(--success)", flexShrink: 0 }} />
                    <span className="text-[14.5px]" style={{ color: "var(--ink-700)" }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </OACard>
        ))}
      </div>
    </section>
  );
}

/* ── Testimonial ─────────────────────────────────────────────────────── */
function Testimonial() {
  return (
    <section className="px-5 sm:px-8 pt-10 pb-12 sm:pb-20" style={{ background: "var(--paper)" }}>
      <div className="max-w-[820px] mx-auto text-center">
        <div className="flex gap-1 justify-center mb-5">
          {[0, 1, 2, 3, 4].map((_, i) => (
            <Star key={i} size={20} fill="var(--gold-400)" style={{ color: "var(--gold-400)" }} />
          ))}
        </div>
        <blockquote
          className="font-semibold leading-[1.35] tracking-tight mb-6"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(20px, 3.5vw, 28px)",
            letterSpacing: "-0.02em",
            color: "var(--ink-900)",
          }}
        >
          &ldquo;She went from skipping every word problem to a top-200 rank in the regional Maths
          Olympiad. The plan just told her what to do each day — and it worked.&rdquo;
        </blockquote>
        <div className="flex items-center gap-3 justify-center">
          <OAAvatar name="Priya Nair" size={40} tone="gold" />
          <div className="text-left">
            <p className="text-[14.5px] font-bold">Priya Nair</p>
            <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>Parent · Bengaluru</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ─────────────────────────────────────────────────────────── */
/**
 * Paid tiers — parked, not deleted. We're running fully free for now (see
 * FREE_FEATS + Pricing() below); re-enable this structure when paid plans
 * come back by swapping the render in Pricing() back to PAID_PLANS.map(...).
 */
const PAID_PLANS = [
  {
    name: "Explorer", price: "₹0", per: "forever",
    desc: "Get started and find your gaps.", cta: "Start free", featured: false,
    feats: ["10-min diagnostic", "AI tutor — 20 questions/day", "2 mock tests / month", "Readiness score"],
  },
  {
    name: "Olympiad Pro", price: "₹699", per: "per month",
    desc: "Everything you need to top the exam.", cta: "Start free trial", featured: true,
    feats: ["Unlimited AI tutor & practice", "Unlimited adaptive mock tests", "Daily personalized plans", "Rank prediction & analytics", "Parent progress reports"],
  },
  {
    name: "School", price: "Custom", per: "per seat",
    desc: "For classrooms and institutions.", cta: "Talk to us", featured: false,
    feats: ["Everything in Pro", "Bulk student seats", "Cohort progress overview", "Admin & RBAC controls"],
  },
];
void PAID_PLANS; // kept as backup reference for the future paid rollout — see comment above

const FREE_FEATS = [
  "10-min diagnostic", "Unlimited AI tutor & practice", "Unlimited adaptive mock tests",
  "Daily personalized study plans", "Rank prediction & analytics", "Parent progress reports",
];

function Pricing() {
  return (
    <section
      id="pricing"
      className="scroll-mt-20 py-12 sm:py-20 px-5 sm:px-8 border-t border-[var(--line-200)]"
      style={{ background: "var(--paper-2)" }}
    >
      <div className="max-w-[1160px] mx-auto">
        <SectionHead
          eyebrow="Pricing"
          title="Free for everyone. No catch."
          sub="We're opening every feature to every student while we build out the full experience together."
        />

        <div
          className="max-w-[620px] mx-auto relative overflow-hidden rounded-[var(--r-2xl)] px-6 py-10 sm:px-10 sm:py-12 text-center"
          style={{ background: "var(--cobalt-700)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="absolute inset-0 graph-bg opacity-40" style={{ backgroundSize: "24px 24px" }} />
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(80% 70% at 50% -10%, oklch(0.81 0.13 80 / 0.25), transparent 60%)" }}
          />

          <div className="relative">
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6"
              style={{ background: "var(--gold-400)" }}
            >
              <Sparkles size={14} style={{ color: "var(--ink-900)" }} />
              <span className="text-[12px] font-bold" style={{ color: "var(--ink-900)", letterSpacing: "0.03em" }}>
                FREE FOR EVERYONE
              </span>
            </div>

            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span
                className="font-black text-[52px] sm:text-[60px] tracking-tight text-white"
                style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.03em" }}
              >
                ₹0
              </span>
              <span className="text-[15px]" style={{ color: "oklch(0.9 0.04 258)" }}>/ every feature, on us</span>
            </div>

            <p
              className="text-[15px] sm:text-[16.5px] leading-[1.6] max-w-[440px] mx-auto mb-7"
              style={{ color: "oklch(0.92 0.03 258)" }}
            >
              AI tutor, unlimited mock tests, rank prediction, parent reports — everything, unlocked, for every student. No trial, no card required.
            </p>

            <Link href="/onboarding">
              <OAButton variant="gold" size="lg">
                Start learning free <ArrowRight size={18} />
              </OAButton>
            </Link>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mt-9 text-left max-w-[440px] mx-auto">
              {FREE_FEATS.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <Check size={16} style={{ color: "var(--gold-400)", flexShrink: 0, marginTop: 2 }} />
                  <span className="text-[13.5px] leading-snug" style={{ color: "oklch(0.92 0.03 258)" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── CTA banner ──────────────────────────────────────────────────────── */
function CTABanner() {
  return (
    <section className="px-5 sm:px-8 pb-12 sm:pb-20 pt-10" style={{ background: "var(--paper-2)" }}>
      <div
        className="max-w-[1000px] mx-auto relative overflow-hidden rounded-[var(--r-2xl)] px-6 py-10 sm:px-10 sm:py-14 text-center"
        style={{ background: "var(--cobalt-700)" }}
      >
        <div className="absolute inset-0 graph-bg opacity-40" style={{ backgroundSize: "26px 26px" }} />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(80% 80% at 50% 120%, oklch(0.81 0.13 80 / 0.22), transparent 55%)" }}
        />
        <div className="relative">
          <h2
            className="font-black leading-[1.08] tracking-tight text-white max-w-[620px] mx-auto mb-4"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em", fontSize: "clamp(26px, 4vw, 42px)" }}
          >
            Find out how exam-ready you really are.
          </h2>
          <p
            className="text-[15px] sm:text-[17px] max-w-[460px] mx-auto mb-8"
            style={{ color: "oklch(0.9 0.04 258)" }}
          >
            Take the free 10-minute diagnostic and get your readiness score today.
          </p>
          <Link href="/onboarding">
            <OAButton variant="gold" size="lg">
              Start free diagnostic <ArrowRight size={18} />
            </OAButton>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────── */
const FOOTER_COLS = [
  { h: "Platform", links: ["AI Tutor", "Practice", "Mock tests", "Readiness score", "Knowledge graph"] },
  { h: "Subjects",  links: ["Mathematics", "Science", "English", "General Knowledge", "Cyber"] },
  { h: "Company",   links: ["About", "For schools", "Careers", "Contact"] },
  { h: "Legal",     links: ["Privacy", "Terms", "Copyright policy"] },
];

function Footer() {
  return (
    <footer className="px-5 sm:px-8 pt-12 sm:pt-14 pb-8" style={{ background: "var(--ink-900)" }}>
      <div className="max-w-[1160px] mx-auto">
        {/* Brand column + link columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.4fr_repeat(4,1fr)] gap-7 pb-9 border-b"
          style={{ borderColor: "oklch(1 0 0 / 0.10)" }}>
          {/* Brand — full width on mobile, spans first row */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Logo size={26} mono />
            <p
              className="text-[13.5px] leading-[1.6] mt-3.5 max-w-[240px]"
              style={{ color: "oklch(0.72 0.02 264)" }}
            >
              The AI-powered Olympiad preparation platform for CBSE &amp; ICSE students, Classes 1–10.
            </p>
          </div>
          {FOOTER_COLS.map(({ h, links }) => (
            <div key={h}>
              <p
                className="text-[12px] font-bold uppercase tracking-[0.08em] mb-3.5"
                style={{ color: "oklch(0.78 0.02 264)" }}
              >
                {h}
              </p>
              <div className="flex flex-col gap-2">
                {links.map((l) => (
                  <a
                    key={l}
                    href="#"
                    className="text-[13.5px] transition-colors duration-[120ms] hover:text-white"
                    style={{ color: "oklch(0.72 0.02 264)", textDecoration: "none" }}
                  >
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 pt-5 text-[12.5px]"
          style={{ color: "oklch(0.6 0.02 264)" }}
        >
          <span>© 2026 Guild IT Solutions. All Rights Reserved. | OlympiadIQ</span>
          <span className="hidden sm:block flex-1" />
          <span style={{ fontFamily: "var(--font-mono)" }}>Made for ambitious students.</span>
        </div>
      </div>
    </footer>
  );
}

/* ── Helper ──────────────────────────────────────────────────────────── */
function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="text-center max-w-[640px] mx-auto mb-9 sm:mb-11">
      <p className="t-overline mb-3" style={{ color: "var(--brand)" }}>{eyebrow}</p>
      <h2
        className="font-bold leading-[1.12] tracking-tight mb-3.5"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.025em", color: "var(--ink-900)", fontSize: "clamp(26px, 4vw, 38px)" }}
      >
        {title}
      </h2>
      {sub && <p className="text-[15px] sm:text-[17px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>{sub}</p>}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function MarketingPage() {
  return (
    <div style={{ background: "var(--paper)" }}>
      <MktNav />
      <Hero />
      <Features />
      <Subjects />
      <BrainBoosterPromo />
      <HowItWorks />
      <Audiences />
      <Testimonial />
      <Pricing />
      <CTABanner />
      <Footer />
    </div>
  );
}
