"use client";

import { useEffect } from "react";
import { ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE_SECONDS, type SignupAttribution } from "@/lib/attribution";

function clip(value: string | null): string | undefined {
  return value ? value.slice(0, 200) : undefined;
}

// First-touch: records how the visitor arrived on their first page view only,
// so a later return visit can't overwrite the original acquisition source.
export function AttributionCapture() {
  useEffect(() => {
    try {
      if (document.cookie.split("; ").some((c) => c.startsWith(`${ATTRIBUTION_COOKIE}=`))) return;

      const params = new URLSearchParams(window.location.search);
      let referrerHost: string | undefined;
      try {
        if (document.referrer) referrerHost = new URL(document.referrer).hostname;
      } catch {
        referrerHost = undefined;
      }

      const attribution: SignupAttribution = {
        utm_source: clip(params.get("utm_source")),
        utm_medium: clip(params.get("utm_medium")),
        utm_campaign: clip(params.get("utm_campaign")),
        gclid: params.has("gclid") || undefined,
        fbclid: params.has("fbclid") || undefined,
        referrer_host: referrerHost,
        landing_path: window.location.pathname,
        captured_at: new Date().toISOString(),
      };

      document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(attribution))}; path=/; max-age=${ATTRIBUTION_MAX_AGE_SECONDS}; samesite=lax`;
    } catch {
      // Attribution is best-effort; never let it affect the page.
    }
  }, []);

  return null;
}
