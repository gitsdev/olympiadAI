import Link from "next/link";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout";
import { Footer } from "@/app/Footer";
import { BlogCard } from "@/components/blog/BlogCard";
import { JsonLd } from "@/components/blog/JsonLd";
import { AffiliateDisclosure } from "@/components/blog/AffiliateDisclosure";
import { BLOG_CATEGORIES, categorySlug, getPublishedPosts, SITE_URL } from "@/lib/blog";

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

      <main className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 sm:py-14 pb-20">
        <header className="max-w-[640px]">
          <p className="t-overline mb-3">OlympiadIQ Blog</p>
          <h1
            className="font-black tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 5vw, 46px)", letterSpacing: "-0.02em", color: "var(--ink-900)" }}
          >
            Olympiad prep &amp; study references for CBSE &amp; ICSE
          </h1>
          <p className="mt-4 text-[15.5px] leading-[1.65]" style={{ color: "var(--fg-muted)" }}>
            {DESCRIPTION}
          </p>
        </header>

        {/* Category chips */}
        <nav className="mt-7 flex flex-wrap gap-2" aria-label="Blog categories">
          <span
            className="px-3 py-1.5 rounded-full text-[13px] font-semibold"
            style={{ background: "var(--cobalt-500)", color: "white" }}
          >
            All posts
          </span>
          {BLOG_CATEGORIES.map((c) => (
            <Link
              key={c.name}
              href={`/blog/category/${categorySlug(c.name)}`}
              className="px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-colors hover:bg-[var(--fill-100)]"
              style={{ borderColor: "var(--line-300)", color: "var(--ink-700)" }}
            >
              {c.name}
            </Link>
          ))}
        </nav>

        <AffiliateDisclosure />

        {posts.length === 0 ? (
          <p className="mt-10 text-[14px]" style={{ color: "var(--fg-muted)" }}>
            No articles published yet — check back soon.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-10">
            {featured && (
              <section>
                <BlogCard post={featured} featured />
              </section>
            )}
            {rest.length > 0 && (
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((p) => (
                  <BlogCard key={p.slug} post={p} />
                ))}
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
