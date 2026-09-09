import Link from "next/link";
import { Clock } from "lucide-react";
import { OABadge } from "@/components/ui";
import type { BlogPostRow } from "@/types/database";

type CardPost = Pick<
  BlogPostRow,
  "slug" | "title" | "excerpt" | "cover_image_url" | "cover_image_alt" | "category" | "reading_minutes" | "published_at"
>;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function BlogCard({ post, featured = false }: { post: CardPost; featured?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article
        className="h-full flex flex-col overflow-hidden rounded-[var(--r-lg)] border bg-[var(--surface)] shadow-[var(--shadow-sm)] transition-all duration-[180ms] group-hover:shadow-[var(--shadow-md)] group-hover:border-[var(--cobalt-200)] group-hover:-translate-y-0.5"
        style={{ borderColor: "var(--line-200)" }}
      >
        {post.cover_image_url && (
          <div className={`relative w-full overflow-hidden ${featured ? "aspect-[16/8]" : "aspect-[16/9]"}`} style={{ background: "var(--fill-100)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_image_url} alt={post.cover_image_alt ?? post.title} loading="lazy" className="w-full h-full object-cover" />
          </div>
        )}
        <div className={`flex flex-col flex-1 ${featured ? "p-6" : "p-5"}`}>
          <div className="flex items-center gap-2 mb-2.5">
            <OABadge tone="cobalt">{post.category}</OABadge>
          </div>
          <h3
            className={`font-bold tracking-tight ${featured ? "text-[22px]" : "text-[17px]"} leading-snug`}
            style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}
          >
            {post.title}
          </h3>
          <p className="mt-2 text-[13.5px] leading-[1.6] line-clamp-3" style={{ color: "var(--fg-muted)" }}>
            {post.excerpt}
          </p>
          <div className="mt-auto pt-4 flex items-center gap-3 text-[12px]" style={{ color: "var(--fg-subtle)" }}>
            <span>{formatDate(post.published_at)}</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> {post.reading_minutes} min read
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
