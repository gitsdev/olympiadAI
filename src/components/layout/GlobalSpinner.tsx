"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// Shows a centred spinner after the user clicks a link or button, until the
// work it started is done:
//  - internal links: until the route (pathname + query) changes
//  - buttons: until every fetch started by the click has settled (this covers
//    server actions, API calls, Supabase calls and router.push after them)
// Opt an element (or a whole subtree) out with the `data-no-spinner` attribute.

const SHOW_DELAY_MS = 250; // don't flash the spinner for quick actions
const ARM_WINDOW_MS = 500; // fetches starting this soon after a click belong to it
const CHAIN_WINDOW_MS = 300; // follow-up fetches (e.g. router.push after a save)
const NAV_TIMEOUT_MS = 15_000; // safety net if a navigation never lands

// Real-time screens manage their own loading UI; a blocking overlay there
// would get in the way of chat replies and timed answers.
const NO_FETCH_TRACKING_PREFIXES = ["/tutor", "/battle"];

let armedUntil = 0;
let inflight = 0;
let navigating = false;
let navTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getBusy() {
  return navigating || inflight > 0;
}

function setNavigating(value: boolean) {
  clearTimeout(navTimer);
  navigating = value;
  if (value) navTimer = setTimeout(() => setNavigating(false), NAV_TIMEOUT_MS);
  emit();
}

function trackingDisabledHere() {
  const path = window.location.pathname;
  return NO_FETCH_TRACKING_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function handleClick(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target as Element | null;
  const el = target?.closest?.("a[href], button, input[type='submit'], [role='button']");
  if (!el || el.closest("[data-no-spinner]")) return;

  if (el instanceof HTMLAnchorElement) {
    if ((el.target && el.target !== "_self") || el.hasAttribute("download")) return;
    let url: URL;
    try {
      url = new URL(el.href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    const here = window.location;
    // Same page (or just a #hash jump): nothing to wait for.
    if (url.pathname === here.pathname && url.search === here.search) return;
    setNavigating(true);
    return;
  }

  if (el.matches(":disabled") || el.getAttribute("aria-disabled") === "true") return;
  if (trackingDisabledHere()) return;
  armedUntil = Date.now() + ARM_WINDOW_MS;
}

function patchFetch() {
  const original = window.fetch;
  window.fetch = function trackedFetch(...args: Parameters<typeof fetch>) {
    if (Date.now() > armedUntil) return original.apply(this, args);
    inflight++;
    emit();
    return original.apply(this, args).finally(() => {
      inflight--;
      armedUntil = Math.max(armedUntil, Date.now() + CHAIN_WINDOW_MS);
      emit();
    });
  };
  return () => {
    window.fetch = original;
  };
}

// Ends the navigation spinner once the new route has rendered.
function RouteChangeListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    setNavigating(false);
  }, [pathname, searchParams]);
  return null;
}

export function GlobalSpinner() {
  const busy = useSyncExternalStore(subscribe, getBusy, () => false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unpatch = patchFetch();
    document.addEventListener("click", handleClick, true);
    // Back/forward and bfcache restores shouldn't leave a spinner stuck on.
    const reset = () => setNavigating(false);
    window.addEventListener("pageshow", reset);
    return () => {
      unpatch();
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("pageshow", reset);
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => {
      clearTimeout(t);
      setVisible(false);
    };
  }, [busy]);

  return (
    <>
      <Suspense fallback={null}>
        <RouteChangeListener />
      </Suspense>
      {busy && visible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "color-mix(in oklch, var(--paper) 55%, transparent)" }}
        >
          <div
            className="flex items-center justify-center rounded-2xl p-4 shadow-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--line-200)" }}
          >
            <Loader2 size={36} className="animate-spin" style={{ color: "var(--brand)" }} />
          </div>
          <span className="sr-only">Loading…</span>
        </div>
      )}
    </>
  );
}
