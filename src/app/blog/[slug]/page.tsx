import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, Clock, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { PublicHeader } from "@/components/layout";
import { Footer } from "@/app/Footer";
import { OABadge, OACard } from "@/components/ui";
import { Markdown } from "@/components/blog/Markdown";
import { JsonLd } from "@/components/blog/JsonLd";
import { AffiliateDisclosure } from "@/components/blog/AffiliateDisclosure";
import { BlogCard } from "@/components/blog/BlogCard";
import {
  AFFILIATE_PRICE_DISCLAIMER, categorySlug, getPostBySlug,
  getPublishedPosts, getRelatedPosts, SITE_URL,
} from "@/lib/blog";

export const revalidate = 600;

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
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
      <PublicHeader loggedIn={false} />

      <article className="max-w-[760px] mx-auto px-5 sm:px-8 py-9 pb-16">
        {/* Breadcrumb */}
        <nav className="flex items-center flex-wrap gap-1.5 text-[13px] mb-5" style={{ color: "var(--fg-muted)" }} aria-label="Breadcrumb">
          <Link href="/blog" className="hover:underline">Blog</Link>
          <ChevronRight size={13} />
          <Link href={`/blog/category/${categorySlug(post.category)}`} className="hover:underline">{post.category}</Link>
        </nav>

        <div className="flex items-center flex-wrap gap-2 mb-3">
          <OABadge tone="cobalt">{post.category}</OABadge>
          <OABadge tone="neutral">{post.board === "Both" ? "CBSE & ICSE" : post.board}</OABadge>
          {post.class_levels.length > 0 && (
            <OABadge tone="neutral">
              Class {post.class_levels.slice().sort((a, b) => a - b).join(", ")}
            </OABadge>
          )}
        </div>

        <h1
          className="font-black tracking-tight"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(27px, 4.4vw, 40px)", letterSpacing: "-0.02em", color: "var(--ink-900)" }}
        >
          {post.title}
        </h1>
        <p className="mt-3 text-[15.5px] leading-[1.6]" style={{ color: "var(--fg-muted)" }}>{post.excerpt}</p>

        <div className="mt-4 flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]" style={{ color: "var(--fg-subtle)" }}>
          <span>By {post.author_name}</span>
          <span className="inline-flex items-center gap-1"><Calendar size={12} /> {formatDate(post.published_at)}</span>
          <span className="inline-flex items-center gap-1"><Clock size={12} /> {post.reading_minutes} min read</span>
        </div>

        {post.cover_image_url && (
          <div className="mt-6 rounded-[var(--r-lg)] overflow-hidden border" style={{ borderColor: "var(--line-200)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_image_url} alt={post.cover_image_alt ?? post.title} className="w-full" />
          </div>
        )}

        {post.has_affiliate_links && <AffiliateDisclosure withPriceNote />}

        <div className="mt-6">
          <Markdown content={post.content} />
        </div>

        {post.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full text-[12px]" style={{ background: "var(--fill-100)", color: "var(--ink-500)" }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        {post.has_affiliate_links && (
          <p className="mt-8 text-[11.5px] leading-[1.6]" style={{ color: "var(--fg-subtle)" }}>
            {AFFILIATE_PRICE_DISCLAIMER}
          </p>
        )}

        {/* Product CTA */}
        <OACard className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0" style={{ background: "var(--cobalt-50)" }}>
            <Sparkles size={18} style={{ color: "var(--brand)" }} />
          </div>
          <div className="flex-1">
            <p className="text-[14.5px] font-bold" style={{ color: "var(--ink-900)" }}>Practise what you just read</p>
            <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
              OlympiadIQ&apos;s AI tutor and adaptive tests are free for CBSE &amp; ICSE students.
            </p>
          </div>
          <Link href="/onboarding">
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] text-[13.5px] font-semibold text-white" style={{ background: "var(--cobalt-500)" }}>
              Try it free <ArrowRight size={14} />
            </span>
          </Link>
        </OACard>
      </article>

      {related.length > 0 && (
        <section className="max-w-[1100px] mx-auto px-5 sm:px-8 pb-20">
          <h2 className="t-overline mb-4">More in {post.category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {related.map((p) => (
              <BlogCard key={p.slug} post={p} />
            ))}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
