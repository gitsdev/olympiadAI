import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.olympiadiq.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Logged-in app screens — nothing to index, and most redirect
        // unauthenticated crawlers straight to /login anyway. "/learn$" is
        // an exact-match block (Google/Bing support the $ anchor) so the
        // authenticated /learn dashboard stays blocked while the public
        // /learn/[slug] topic pages remain crawlable.
        disallow: [
          "/dashboard", "/tutor", "/practice", "/results", "/settings",
          "/learn$", "/tests", "/achievements", "/onboarding", "/parent",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
