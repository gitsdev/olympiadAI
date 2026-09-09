"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil } from "lucide-react";
import { savePost, type BlogPostInput } from "@/actions/blog";
import { BLOG_CATEGORIES } from "@/lib/blog";
import { Markdown } from "@/components/blog/Markdown";
import type { BlogPostRow, BlogBoard, BlogStatus } from "@/types/database";

const BOARDS: BlogBoard[] = ["Both", "CBSE", "ICSE"];
const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const labelCls = "block text-[12.5px] font-semibold mb-1.5";
const inputCls =
  "w-full px-3 py-2 rounded-[var(--r-md)] border text-[14px] outline-none focus:border-[var(--cobalt-400)]";
const inputStyle = { borderColor: "var(--line-300)", background: "var(--surface)", color: "var(--ink-900)" } as const;

export function PostEditor({ initial }: { initial?: BlogPostRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("write");

  const [f, setF] = useState({
    title: initial?.title ?? "",
    excerpt: initial?.excerpt ?? "",
    content: initial?.content ?? "",
    cover_image_url: initial?.cover_image_url ?? "",
    cover_image_alt: initial?.cover_image_alt ?? "",
    category: initial?.category ?? BLOG_CATEGORIES[0].name,
    board: initial?.board ?? ("Both" as BlogBoard),
    class_levels: initial?.class_levels ?? ([] as number[]),
    tags: (initial?.tags ?? []).join(", "),
    author_name: initial?.author_name ?? "OlympiadIQ Team",
    seo_title: initial?.seo_title ?? "",
    seo_description: initial?.seo_description ?? "",
    has_affiliate_links: initial?.has_affiliate_links ?? true,
  });

  function set<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  function submit(status: BlogStatus) {
    setError("");
    const input: BlogPostInput = {
      id: initial?.id,
      title: f.title,
      excerpt: f.excerpt,
      content: f.content,
      cover_image_url: f.cover_image_url,
      cover_image_alt: f.cover_image_alt,
      category: f.category,
      board: f.board,
      class_levels: f.class_levels,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      author_name: f.author_name,
      seo_title: f.seo_title,
      seo_description: f.seo_description,
      has_affiliate_links: f.has_affiliate_links,
      status,
    };
    start(async () => {
      const res = await savePost(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/blog");
      router.refresh();
    });
  }

  return (
    <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-black tracking-tight" style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--ink-900)" }}>
          {initial ? "Edit post" : "New post"}
        </h1>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => submit("draft")}
            disabled={pending}
            className="px-4 py-2 rounded-[var(--r-md)] text-[13px] font-semibold border disabled:opacity-50"
            style={{ borderColor: "var(--line-300)", color: "var(--ink-700)", background: "var(--surface)" }}
          >
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button
            onClick={() => submit("published")}
            disabled={pending}
            className="px-4 py-2 rounded-[var(--r-md)] text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--cobalt-500)" }}
          >
            {initial?.status === "published" ? "Update" : "Publish"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 p-3 rounded-[var(--r-md)] text-[13px]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls} style={{ color: "var(--ink-700)" }}>Title</label>
            <input className={inputCls} style={inputStyle} value={f.title} onChange={(e) => set("title", e.target.value)}
              placeholder="How to prepare for the IMO Level 1 (Class 6)" />
            <p className="text-[11px] mt-1" style={{ color: "var(--fg-subtle)" }}>
              The URL is generated from the title{initial ? ` (currently /blog/${initial.slug})` : ""}.
            </p>
          </div>

          <div>
            <label className={labelCls} style={{ color: "var(--ink-700)" }}>Excerpt / summary</label>
            <textarea className={inputCls} style={inputStyle} rows={2} value={f.excerpt} onChange={(e) => set("excerpt", e.target.value)}
              placeholder="One or two sentences — also used as the meta description if no SEO description is set." />
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <button onClick={() => setTab("write")} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-sm)] text-[12px] font-semibold"
                style={tab === "write" ? { background: "var(--cobalt-50)", color: "var(--cobalt-700)" } : { color: "var(--fg-muted)" }}>
                <Pencil size={12} /> Write
              </button>
              <button onClick={() => setTab("preview")} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-sm)] text-[12px] font-semibold"
                style={tab === "preview" ? { background: "var(--cobalt-50)", color: "var(--cobalt-700)" } : { color: "var(--fg-muted)" }}>
                <Eye size={12} /> Preview
              </button>
            </div>
            {tab === "write" ? (
              <textarea
                className={inputCls}
                style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: 1.6 }}
                rows={24}
                value={f.content}
                onChange={(e) => set("content", e.target.value)}
                placeholder={"Write in Markdown.\n\n## A heading\n\nA paragraph with an [Amazon link](https://www.amazon.in/dp/XXXXXXXXXX) — the associate tag and rel=\"sponsored nofollow\" are added automatically.\n\n- bullet\n- list\n\n| Book | Best for |\n| --- | --- |\n| ... | ... |"}
              />
            ) : (
              <div className="rounded-[var(--r-md)] border p-4" style={{ borderColor: "var(--line-300)", background: "var(--surface)" }}>
                {f.content.trim() ? <Markdown content={f.content} /> : <p className="text-[13px]" style={{ color: "var(--fg-subtle)" }}>Nothing to preview yet.</p>}
              </div>
            )}
            <p className="text-[11px] mt-1" style={{ color: "var(--fg-subtle)" }}>
              GitHub-flavoured Markdown. Don&apos;t paste live prices into the text — Amazon prices change and the
              disclosure already covers &ldquo;price as of&rdquo;.
            </p>
          </div>

          <details className="rounded-[var(--r-md)] border p-3" style={{ borderColor: "var(--line-200)" }}>
            <summary className="text-[13px] font-semibold cursor-pointer" style={{ color: "var(--ink-700)" }}>SEO overrides (optional)</summary>
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <label className={labelCls} style={{ color: "var(--ink-700)" }}>SEO title</label>
                <input className={inputCls} style={inputStyle} value={f.seo_title} onChange={(e) => set("seo_title", e.target.value)} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--ink-700)" }}>SEO description</label>
                <textarea className={inputCls} style={inputStyle} rows={2} value={f.seo_description} onChange={(e) => set("seo_description", e.target.value)} />
              </div>
            </div>
          </details>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <div>
            <label className={labelCls} style={{ color: "var(--ink-700)" }}>Category</label>
            <select className={inputCls} style={inputStyle} value={f.category}
              onChange={(e) => set("category", e.target.value as typeof f.category)}>
              {BLOG_CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls} style={{ color: "var(--ink-700)" }}>Board</label>
            <select className={inputCls} style={inputStyle} value={f.board}
              onChange={(e) => set("board", e.target.value as BlogBoard)}>
              {BOARDS.map((b) => <option key={b} value={b}>{b === "Both" ? "CBSE & ICSE" : b}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls} style={{ color: "var(--ink-700)" }}>Class levels</label>
            <div className="flex flex-wrap gap-1.5">
              {CLASSES.map((c) => {
                const on = f.class_levels.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("class_levels", on ? f.class_levels.filter((x) => x !== c) : [...f.class_levels, c])}
                    className="w-8 h-8 rounded-[var(--r-sm)] text-[12px] font-semibold border"
                    style={on
                      ? { background: "var(--cobalt-500)", color: "white", borderColor: "var(--cobalt-500)" }
                      : { borderColor: "var(--line-300)", color: "var(--ink-700)" }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--fg-subtle)" }}>Leave empty for &ldquo;all classes&rdquo;.</p>
          </div>

          <div>
            <label className={labelCls} style={{ color: "var(--ink-700)" }}>Tags</label>
            <input className={inputCls} style={inputStyle} value={f.tags} onChange={(e) => set("tags", e.target.value)}
              placeholder="IMO, class 6, mental maths" />
            <p className="text-[11px] mt-1" style={{ color: "var(--fg-subtle)" }}>Comma-separated.</p>
          </div>

          <div>
            <label className={labelCls} style={{ color: "var(--ink-700)" }}>Author name</label>
            <input className={inputCls} style={inputStyle} value={f.author_name} onChange={(e) => set("author_name", e.target.value)} />
          </div>

          <div>
            <label className={labelCls} style={{ color: "var(--ink-700)" }}>Cover image URL</label>
            <input className={inputCls} style={inputStyle} value={f.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)}
              placeholder="https://…" />
            <input className={`${inputCls} mt-2`} style={inputStyle} value={f.cover_image_alt} onChange={(e) => set("cover_image_alt", e.target.value)}
              placeholder="Image alt text" />
          </div>

          <label className="flex items-start gap-2 text-[13px] cursor-pointer" style={{ color: "var(--ink-700)" }}>
            <input type="checkbox" className="mt-0.5" checked={f.has_affiliate_links} onChange={(e) => set("has_affiliate_links", e.target.checked)} />
            <span>Contains affiliate links — show the Amazon disclosure &amp; price disclaimer on this post</span>
          </label>
        </aside>
      </div>
    </div>
  );
}
