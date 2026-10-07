import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // SEO Agent featured-image uploads are capped at 5 MB in code
      // (src/lib/seo-agent/publishing/publisher.ts); this leaves room for form overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
