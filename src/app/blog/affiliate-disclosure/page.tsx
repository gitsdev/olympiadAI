import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout";
import { Footer } from "@/app/Footer";

export const metadata: Metadata = {
  title: "Affiliate Disclosure | OlympiadIQ Blog",
  description:
    "How OlympiadIQ uses Amazon affiliate links on its blog, and our commitment to honest, useful recommendations.",
  alternates: { canonical: "/blog/affiliate-disclosure" },
};

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14.5px] leading-[1.75] mb-4" style={{ color: "var(--ink-700)" }}>{children}</p>;
}
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-bold tracking-tight mt-10 mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "20px", color: "var(--ink-900)" }}>
      {children}
    </h2>
  );
}

export default function AffiliateDisclosurePage() {
  return (
    <div style={{ background: "var(--paper)" }}>
      <PublicHeader loggedIn={false} />

      <main className="max-w-[720px] mx-auto px-5 sm:px-8 py-12 pb-20">
        <nav className="text-[13px] mb-4" style={{ color: "var(--fg-muted)" }}>
          <Link href="/blog" className="hover:underline">Blog</Link> <span className="mx-1">/</span> Affiliate disclosure
        </nav>
        <h1
          className="font-black tracking-tight mb-2"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.5vw, 38px)", letterSpacing: "-0.02em", color: "var(--ink-900)" }}
        >
          Affiliate Disclosure
        </h1>
        <p className="text-[13.5px] mb-8" style={{ color: "var(--fg-muted)" }}>Last updated September 9, 2026</p>

        <P>
          <strong>OlympiadIQ</strong> (operated by Guild IT Solutions) is a participant in the Amazon Services
          LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn
          advertising fees by advertising and linking to Amazon (Amazon.in, Amazon.com and other Amazon
          marketplaces).
        </P>
        <P>
          <strong>As an Amazon Associate, we earn from qualifying purchases.</strong> When you click an Amazon
          link in one of our articles and buy something, we may receive a small commission. This comes out of
          Amazon&apos;s margin — it does <em>not</em> add anything to the price you pay.
        </P>

        <H2>How we choose what to recommend</H2>
        <P>
          Our recommendations are based on the syllabus fit and teaching value of a book or resource for CBSE and
          ICSE students preparing for school and Olympiad exams. We link to products we believe are genuinely
          useful. A commission never buys a place in an article, and we are not paid by any publisher to feature
          their books.
        </P>

        <H2>Prices and availability</H2>
        <P>
          Product prices and availability shown on Amazon change over time. Any price and availability information
          displayed on Amazon at the time you make a purchase is what applies. We do not manually copy prices into
          our articles; please check the current price on Amazon before buying.
        </P>

        <H2>Other links</H2>
        <P>
          Some articles also link to free resources (NCERT, exam boards, past papers) and to our own free
          platform. Those are not affiliate links.
        </P>

        <H2>Questions</H2>
        <P>
          Email us at <a href="mailto:support@olympiadiq.in" className="underline" style={{ color: "var(--brand)" }}>support@olympiadiq.in</a>{" "}
          if you have any questions about this disclosure. See also our{" "}
          <Link href="/privacy" className="underline" style={{ color: "var(--brand)" }}>Privacy Policy</Link>.
        </P>
      </main>

      <Footer />
    </div>
  );
}
