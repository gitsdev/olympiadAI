// Question paper → answer sheet mock-ups, shared by the landing page and
// the /ai-question-paper-solver SEO page. Decorative only (aria-hidden).

import { Check } from "lucide-react";

/** Mock "question paper" sheet for the visual. */
export function PaperMock() {
  return (
    <div
      className="relative w-full max-w-[300px] rounded-[var(--r-md)] p-5 sm:p-6 -rotate-2"
      style={{ background: "#fff", border: "1px solid var(--line-200)", boxShadow: "var(--shadow-md)", fontFamily: "Georgia, 'Times New Roman', serif" }}
      aria-hidden
    >
      <p className="text-center text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>Half-Yearly Examination</p>
      <p className="text-center text-[10.5px] mb-3" style={{ color: "var(--ink-500)" }}>Class 7 · Mathematics · CBSE</p>
      <div className="h-px mb-3" style={{ background: "var(--ink-900)", opacity: 0.6 }} />
      <p className="text-[10.5px] font-bold mb-1.5" style={{ color: "var(--ink-900)" }}>Section A</p>
      <div className="flex flex-col gap-2 text-[12px] leading-snug" style={{ color: "var(--ink-900)" }}>
        <p>1. The value of ¾ + ¼ is<br /><span className="pl-3 text-[11px]" style={{ color: "var(--ink-700)" }}>(a) ½ &nbsp;(b) 1 &nbsp;(c) 2 &nbsp;(d) ³⁄₁₆</span></p>
        <p>2. Find x if x² = 49, x &gt; 0.</p>
        <p>3. Find the area of the right triangle shown.</p>
        <svg width="96" height="58" viewBox="0 0 96 58" className="ml-3">
          <polygon points="6,52 90,52 6,6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <rect x="6" y="44" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
          <text x="40" y="57" fontSize="8">10 cm</text>
          <text x="0" y="32" fontSize="8" transform="rotate(-90 6 32)">6 cm</text>
        </svg>
      </div>
    </div>
  );
}

/** Mock answer-sheet card for the visual. */
export function AnswerMock() {
  return (
    <div
      className="w-full max-w-[320px] rounded-[var(--r-lg)] overflow-hidden rotate-1"
      style={{ background: "var(--surface)", border: "1px solid var(--line-200)", boxShadow: "var(--shadow-lg)" }}
      aria-hidden
    >
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--cobalt-50)" }}>
        <span className="font-bold text-[13px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
          Question Paper Solutions
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
          3/3 solved
        </span>
      </div>
      <div className="p-4 flex flex-col gap-3 text-[12px]" style={{ color: "var(--ink-900)" }}>
        <div>
          <p className="font-bold text-[12.5px] mb-1" style={{ fontFamily: "var(--font-display)" }}>Question 1</p>
          <div className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] px-2 py-1" style={{ background: "var(--success-bg)" }}>
            <Check size={12} style={{ color: "var(--success)" }} />
            <span className="font-semibold">(b) 1</span>
          </div>
          <p className="mt-1" style={{ color: "var(--ink-700)" }}>Same denominator → add numerators: ⁴⁄₄ = 1</p>
        </div>
        <div>
          <p className="font-bold text-[12.5px] mb-1" style={{ fontFamily: "var(--font-display)" }}>Question 2</p>
          <p style={{ color: "var(--ink-700)" }}>1. x² = 49 &nbsp;2. x = √49 &nbsp;3. x = 7</p>
          <div className="mt-1.5 rounded-r-[var(--r-sm)] border-l-[3px] px-2 py-1 font-bold" style={{ borderColor: "var(--cobalt-500)", background: "var(--cobalt-50)" }}>
            <span className="text-[9.5px] tracking-wider mr-1.5" style={{ color: "var(--cobalt-700)" }}>FINAL ANSWER</span>x = 7
          </div>
        </div>
        <div>
          <p className="font-bold text-[12.5px] mb-1" style={{ fontFamily: "var(--font-display)" }}>Question 3</p>
          <p style={{ color: "var(--ink-700)" }}>Area = ½ × 10 × 6 = <strong style={{ color: "var(--ink-900)" }}>30 cm²</strong></p>
        </div>
        <div className="flex gap-2 pt-1">
          <span className="flex-1 text-center text-[11px] font-semibold rounded-[var(--r-sm)] py-1.5 text-white" style={{ background: "var(--cobalt-500)" }}>
            Download PDF
          </span>
          <span className="flex-1 text-center text-[11px] font-semibold rounded-[var(--r-sm)] py-1.5" style={{ border: "1px solid var(--line-300)", color: "var(--ink-900)" }}>
            Download Word
          </span>
        </div>
      </div>
    </div>
  );
}
