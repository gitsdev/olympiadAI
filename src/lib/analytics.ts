"use client";

/**
 * Student-app-scoped analytics — distinct from src/app/start/analytics.ts
 * (a marketing-landing-page-only GA/Meta Pixel shim). Reuses the GA4 tag
 * already loaded app-wide via <GoogleAnalytics> in src/app/layout.tsx
 * (@next/third-parties, gated on NEXT_PUBLIC_GA_MEASUREMENT_ID).
 */
type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params: Params = {}) {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, params);
  } catch {
    /* no-op */
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug("[analytics]", event, params);
  }
}
