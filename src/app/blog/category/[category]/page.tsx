import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout";
import { Footer } from "@/app/Footer";
import { BlogCard } from "@/components/blog/BlogCard";
import { JsonLd } from "@/components/blog/JsonLd";
import { AffiliateDisclosure } from "@/components/blog/AffiliateDisclosure";
import { BLOG_CATEGORIES, categoryFromSlug, categorySlug, SITE_URL } from "@/lib/blog";
import { getPublishedPosts } from "@/lib/blog-data";

export const revalidate = 600;

export function generateStaticParams() {
  return BLOG_CATEGORIES.map((c) => ({ category: categorySlug(c.name) }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) return {};
  const blurb = BLOG_CATEGORIES.find((c) => c.name === category)!.blurb;
  const title = `${category} — OlympiadIQ Blog`;
  return {
    title,
    description: blurb,
    alternates: { canonical: `/blog/category/${slug}` },
    openGraph: { type: "website", url: `/blog/category/${slug}`, title, description: blurb, siteName: "OlympiadIQ" },
  };
}

export default async function BlogCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const blurb = BLOG_CATEGORIES.find((c) => c.name === category)!.blurb;
  const all = await getPublishedPosts();
  const posts = all.filter((p) => p.category === category);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: category, item: `${SITE_URL}/blog/category/${slug}` },
    ],
  };

  const tabBase = "px-4 py-2 rounded-[var(--r-pill)] text-[13px] font-semibold transition-all whitespace-nowrap";

  return (
    <div style={{ background: "var(--paper)" }}>
      <JsonLd data={jsonLd} />
      <PublicHeader loggedIn={false} />

      <main className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 sm:py-14 pb-20">
        <nav className="text-[13px] mb-4" style={{ color: "var(--fg-muted)" }} aria-label="Breadcrumb">
          <Link href="/blog" className="hover:underline">Blog</Link> <span className="mx-1">/</span>{" "}
          <span style={{ color: "var(--ink-900)", fontWeight: 600 }}>{category}</span>
        </nav>
        <h1
          className="font-black tracking-tight"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.6vw, 42px)", letterSpacing: "-0.02em", color: "var(--ink-900)" }}
        >
          {category}
        </h1>
        <p className="mt-3 max-w-[620px] text-[15px] leading-[1.65]" style={{ color: "var(--fg-muted)" }}>{blurb}</p>

        <div className="mt-6 flex overflow-x-auto py-1">
          <div className="inline-flex items-center gap-1 p-1.5 rounded-[var(--r-pill)]" style={{ background: "var(--fill-100)" }}>
            <Link href="/blog" className={tabBase} style={{ color: "var(--ink-700)" }}>All posts</Link>
            {BLOG_CATEGORIES.map((c) => {
              const active = c.name === category;
              return (
                <Link
                  key={c.name}
                  href={`/blog/category/${categorySlug(c.name)}`}
                  className={tabBase}
                  style={active
                    ? { background: "var(--cobalt-500)", color: "white", boxShadow: "var(--shadow-sm)" }
                    : { color: "var(--ink-700)" }}
                >
                  {c.name}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <AffiliateDisclosure />
        </div>

        {posts.length === 0 ? (
          <p className="mt-8 text-[14px]" style={{ color: "var(--fg-muted)" }}>No articles in this category yet.</p>
        ) : (
          <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p) => (
              <BlogCard key={p.slug} post={p} />
            ))}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
