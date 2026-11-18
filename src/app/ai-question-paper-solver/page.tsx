import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Upload, ScanText, FileCheck2, Sigma, ListChecks, Image as ImageIcon, FileText,
  GraduationCap, Brain, Clock, Target, ShieldCheck, Flag, Pencil, Download, Sparkles, Users, Trophy, BookOpen,
} from "lucide-react";
import { OAButton } from "@/components/ui";
import { JsonLd } from "@/components/blog/JsonLd";
import { AnswerMock, PaperMock } from "@/components/marketing/SolverMocks";
import { MIN_PURCHASE_CREDITS, WELCOME_CREDITS } from "@/lib/credits/constants";
import { getPublicFeaturePricing } from "@/lib/credits/public-pricing";
import { DAILY_JOB_LIMIT, MAX_PAGES, RETENTION_DAYS } from "@/lib/question-paper/constants";
import { MktNav } from "../MktNav";
import { Footer } from "../Footer";

// Public marketing page for search. The live credit price is read from the
// pricing table; refresh it at most every 5 minutes (same as the landing page).
export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.olympiadiq.in";
const PATH = "/ai-question-paper-solver";
/** Login, then straight into the solver (see safeNextPath). */
const CTA_HREF = "/login?next=/question-paper-solver";

const TITLE = "AI Question Paper Solver for Classes 1–10 (CBSE, ICSE & Olympiad) | OlympiadIQ";
const DESCRIPTION =
  "Upload any question paper as a PDF or Word file and get a complete answer sheet with step-by-step solutions — every question, in the original order. For CBSE, ICSE and Olympiad students in Classes 1–10.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "AI question paper solver", "question paper solutions", "answer sheet generator", "CBSE question paper solutions",
    "ICSE question paper answers", "Olympiad paper solutions", "step-by-step maths solutions", "solve sample paper",
  ],
  alternates: { canonical: PATH },
  openGraph: { url: PATH, title: TITLE, description: DESCRIPTION, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/* ── Content ─────────────────────────────────────────────────────────── */

const STEPS = [
  { Icon: Upload, title: "Upload your paper", desc: `Drop in a PDF or Word file — typed, printed or scanned with your phone. Up to ${MAX_PAGES} pages.` },
  { Icon: ScanText, title: "AI reads every question", desc: "It finds each question in its original order and section — MCQs, equations, tables and diagrams included." },
  { Icon: FileCheck2, title: "Get your answer sheet", desc: "Clear answers with explanations written for your class. Check them, edit them, and download as PDF or Word." },
];

const HANDLES = [
  { Icon: ListChecks, title: "Every question type", desc: "MCQs, fill in the blanks, match the following, true/false, assertion–reason, short and long answers." },
  { Icon: Sigma, title: "Real maths", desc: "Fractions, powers, roots and equations are read correctly and solved step by step, with the final answer highlighted." },
  { Icon: ImageIcon, title: "Diagrams & figures", desc: "Geometry figures, circuits and science diagrams are interpreted before the question is answered." },
  { Icon: FileText, title: "Scanned papers too", desc: "Photographed or scanned papers are read with OCR — no need to retype anything." },
];

const BENEFITS = [
  {
    Icon: Brain, title: "Learn the method, not just the answer",
    desc: "Step-by-step solutions show how to reach each answer, so students understand the concept and can solve the next question on their own.",
  },
  {
    Icon: Target, title: "Check your own practice papers",
    desc: "Attempt a sample paper or previous-year paper first, then compare your work with the solutions and see exactly where you went wrong.",
  },
  {
    Icon: GraduationCap, title: "Explanations for your class",
    desc: "Answers are written for the student's level — simple words for Classes 1–3, deeper concepts and proper terminology for Classes 9–10.",
  },
  {
    Icon: Trophy, title: "Olympiad-ready reasoning",
    desc: "For Olympiad papers, solutions focus on logic and problem-solving shortcuts, and explain why the wrong options are wrong.",
  },
  {
    Icon: Clock, title: "Help at any hour",
    desc: "Stuck on a paper the night before a test? Get a full answer sheet in minutes, without waiting for a tutor or class.",
  },
  {
    Icon: Users, title: "Easier for parents",
    desc: "Parents can help with homework and revision confidently, even in subjects they haven't studied in years.",
  },
];

const TRUST = [
  { Icon: Flag, title: "Never guesses", desc: "If a question is unclear, cut off or missing its figure, it's flagged for review instead of being given a made-up answer." },
  { Icon: ListChecks, title: "Nothing skipped", desc: "Every question is accounted for, with the original numbering and sections preserved." },
  { Icon: Pencil, title: "You stay in control", desc: "Edit any answer, regenerate it with a note, or mark it for review before you download." },
  { Icon: ShieldCheck, title: "Private by default", desc: `Your papers are stored privately, visible only to you, and deleted automatically after ${RETENTION_DAYS} days.` },
];

const AUDIENCE = [
  "Classes 1 to 10",
  "CBSE, ICSE and other boards",
  "Maths, Science, English, GK and Social Studies",
  "School exams, Olympiads and practice tests",
];

function faqs(price: string): Array<{ q: string; a: string }> {
  return [
    {
      q: "What is the AI Question Paper Solver?",
      a: "It's an OlympiadIQ tool that reads a question paper you upload — as a PDF or Word file — and produces a complete answer sheet. Every question is answered in the original order, with explanations or step-by-step working matched to the student's class, a quick answer key, and a list of anything that needs a second look.",
    },
    {
      q: "Which classes, boards and subjects does it support?",
      a: "Classes 1 to 10, for CBSE, ICSE and other boards. It works best for Mathematics, Science, English, General Knowledge and Social Studies, and supports school exams, Olympiad papers and practice tests.",
    },
    {
      q: "Can it solve scanned or photographed question papers?",
      a: `Yes. Scanned and photographed PDFs are read with OCR, along with any diagrams on the page. Papers can be up to ${MAX_PAGES} pages and 15 MB. Very blurry or handwritten text may be flagged for review rather than answered.`,
    },
    {
      q: "Does it show step-by-step solutions for maths?",
      a: "Yes. You can choose short answers, detailed answers or full step-by-step explanations. Maths solutions state the formula, show each calculation and highlight the final answer, with fractions, powers and equations formatted properly.",
    },
    {
      q: "Are the answers always correct?",
      a: "The solver is designed to be careful: it checks answers against the original page and flags any question it can't read or answer confidently instead of guessing. Like any AI, it can still make mistakes, so students should review the solutions — especially anything marked “Needs review”.",
    },
    {
      q: "Is using it cheating?",
      a: "It's built as a learning tool. The best way to use it is to attempt the paper yourself first, then use the solutions to check your work and understand the method behind every answer — just like checking an answer key with a teacher's explanation.",
    },
    {
      q: "Can I edit the answers and download the answer sheet?",
      a: "Yes. You can edit any answer, regenerate one with a note, or mark it for review. The finished answer sheet downloads as a formatted PDF or an editable Word document, complete with an answer key.",
    },
    { q: "How much does it cost?", a: price },
    {
      q: "Is my question paper kept private?",
      a: `Yes. Uploaded papers are stored in private storage that only your account can access, and are deleted automatically after ${RETENTION_DAYS} days. You can also delete a paper and its answers yourself at any time.`,
    },
  ];
}

/* ── Page ────────────────────────────────────────────────────────────── */

function CtaButton({ label = "Solve a question paper", variant = "gold" as "gold" | "primary" }) {
  return (
    <Link href={CTA_HREF} className="w-full sm:w-auto">
      <OAButton variant={variant} size="lg" className="w-full sm:w-auto">
        {label} <ArrowRight size={18} />
      </OAButton>
    </Link>
  );
}

function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="text-center max-w-[680px] mx-auto mb-9 sm:mb-11">
      <p className="t-overline mb-3" style={{ color: "var(--gold-700)" }}>{eyebrow}</p>
      <h2
        className="font-bold leading-[1.15] tracking-tight mb-3"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.025em", color: "var(--ink-900)", fontSize: "clamp(24px, 3.6vw, 34px)" }}
      >
        {title}
      </h2>
      {sub && <p className="text-[15px] sm:text-[16px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>{sub}</p>}
    </div>
  );
}

