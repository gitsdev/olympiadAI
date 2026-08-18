import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.olympiadiq.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`,                                   lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/login`,                               lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/signup`,                              lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/brain-booster`,                       lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
    { url: `${SITE_URL}/brain-booster/number-ninja`,          lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/brain-booster/memory-match`,          lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/brain-booster/pattern-blitz`,         lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
