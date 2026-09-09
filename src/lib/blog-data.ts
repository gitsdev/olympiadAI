import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { asBlogPosts, asBlogPost } from "@/lib/supabase/types-helper";

// Server-only blog data access. RLS on `blog_posts` restricts anonymous reads
// to rows where status = 'published', so the anon key is safe here.

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const LIST_FIELDS =
  "slug, title, excerpt, cover_image_url, cover_image_alt, category, board, class_levels, tags, author_name, reading_minutes, published_at";

export const getPublishedPosts = cache(async () => {
  const { data } = await publicClient()
    .from("blog_posts")
    .select(LIST_FIELDS)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return asBlogPosts(data);
});

export const getPostBySlug = cache(async (slug: string) => {
  const { data } = await publicClient()
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return asBlogPost(data);
});

export const getRelatedPosts = cache(async (category: string, excludeSlug: string) => {
  const { data } = await publicClient()
    .from("blog_posts")
    .select(LIST_FIELDS)
    .eq("status", "published")
    .eq("category", category)
    .neq("slug", excludeSlug)
    .order("published_at", { ascending: false })
    .limit(3);
  return asBlogPosts(data);
});
