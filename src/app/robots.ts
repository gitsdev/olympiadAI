import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.olympiadai.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Logged-in app screens — nothing to index, and most redirect
        // unauthenticated crawlers straight to /login anyway.
        disallow: [
          "/dashboard", "/tutor", "/practice", "/results", "/settings",
          "/learn", "/tests", "/achievements", "/onboarding", "/parent",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
