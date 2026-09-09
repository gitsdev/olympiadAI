"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { BlogCard } from "@/components/blog/BlogCard";
import type { BlogPostRow } from "@/types/database";

type ExplorerPost = Pick<
  BlogPostRow,
  | "slug" | "title" | "excerpt" | "cover_image_url" | "cover_image_alt"
  | "category" | "class_levels" | "tags" | "author_name" | "reading_minutes" | "published_at"
>;

export function BlogExplorer({
  posts,
  categories,
  popular,
  disclosure,
  featured,
}: {
  posts: ExplorerPost[];
  categories: string[];
  popular: string[];
  disclosure: ReactNode;
  featured: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 || activeCat !== "all";

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (activeCat !== "all" && p.category !== activeCat) return false;
      if (!q) return true;
      const haystack = `${p.title} ${p.excerpt} ${p.tags.join(" ")} ${p.category}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [posts, activeCat, q]);

  const tabBase =
    "px-4 py-2 rounded-[var(--r-pill)] text-[13px] font-semibold transition-all duration-200 whitespace-nowrap";

  return (
    <div>
      {/* Search command bar */}
      <div className="max-w-2xl mx-auto">
        <div
          className="flex items-center gap-2 rounded-[var(--r-lg)] border p-1.5 shadow-[var(--shadow-sm)]"
          style={{ background: "var(--surface)", borderColor: "var(--line-200)" }}
        >
          <Search size={18} className="ml-2 shrink-0" style={{ color: "var(--fg-subtle)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides, topics, syllabus, or books…"
            aria-label="Search the blog"
            className="w-full bg-transparent px-1 py-2 text-[14px] outline-none"
            style={{ color: "var(--ink-900)" }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="mr-1.5 px-2 py-1 text-[12px] font-semibold rounded-[var(--r-sm)]"
              style={{ color: "var(--fg-muted)" }}
            >
              Clear
            </button>
          )}
        </div>

        {popular.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
            <span className="text-[12px]" style={{ color: "var(--fg-subtle)" }}>Popular:</span>
            {popular.map((t) => (
              <button
                key={t}
                onClick={() => setQuery(t)}
                className="px-2.5 py-1 rounded-[var(--r-sm)] text-[12px] font-medium transition-colors"
                style={{ background: "var(--fill-100)", color: "var(--ink-700)" }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="mt-8 flex justify-center overflow-x-auto py-1">
        <div
          className="inline-flex items-center gap-1 p-1.5 rounded-[var(--r-pill)]"
          style={{ background: "var(--fill-100)" }}
        >
          {["all", ...categories].map((cat) => {
            const active = activeCat === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={tabBase}
                style={
                  active
                    ? { background: "var(--cobalt-500)", color: "white", boxShadow: "var(--shadow-sm)" }
                    : { color: "var(--ink-700)" }
                }
              >
                {cat === "all" ? "All posts" : cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">{disclosure}</div>

      {!filtering && featured && <div className="mt-8">{featured}</div>}

      {/* Section header */}
      <div className="mt-12 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--cobalt-500)" }} />
            <span className="t-overline">Curated library</span>
          </div>
          <h2
            className="font-bold tracking-tight mt-1.5"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 3vw, 26px)", color: "var(--ink-900)" }}
          >
            {activeCat === "all" ? "Recommended guides & reviews" : activeCat}
          </h2>
        </div>
        <p className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          Showing <span className="font-semibold" style={{ color: "var(--ink-900)" }}>{filtered.length}</span>{" "}
          {filtered.length === 1 ? "article" : "articles"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div
          className="mt-6 rounded-[var(--r-xl)] border p-10 text-center"
          style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}
        >
          <p className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>No articles match your search</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--fg-muted)" }}>
            Try a different keyword or{" "}
            <button
              onClick={() => { setQuery(""); setActiveCat("all"); }}
              className="underline font-semibold"
              style={{ color: "var(--brand)" }}
            >
              clear the filters
            </button>
            .
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <BlogCard key={p.slug} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
