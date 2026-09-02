/* ============================================================================
 * Landing-page analytics shim
 * ----------------------------------------------------------------------------
 * One function, `track()`, fired by every CTA on /start. It forwards the event
 * to whatever tag managers happen to be present on the page — none are required
 * and no IDs are hard-coded here.
 *
 * ── HOW TO ADD META PIXEL ──────────────────────────────────────────────────
 *   1. Add the Meta Pixel base snippet (with YOUR pixel ID) to
 *      src/app/layout.tsx via next/script, OR through Google Tag Manager.
 *   2. That's it — the calls below to `window.fbq(...)` will start working.
 *      To map a landing event to a standard Pixel event (e.g. "Lead"), edit
 *      the `fbq` line below.
 *
 * ── HOW TO ADD GOOGLE ANALYTICS EVENTS ─────────────────────────────────────
 *   GA is already loaded in src/app/layout.tsx via @next/third-parties when
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID is set. The `window.gtag(...)` call below
 *   will send these events automatically — nothing else to do.
 *
 * ── HOW TO ADD GOOGLE TAG MANAGER ──────────────────────────────────────────
 *   Install GTM in layout.tsx. The `window.dataLayer.push(...)` call below
 *   feeds every event into GTM as `event: "<name>"` with the params.
 * ==========================================================================*/

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function track(event: string, params: Params = {}) {
  if (typeof window === "undefined") return;

  // Google Analytics 4 (loaded via @next/third-parties in layout.tsx)
  try {
    window.gtag?.("event", event, params);
  } catch {
    /* no-op */
  }

  // Meta / Facebook Pixel — fires a custom event. Change to
  // window.fbq("track", "Lead", params) to use a standard event instead.
  try {
    window.fbq?.("trackCustom", event, params);
  } catch {
    /* no-op */
  }

  // Google Tag Manager
  try {
    window.dataLayer?.push({ event, ...params });
  } catch {
    /* no-op */
  }
}
