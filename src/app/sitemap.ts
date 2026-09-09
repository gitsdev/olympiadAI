import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/slug";
import { BLOG_CATEGORIES, categorySlug } from "@/lib/blog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.olympiadiq.in";
const SUBJECTS = ["Mathematics", "Science", "English", "General Knowledge", "Cyber"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,                                   lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/login`,                               lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/signup`,                              lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/start`,                               lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/privacy`,                             lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${SITE_URL}/blog`,                                lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${SITE_URL}/blog/affiliate-disclosure`,           lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    ...BLOG_CATEGORIES.map((c): MetadataRoute.Sitemap[number] => ({
      url: `${SITE_URL}/blog/category/${categorySlug(c.name)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    })),
    { url: `${SITE_URL}/brain-booster`,                       lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
    { url: `${SITE_URL}/brain-booster/number-ninja`,          lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/brain-booster/memory-match`,          lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/brain-booster/pattern-blitz`,         lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/brain-booster/code-breaker`,          lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    ...SUBJECTS.map((s): MetadataRoute.Sitemap[number] => ({
      url: `${SITE_URL}/learn/subject/${slugify(s)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    })),
  ];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.from("topic_pages").select("slug");
  const topicEntries: MetadataRoute.Sitemap = (data ?? []).map((row) => ({
    url: `${SITE_URL}/learn/${row.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const { data: postRows } = await supabase
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("status", "published");
  const blogEntries: MetadataRoute.Sitemap = (postRows ?? []).map((row) => ({
    url: `${SITE_URL}/blog/${row.slug}`,
    lastModified: row.updated_at ? new Date(row.updated_at as string) : now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...topicEntries, ...blogEntries];
}
