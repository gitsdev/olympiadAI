"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { asBlogPosts, asBlogPost } from "@/lib/supabase/types-helper";
import { slugify } from "@/lib/slug";
import { readingMinutes } from "@/lib/blog";
import type { BlogBoard, BlogCategory, BlogStatus } from "@/types/database";

// Static child segments under /blog must never be shadowed by a post slug.
const RESERVED_SLUGS = new Set(["category", "affiliate-disclosure", "feed.xml", "feed", "rss.xml"]);

export interface BlogPostInput {
  id?: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url?: string;
  cover_image_alt?: string;
  category: BlogCategory;
  board: BlogBoard;
  class_levels: number[];
  tags: string[];
  author_name: string;
  seo_title?: string;
  seo_description?: string;
  has_affiliate_links: boolean;
  status: BlogStatus;
}

/** Throws (redirects to /login) unless the caller is a platform_admin. */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/blog");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile as { role?: string }).role !== "platform_admin") {
    redirect("/dashboard");
  }
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return (profile as { role?: string } | null)?.role === "platform_admin";
}

export async function listAllPosts() {
  await requireAdmin();
  const service = createServiceClient();
  const { data } = await service
    .from("blog_posts")
    .select("id, slug, title, category, status, reading_minutes, published_at, updated_at")
    .order("updated_at", { ascending: false });
  return asBlogPosts(data);
}

export async function getPostForEdit(id: string) {
  await requireAdmin();
  const service = createServiceClient();
  const { data } = await service.from("blog_posts").select("*").eq("id", id).maybeSingle();
  return asBlogPost(data);
}

async function uniqueSlug(service: ReturnType<typeof createServiceClient>, title: string, currentId?: string): Promise<string> {
  const base = slugify(title) || "post";
  let candidate = RESERVED_SLUGS.has(base) ? `${base}-post` : base;
  for (let i = 2; ; i++) {
    const { data } = await service.from("blog_posts").select("id").eq("slug", candidate).maybeSingle();
    const row = data as { id?: string } | null;
    if (!row || row.id === currentId) return candidate;
    candidate = `${base}-${i}`;
  }
}

export async function savePost(input: BlogPostInput): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const user = await requireAdmin();
  const service = createServiceClient();

  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (!input.excerpt.trim()) return { ok: false, error: "Excerpt is required." };
  if (!input.content.trim()) return { ok: false, error: "Content is required." };

  // Slug comes from the title, but freezes once a post is first published so
  // shared/indexed URLs don't break when the title is later tweaked.
  type ExistingRow = { published_at: string | null; status: BlogStatus; slug: string };
  let existing: ExistingRow | null = null;
  if (input.id) {
    const { data } = await service
      .from("blog_posts")
      .select("published_at, status, slug")
      .eq("id", input.id)
      .single();
    existing = (data as ExistingRow | null) ?? null;
  }
  const slug =
    existing && existing.published_at
      ? existing.slug
      : await uniqueSlug(service, input.title, input.id);

  const fields = {
    slug,
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    content: input.content,
    cover_image_url: input.cover_image_url?.trim() || null,
    cover_image_alt: input.cover_image_alt?.trim() || null,
    category: input.category,
    board: input.board,
    class_levels: input.class_levels,
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    author_name: input.author_name.trim() || "OlympiadIQ Team",
    seo_title: input.seo_title?.trim() || null,
    seo_description: input.seo_description?.trim() || null,
    has_affiliate_links: input.has_affiliate_links,
    status: input.status,
    reading_minutes: readingMinutes(input.content),
  };

  if (input.id) {
    // Only stamp published_at the first time a post goes live.
    const published_at =
      input.status === "published"
        ? existing?.published_at ?? new Date().toISOString()
        : existing?.published_at ?? null;

    const { error } = await service.from("blog_posts").update({ ...fields, published_at }).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await service.from("blog_posts").insert({
      ...fields,
      published_at: input.status === "published" ? new Date().toISOString() : null,
      created_by: user.id,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/blog", "layout");
  revalidatePath("/sitemap.xml");
  return { ok: true, slug };
}

export async function deletePost(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const service = createServiceClient();
  const { error } = await service.from("blog_posts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/blog", "layout");
  revalidatePath("/sitemap.xml");
  return { ok: true };
}
