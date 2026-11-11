import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Question Paper Solver PDF export: the Chromium binary ships inside
  // @sparticuz/chromium and must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  experimental: {
    serverActions: {
      // SEO Agent featured-image uploads are capped at 5 MB in code
      // (src/lib/seo-agent/publishing/publisher.ts); this leaves room for form overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
