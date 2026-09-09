import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { PublicHeader } from "@/components/layout";
import { Footer } from "@/app/Footer";
import { FeaturedPost } from "@/components/blog/FeaturedPost";
import { BlogExplorer } from "@/components/blog/BlogExplorer";
import { JsonLd } from "@/components/blog/JsonLd";
import { AffiliateDisclosure } from "@/components/blog/AffiliateDisclosure";
import { BLOG_CATEGORIES, popularTags, SITE_URL } from "@/lib/blog";
import { getPublishedPosts } from "@/lib/blog-data";

export const revalidate = 600;

const TITLE = "The OlympiadIQ Blog — Olympiad Prep & ICSE/CBSE Study References";
const DESCRIPTION =
  "Guides, book reviews and exam strategy for Math & Science Olympiads and CBSE/ICSE Classes 1–10 — with hand-picked study resources for students and parents.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", url: "/blog", title: TITLE, description: DESCRIPTION, siteName: "OlympiadIQ" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();
  const [featured, ...rest] = posts;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      "@id": `${SITE_URL}/blog#blog`,
      name: "The OlympiadIQ Blog",
      description: DESCRIPTION,
      url: `${SITE_URL}/blog`,
      publisher: { "@type": "Organization", name: "OlympiadIQ", url: SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: posts.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/blog/${p.slug}`,
        name: p.title,
      })),
    },
  ];

  return (
    <div style={{ background: "var(--paper)" }}>
      <JsonLd data={jsonLd} />
      <PublicHeader loggedIn={false} />

      <main>
        {/* Hero */}
        <div className="relative overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[360px] rounded-full blur-3xl pointer-events-none -z-10"
            style={{ background: "radial-gradient(60% 60% at 50% 0%, var(--cobalt-50), transparent 70%)" }}
          />
          <div className="max-w-[1100px] mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-4">
            <div className="flex flex-col items-center text-center max-w-3xl mx-auto gap-4">
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold uppercase tracking-wider shadow-[var(--shadow-xs)]"
                style={{ background: "var(--cobalt-50)", color: "var(--cobalt-700)" }}
              >
                <BookOpen size={14} /> OlympiadIQ Blog &amp; Insights
              </span>
              <h1
                className="font-black tracking-tight"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 5vw, 46px)", letterSpacing: "-0.025em", color: "var(--ink-900)" }}
              >
                Olympiad prep &amp; study references for{" "}
                <span style={{ color: "var(--brand)" }}>CBSE &amp; ICSE</span>
              </h1>
              <p className="text-[15.5px] leading-[1.65] max-w-2xl" style={{ color: "var(--fg-muted)" }}>
                {DESCRIPTION}
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 pb-16">
          {posts.length === 0 ? (
            <p className="mt-10 text-center text-[14px]" style={{ color: "var(--fg-muted)" }}>
              No articles published yet — check back soon.
            </p>
          ) : (
            <BlogExplorer
              posts={rest}
              categories={BLOG_CATEGORIES.map((c) => c.name)}
              popular={popularTags(posts, 5)}
              disclosure={<AffiliateDisclosure />}
              featured={featured ? <FeaturedPost post={featured} /> : null}
            />
          )}

          {/* Conversion banner */}
          <section
            className="mt-20 relative rounded-[var(--r-2xl)] overflow-hidden p-8 sm:p-12 text-center"
            style={{ background: "linear-gradient(135deg, var(--cobalt-700), var(--cobalt-500) 55%, var(--cobalt-600))" }}
          >
            <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full blur-2xl" style={{ background: "oklch(1 0 0 / 0.1)" }} />
            <div className="relative max-w-2xl mx-auto flex flex-col items-center gap-4 text-white">
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-semibold"
                style={{ background: "oklch(1 0 0 / 0.15)" }}
              >
                <Sparkles size={14} /> Free for every CBSE &amp; ICSE student
              </span>
              <h2
                className="font-black tracking-tight"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3.5vw, 32px)", letterSpacing: "-0.02em" }}
              >
                Put the guides into practice
              </h2>
              <p className="text-[15px] leading-[1.6]" style={{ color: "oklch(1 0 0 / 0.9)" }}>
                OlympiadIQ&apos;s AI tutor, adaptive mock tests and a readiness score that tells you exactly what to
                fix — grounded in your syllabus, Classes 1–10.
              </p>
              <Link
                href="/onboarding"
                className="mt-1 inline-flex items-center gap-2 px-6 py-3 rounded-[var(--r-md)] text-[14px] font-bold transition-colors"
                style={{ background: "white", color: "var(--cobalt-700)" }}
              >
                Start free <ArrowRight size={16} />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
