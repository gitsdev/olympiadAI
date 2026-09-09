import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, Clock, Calendar } from "lucide-react";
import { PublicHeader } from "@/components/layout";
import { Footer } from "@/app/Footer";
import { OABadge } from "@/components/ui";
import { Markdown } from "@/components/blog/Markdown";
import { JsonLd } from "@/components/blog/JsonLd";
import { AffiliateDisclosure } from "@/components/blog/AffiliateDisclosure";
import { ReadingProgress } from "@/components/blog/ReadingProgress";
import { ShareBar } from "@/components/blog/ShareBar";
import { ArticleFeedback } from "@/components/blog/ArticleFeedback";
import { ArticleSidebar } from "@/components/blog/ArticleSidebar";
import { AFFILIATE_PRICE_DISCLAIMER, categorySlug, categoryTone, classRangeLabel, SITE_URL } from "@/lib/blog";
import { buildToc } from "@/lib/blog-toc";
import { getPostBySlug, getPublishedPosts, getRelatedPosts } from "@/lib/blog-data";

export const revalidate = 600;

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const title = post.seo_title ?? `${post.title} | OlympiadIQ Blog`;
  const description = post.seo_description ?? post.excerpt;
  const url = `/blog/${post.slug}`;

  return {
    title,
    description,
    keywords: post.tags,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "OlympiadIQ",
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      authors: [post.author_name],
      section: post.category,
      tags: post.tags,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(post.category, post.slug);
  const toc = buildToc(post.content);

  const url = `${SITE_URL}/blog/${post.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: post.title,
      description: post.excerpt,
      image: post.cover_image_url ? [post.cover_image_url] : undefined,
      datePublished: post.published_at ?? undefined,
      dateModified: post.updated_at,
      author: { "@type": "Organization", name: post.author_name, url: SITE_URL },
      publisher: {
        "@type": "Organization",
        name: "OlympiadIQ",
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/assets/logo-mark.svg` },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      articleSection: post.category,
      keywords: post.tags.join(", "),
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
        { "@type": "ListItem", position: 3, name: post.category, item: `${SITE_URL}/blog/category/${categorySlug(post.category)}` },
        { "@type": "ListItem", position: 4, name: post.title, item: url },
      ],
    },
  ];

  return (
    <div style={{ background: "var(--paper)" }}>
      <JsonLd data={jsonLd} />
      <ReadingProgress />
      <PublicHeader loggedIn={false} />

      {/* Breadcrumb strip */}
      <div className="border-b" style={{ background: "var(--surface)", borderColor: "var(--line-200)" }}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-2.5">
          <nav className="flex items-center gap-1.5 text-[12.5px] flex-nowrap overflow-hidden" style={{ color: "var(--fg-muted)" }} aria-label="Breadcrumb">
            <Link href="/" className="hover:underline shrink-0">Home</Link>
            <ChevronRight size={12} className="shrink-0" />
            <Link href="/blog" className="hover:underline shrink-0">Blog</Link>
            <ChevronRight size={12} className="shrink-0" />
            <Link href={`/blog/category/${categorySlug(post.category)}`} className="hover:underline shrink-0" style={{ color: "var(--brand)" }}>
              {post.category}
            </Link>
            <ChevronRight size={12} className="shrink-0" />
            <span className="truncate" style={{ color: "var(--ink-900)" }}>{post.title}</span>
          </nav>
        </div>
      </div>

      <main className="max-w-[1100px] mx-auto px-5 sm:px-8 py-8 sm:py-10 pb-16">
        {/* Article header */}
        <header className="max-w-3xl">
          <div className="flex items-center flex-wrap gap-2 mb-3.5">
            <OABadge tone={categoryTone(post.category)}>{post.category}</OABadge>
            <OABadge tone="neutral">{post.board === "Both" ? "CBSE & ICSE" : post.board}</OABadge>
            {post.class_levels.length > 0 && <OABadge tone="neutral">{classRangeLabel(post.class_levels)}</OABadge>}
          </div>

          <h1
            className="font-black tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1.12, letterSpacing: "-0.025em", color: "var(--ink-900)" }}
          >
            {post.title}
          </h1>
          <p className="mt-4 text-[16px] leading-[1.6]" style={{ color: "var(--fg-muted)" }}>{post.excerpt}</p>

          <div
            className="mt-5 pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{ borderColor: "var(--line-200)" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{ background: "var(--cobalt-500)", color: "white" }}
              >
                {initials(post.author_name)}
              </span>
              <div>
                <div className="text-[13.5px] font-bold" style={{ color: "var(--ink-900)" }}>{post.author_name}</div>
                <div className="flex items-center gap-2 text-[12px] mt-0.5" style={{ color: "var(--fg-subtle)" }}>
                  <span className="inline-flex items-center gap-1"><Calendar size={11} /> {formatDate(post.published_at)}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1"><Clock size={11} /> {post.reading_minutes} min read</span>
                </div>
              </div>
            </div>
            <ShareBar url={url} title={post.title} />
          </div>
        </header>

        {/* Hero image */}
        {post.cover_image_url && (
          <figure className="mt-8 relative rounded-[var(--r-2xl)] overflow-hidden border" style={{ borderColor: "var(--line-200)", background: "var(--fill-100)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover_image_url}
              alt={post.cover_image_alt ?? post.title}
              className="w-full object-cover"
              style={{ aspectRatio: "21 / 9" }}
            />
            {post.cover_image_alt && (
              <>
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, oklch(0.23 0.02 264 / 0.6), transparent 55%)" }} />
                <figcaption className="absolute bottom-3 left-4 right-4 text-[12px] italic text-white/90">
                  {post.cover_image_alt}
                </figcaption>
              </>
            )}
          </figure>
        )}

        {/* Body + sidebar */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <article className="lg:col-span-8 min-w-0">
            {post.has_affiliate_links && (
              <div className="mb-6">
                <AffiliateDisclosure withPriceNote />
              </div>
            )}

            <Markdown content={post.content} />

            {post.tags.length > 0 && (
              <div className="mt-9 flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-[var(--r-sm)] text-[12px]" style={{ background: "var(--fill-100)", color: "var(--ink-500)" }}>
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {post.has_affiliate_links && (
              <p className="mt-6 text-[11.5px] leading-[1.6]" style={{ color: "var(--fg-subtle)" }}>
                {AFFILIATE_PRICE_DISCLAIMER}
              </p>
            )}

            <div className="mt-8">
              <ArticleFeedback />
            </div>
          </article>

          <aside className="lg:col-span-4">
            <ArticleSidebar toc={toc} related={related} />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
