import Link from "next/link";
import { Clock, CircleCheck, ArrowRight, Trophy } from "lucide-react";
import { OABadge } from "@/components/ui";
import { categoryTone } from "@/lib/blog";
import type { BlogPostRow } from "@/types/database";

type FeaturedData = Pick<
  BlogPostRow,
  "slug" | "title" | "excerpt" | "cover_image_url" | "cover_image_alt" | "category" | "author_name" | "reading_minutes" | "published_at"
>;

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

function monthYear(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function FeaturedPost({ post }: { post: FeaturedData }) {
  return (
    <article
      className="group relative bg-[var(--surface)] rounded-[var(--r-2xl)] border shadow-[var(--shadow-sm)] overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-lg)]"
      style={{ borderColor: "var(--line-200)" }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Editorial narrative */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: "var(--fg-subtle)" }}>
              <OABadge tone={categoryTone(post.category)}>{post.category}</OABadge>
              <span>•</span>
              <span className="inline-flex items-center gap-1"><Clock size={13} /> {post.reading_minutes} min read</span>
              {post.published_at && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1" style={{ color: "var(--success-tx)" }}>
                    <CircleCheck size={13} /> Updated {monthYear(post.published_at)}
                  </span>
                </>
              )}
            </div>

            <h2
              className="font-black tracking-tight transition-colors group-hover:text-[var(--brand)]"
              style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3.2vw, 32px)", lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--ink-900)" }}
            >
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>

            <p className="text-[15px] leading-[1.65] line-clamp-3" style={{ color: "var(--fg-muted)" }}>
              {post.excerpt}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2.5">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{ background: "var(--cobalt-500)", color: "white" }}
              >
                {initials(post.author_name)}
              </span>
              <div>
                <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink-900)" }}>{post.author_name}</div>
                <div className="text-[12px]" style={{ color: "var(--fg-subtle)" }}>OlympiadIQ Editorial</div>
              </div>
            </div>
            <Link
              href={`/blog/${post.slug}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--r-md)] text-[13.5px] font-semibold text-white transition-colors"
              style={{ background: "var(--cobalt-500)" }}
            >
              Read full guide <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Visual panel */}
        <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-full order-first lg:order-last" style={{ background: "var(--fill-100)" }}>
          {post.cover_image_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.cover_image_url}
                alt={post.cover_image_alt ?? post.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, oklch(0.23 0.02 264 / 0.22), transparent 55%)" }} />
            </>
          ) : (
            <div className="absolute inset-0 graph-bg opacity-70" />
          )}
          <div
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] shadow-[var(--shadow-md)]"
            style={{ background: "oklch(1 0 0 / 0.95)", backdropFilter: "blur(6px)" }}
          >
            <Trophy size={15} style={{ color: "var(--gold-700)" }} />
            <span className="text-[11.5px] font-bold" style={{ color: "var(--ink-900)" }}>Featured guide</span>
          </div>
        </div>
      </div>
    </article>
  );
}
