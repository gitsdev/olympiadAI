import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import { OABadge } from "@/components/ui";
import { categoryTone, classRangeLabel } from "@/lib/blog";
import type { BlogPostRow } from "@/types/database";

type CardPost = Pick<
  BlogPostRow,
  | "slug" | "title" | "excerpt" | "cover_image_url" | "cover_image_alt"
  | "category" | "class_levels" | "tags" | "author_name" | "reading_minutes" | "published_at"
>;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function BlogCard({ post }: { post: CardPost }) {
  return (
    <article
      className="group flex flex-col h-full bg-[var(--surface)] rounded-[var(--r-xl)] p-4 border shadow-[var(--shadow-sm)] transition-all duration-200 hover:shadow-[var(--shadow-md)] hover:-translate-y-1"
      style={{ borderColor: "var(--line-200)" }}
    >
      {post.cover_image_url && (
        <Link href={`/blog/${post.slug}`} className="relative block h-44 w-full rounded-[var(--r-lg)] overflow-hidden mb-3.5" style={{ background: "var(--fill-100)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_image_url}
            alt={post.cover_image_alt ?? post.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute top-3 left-3">
            <OABadge tone={categoryTone(post.category)} className="shadow-sm">{post.category}</OABadge>
          </span>
        </Link>
      )}

      {!post.cover_image_url && (
        <div className="mb-3">
          <OABadge tone={categoryTone(post.category)}>{post.category}</OABadge>
        </div>
      )}

      <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--fg-subtle)" }}>
        <span className="inline-flex items-center gap-1"><Clock size={12} /> {post.reading_minutes} min read</span>
        <span>•</span>
        <span>{classRangeLabel(post.class_levels)}</span>
      </div>

      <h3 className="font-bold leading-snug text-[16.5px] tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
        <Link href={`/blog/${post.slug}`} className="transition-colors group-hover:text-[var(--brand)]">
          {post.title}
        </Link>
      </h3>

      <p className="mt-2 text-[13.5px] leading-[1.6] line-clamp-2" style={{ color: "var(--fg-muted)" }}>
        {post.excerpt}
      </p>

      {post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.slice(0, 2).map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-[var(--r-sm)] text-[11.5px] font-medium" style={{ background: "var(--cobalt-50)", color: "var(--cobalt-700)" }}>
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold" style={{ background: "var(--fill-200)", color: "var(--ink-700)" }}>
            {initials(post.author_name)}
          </span>
          <span className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>{post.author_name}</span>
        </div>
        <Link
          href={`/blog/${post.slug}`}
          className="inline-flex items-center gap-1 text-[13px] font-semibold transition-transform group-hover:translate-x-0.5"
          style={{ color: "var(--brand)" }}
        >
          Read <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  );
}
