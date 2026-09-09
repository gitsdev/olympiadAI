import Link from "next/link";
import { List, Sparkles, ArrowRight, Clock } from "lucide-react";
import type { TocItem } from "@/lib/blog-toc";
import type { BlogPostRow } from "@/types/database";

type RelatedPost = Pick<
  BlogPostRow,
  "slug" | "title" | "cover_image_url" | "cover_image_alt" | "category" | "reading_minutes"
>;

export function ArticleSidebar({ toc, related }: { toc: TocItem[]; related: RelatedPost[] }) {
  return (
    <div className="lg:sticky lg:top-[70px] flex flex-col gap-5">
      {toc.length > 1 && (
        <nav
          className="hidden lg:block rounded-[var(--r-lg)] border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--line-200)" }}
          aria-label="Table of contents"
        >
          <div className="flex items-center gap-2 pb-2.5 mb-2 border-b" style={{ borderColor: "var(--line-200)" }}>
            <List size={16} style={{ color: "var(--brand)" }} />
            <span className="text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>In this guide</span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="block px-2 py-1.5 rounded-[var(--r-sm)] text-[12.5px] leading-snug transition-colors hover:bg-[var(--cobalt-50)] hover:text-[var(--brand)]"
                  style={{ color: "var(--ink-700)", paddingLeft: item.level === 3 ? 18 : 8 }}
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Diagnostic / conversion card */}
      <div
        className="rounded-[var(--r-lg)] p-5 relative overflow-hidden text-white"
        style={{ background: "linear-gradient(135deg, var(--cobalt-600), var(--cobalt-500) 60%, var(--secondary, var(--cobalt-400)))" }}
      >
        <div className="absolute -right-6 -bottom-8 w-28 h-28 rounded-full blur-xl" style={{ background: "oklch(1 0 0 / 0.14)" }} />
        <div className="relative flex flex-col gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold w-fit" style={{ background: "oklch(1 0 0 / 0.18)" }}>
            <Sparkles size={12} /> Free 10-minute diagnostic
          </span>
          <p className="text-[15px] font-bold leading-snug" style={{ fontFamily: "var(--font-display)" }}>
            Check your child&apos;s Olympiad readiness
          </p>
          <p className="text-[12.5px] leading-[1.55]" style={{ color: "oklch(1 0 0 / 0.9)" }}>
            An adaptive diagnostic across number sense, logic and geometry — with a topic-by-topic readiness score.
          </p>
          <Link
            href="/onboarding"
            className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--r-md)] text-[13px] font-bold transition-colors"
            style={{ background: "white", color: "var(--cobalt-700)" }}
          >
            Start free <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {related.length > 0 && (
        <div
          className="rounded-[var(--r-lg)] border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--line-200)" }}
        >
          <p className="text-[13px] font-bold mb-3" style={{ color: "var(--ink-900)" }}>Related guides</p>
          <div className="flex flex-col gap-2">
            {related.map((r) => (
              <Link key={r.slug} href={`/blog/${r.slug}`} className="group flex items-center gap-3 p-1.5 rounded-[var(--r-md)] transition-colors hover:bg-[var(--fill-100)]">
                <span className="w-14 h-14 rounded-[var(--r-sm)] overflow-hidden shrink-0" style={{ background: "var(--fill-100)" }}>
                  {r.cover_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover_image_url} alt={r.cover_image_alt ?? r.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--brand)" }}>
                    {r.category}
                  </span>
                  <span className="block text-[13px] font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-[var(--brand)]" style={{ color: "var(--ink-900)" }}>
                    {r.title}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] mt-0.5" style={{ color: "var(--fg-subtle)" }}>
                    <Clock size={10} /> {r.reading_minutes} min read
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