export default async function AiQuestionPaperSolverPage() {
  const pricing = await getPublicFeaturePricing();
  const cost = pricing?.find((p) => p.key === "question_paper_solver")?.cost ?? null;
  // Only quote a price we actually know, and only mention the welcome credits
  // as a way to try the solver when they really cover a paper.
  const welcomeCovers = cost !== null && cost <= WELCOME_CREDITS;
  const priceLine = pricing === null
    ? "Pay per paper with credits · No subscription"
    : cost === null
      ? "Free to use right now · No subscription"
      : `${cost} credit${cost === 1 ? "" : "s"} per paper · 1 credit = ₹1 · No subscription`;
  const priceSentence = pricing === null
    ? `It runs on OlympiadIQ credits (1 credit = ₹1), which you buy only when you need them, from ₹${MIN_PURCHASE_CREDITS}. There's no subscription.`
    : cost === null
      ? "It's currently free to use — you just need an OlympiadIQ account."
      : `Each paper uses ${cost} credit${cost === 1 ? "" : "s"} (1 credit = ₹1). There's no subscription — you buy credits only when you need them, from ₹${MIN_PURCHASE_CREDITS}${
          welcomeCovers ? `, and the ${WELCOME_CREDITS} free credits every new account gets cover your first paper` : ""
        }.`;
  const faqList = faqs(priceSentence);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "AI Question Paper Solver",
      url: `${SITE_URL}${PATH}`,
      description: DESCRIPTION,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      provider: { "@type": "Organization", name: "OlympiadIQ", url: SITE_URL },
      audience: { "@type": "EducationalAudience", educationalRole: "student" },
      featureList: [
        "Solves PDF and Word question papers, including scanned papers",
        "Step-by-step maths solutions with proper equations",
        "Interprets diagrams and figures",
        "Answers matched to Classes 1–10",
        "Download answer sheets as PDF or Word",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqList.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "AI Question Paper Solver", item: `${SITE_URL}${PATH}` },
      ],
    },
  ];

  return (
    <div style={{ background: "var(--paper)" }}>
      <JsonLd data={jsonLd} />
      <MktNav />

      <main>
        {/* Hero */}
        <section
          className="relative overflow-hidden px-5 sm:px-8 pt-10 sm:pt-16 pb-12 sm:pb-20 border-b border-[var(--line-200)]"
          style={{ background: "linear-gradient(180deg, var(--gold-50) 0%, var(--paper) 100%)" }}
        >
          <div className="absolute inset-0 graph-bg opacity-60 pointer-events-none" style={{ backgroundSize: "24px 24px" }} />
          <div className="relative max-w-[1160px] mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-12 items-center">
            <div>
              <nav aria-label="Breadcrumb" className="text-[12.5px] mb-4" style={{ color: "var(--fg-muted)" }}>
                <Link href="/" className="hover:underline">Home</Link> <span aria-hidden>/</span> AI Question Paper Solver
              </nav>
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold mb-4"
                style={{ background: "var(--ink-900)", color: "var(--gold-400)" }}
              >
                <Sparkles size={13} /> For Classes 1–10 · CBSE · ICSE · Olympiad
              </div>
              <h1
                className="font-black leading-[1.08] tracking-tight mb-4"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em", color: "var(--ink-900)", fontSize: "clamp(32px, 5vw, 52px)" }}
              >
                AI Question Paper Solver
              </h1>
              <p className="text-[17px] sm:text-[19px] leading-[1.55] mb-3" style={{ color: "var(--ink-900)" }}>
                Upload any question paper and get a complete, step-by-step answer sheet in minutes.
              </p>
              <p className="text-[15px] leading-[1.65] mb-7" style={{ color: "var(--ink-700)" }}>
                Every question is answered in its original order — MCQs, maths with equations, diagrams and long
                answers — with explanations written for your class. Check your practice papers, understand the
                method behind every answer, and download the solutions as PDF or Word.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <CtaButton />
                <a href="#how-it-works" className="text-[14px] font-semibold text-center hover:underline" style={{ color: "var(--ink-700)" }}>
                  See how it works ↓
                </a>
              </div>
              <p className="text-[12.5px] mt-4" style={{ color: "var(--fg-muted)" }}>{priceLine}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-3">
              <PaperMock />
              <AnswerMock />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 px-5 sm:px-8 py-12 sm:py-20">
          <div className="max-w-[1160px] mx-auto">
            <SectionTitle eyebrow="How it works" title="From question paper to answer sheet in three steps" />
            <ol className="grid sm:grid-cols-3 gap-4">
              {STEPS.map(({ Icon, title, desc }, i) => (
                <li key={title} className="rounded-[var(--r-lg)] p-6 border border-[var(--line-200)]" style={{ background: "var(--surface)" }}>
                  <div className="flex items-center gap-3 mb-3.5">
                    <span className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center" style={{ background: "var(--gold-100)" }}>
                      <Icon size={19} style={{ color: "var(--gold-700)" }} />
                    </span>
                    <span className="text-[12px] font-bold" style={{ fontFamily: "var(--font-mono)", color: "var(--gold-700)" }}>STEP 0{i + 1}</span>
                  </div>
                  <h3 className="font-bold text-[17px] mb-1.5 tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>{title}</h3>
                  <p className="text-[14px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>{desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What it handles */}
        <section className="px-5 sm:px-8 py-12 sm:py-20 border-t border-[var(--line-200)]" style={{ background: "var(--paper-2)" }}>
          <div className="max-w-[1160px] mx-auto">
            <SectionTitle
              eyebrow="Built for real exam papers"
              title="It reads the paper the way a teacher would"
              sub="Question papers aren't just plain text. The solver understands equations, diagrams and every common question format."
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {HANDLES.map(({ Icon, title, desc }) => (
                <div key={title} className="rounded-[var(--r-lg)] p-5 border border-[var(--line-200)]" style={{ background: "var(--surface)" }}>
                  <Icon size={20} style={{ color: "var(--brand)" }} />
                  <h3 className="font-bold text-[15.5px] mt-3 mb-1.5 tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>{title}</h3>
                  <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="px-5 sm:px-8 py-12 sm:py-20">
          <div className="max-w-[1160px] mx-auto">
            <SectionTitle
              eyebrow="Why students love it"
              title="How it helps students learn — and score better"
              sub="It's more than an answer key. Every solution is a mini lesson that shows the thinking behind the answer."
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BENEFITS.map(({ Icon, title, desc }) => (
                <article key={title} className="rounded-[var(--r-lg)] p-6" style={{ background: "var(--surface)", border: "1px solid var(--line-200)", boxShadow: "var(--shadow-sm)" }}>
                  <span className="w-10 h-10 rounded-full flex items-center justify-center mb-3.5" style={{ background: "var(--cobalt-50)" }}>
                    <Icon size={19} style={{ color: "var(--brand)" }} />
                  </span>
                  <h3 className="font-bold text-[16.5px] mb-1.5 tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>{title}</h3>
                  <p className="text-[14px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>{desc}</p>
                </article>
              ))}
            </div>

            <div className="mt-10 rounded-[var(--r-xl)] p-6 sm:p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center" style={{ background: "var(--cobalt-700)" }}>
              <div>
                <p className="t-overline mb-2" style={{ color: "var(--gold-400)" }}>Who it&apos;s for</p>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  {AUDIENCE.map((a) => (
                    <li key={a} className="flex items-center gap-2 text-[14.5px] text-white">
                      <BookOpen size={15} style={{ color: "var(--gold-400)", flexShrink: 0 }} /> {a}
                    </li>
                  ))}
                </ul>
              </div>
              <CtaButton label="Try it now" />
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="px-5 sm:px-8 py-12 sm:py-20 border-t border-[var(--line-200)]" style={{ background: "var(--paper-2)" }}>
          <div className="max-w-[1160px] mx-auto">
            <SectionTitle
              eyebrow="Careful by design"
              title="Answers you can trust — and check"
              sub="A wrong answer that looks right is worse than no answer. So the solver is built to be honest about what it isn't sure of."
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {TRUST.map(({ Icon, title, desc }) => (
                <div key={title} className="rounded-[var(--r-lg)] p-5 border border-[var(--line-200)]" style={{ background: "var(--surface)" }}>
                  <Icon size={20} style={{ color: "var(--gold-700)" }} />
                  <h3 className="font-bold text-[15.5px] mt-3 mb-1.5 tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>{title}</h3>
                  <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--ink-700)" }}>{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-center mt-6 flex items-center justify-center gap-1.5 flex-wrap" style={{ color: "var(--fg-muted)" }}>
              <Download size={14} /> Answer sheets download as PDF or editable Word, with an answer key and a list of flagged questions.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-5 sm:px-8 py-12 sm:py-20">
          <div className="max-w-[820px] mx-auto">
            <SectionTitle eyebrow="FAQ" title="Questions about the AI Question Paper Solver" />
            <div className="flex flex-col gap-3">
              {faqList.map((f) => (
                <details key={f.q} className="group rounded-[var(--r-lg)] border border-[var(--line-200)] px-5 py-4" style={{ background: "var(--surface)" }}>
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-[15px]" style={{ color: "var(--ink-900)" }}>
                    {f.q}
                    <span className="shrink-0 text-[18px] leading-none transition-transform group-open:rotate-45" style={{ color: "var(--fg-muted)" }} aria-hidden>+</span>
                  </summary>
                  <p className="text-[14px] leading-[1.65] mt-3" style={{ color: "var(--ink-700)" }}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-5 sm:px-8 pb-14 sm:pb-20">
          <div
            className="max-w-[1160px] mx-auto rounded-[var(--r-2xl)] px-6 py-10 sm:py-14 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, var(--gold-100), var(--gold-50))", border: "1px solid var(--gold-100)" }}
          >
            <h2
              className="font-bold tracking-tight mb-3"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.025em", color: "var(--ink-900)", fontSize: "clamp(24px, 3.6vw, 34px)" }}
            >
              Got a question paper? Get the answers — and the understanding.
            </h2>
            <p className="text-[15px] mb-6 max-w-[560px] mx-auto" style={{ color: "var(--ink-700)" }}>
              Log in, upload your paper and your answer sheet is ready in minutes. Up to {DAILY_JOB_LIMIT} papers a day.
            </p>
            <div className="flex justify-center"><CtaButton label="Log in & solve a paper" variant="primary" /></div>
            <p className="text-[12.5px] mt-4" style={{ color: "var(--fg-muted)" }}>
              New to OlympiadIQ? <Link href="/signup" className="font-semibold hover:underline" style={{ color: "var(--brand)" }}>Create a free account</Link>.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
