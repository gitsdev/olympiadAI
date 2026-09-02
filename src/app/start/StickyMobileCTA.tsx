"use client";

/* ============================================================================
 * Mobile-only sticky bottom CTA.
 *  • Hidden on md+ screens.
 *  • Appears after the user scrolls past the hero, hides again near the very
 *    bottom so it never covers the final CTA / footer.
 *  • Respects the iOS/Android safe-area inset.
 * ==========================================================================*/

import * as React from "react";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { SIGNUP_URL, EVENTS, STICKY } from "./landing-content";
import { track } from "./analytics";

export function StickyMobileCTA() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const nearBottom =
        window.innerHeight + y >= document.documentElement.scrollHeight - 680;
      setVisible(y > 520 && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-40 px-4 pt-2.5"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        background:
          "linear-gradient(to top, var(--paper) 62%, transparent)",
        transform: visible ? "translateY(0)" : "translateY(140%)",
        transition: "transform 320ms var(--ease-out)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <Link
        href={SIGNUP_URL}
        prefetch={false}
        onClick={() => {
          track(EVENTS.stickyMobile, { location: EVENTS.stickyMobile });
          track(EVENTS.signupClick, { source: EVENTS.stickyMobile });
        }}
        className="flex items-center justify-center gap-2 w-full h-[52px] rounded-[var(--r-lg)] font-bold text-[16px] text-white shadow-[var(--shadow-brand)]"
        style={{ background: "var(--cobalt-500)" }}
      >
        <Rocket size={18} aria-hidden />
        {STICKY.label}
      </Link>
    </div>
  );
}
