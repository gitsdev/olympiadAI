import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.olympiadiq.in";
const SUBJECTS = ["Mathematics", "Science", "English", "General Knowledge", "Cyber"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,                                   lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/login`,                               lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/signup`,                              lastModified: now, changeFrequency: "monthly", priority: 0.5 },
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

  return [...staticEntries, ...topicEntries];
}
