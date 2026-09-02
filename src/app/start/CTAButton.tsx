"use client";

/* ============================================================================
 * <CTAButton /> — the ONE call-to-action component used everywhere on /start.
 * ----------------------------------------------------------------------------
 *  • Renders a Next <Link> styled with the shared <OAButton> design-system btn.
 *  • Points at SIGNUP_URL (see landing-content.ts) — change the destination
 *    in ONE place there.
 *  • Fires an analytics event on click (see analytics.ts). Pass `event=` with
 *    one of the names from EVENTS in landing-content.ts.
 * ==========================================================================*/

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { OAButton, type OAButtonProps } from "@/components/ui";
import { SIGNUP_URL, EVENTS } from "./landing-content";
import { track } from "./analytics";

interface CTAButtonProps {
  /** Button label */
  children: React.ReactNode;
  /** Analytics event name — e.g. EVENTS.heroPrimary */
  event: string;
  /** Extra params sent with the analytics event */
  eventParams?: Record<string, string | number | boolean>;
  variant?: OAButtonProps["variant"];
  size?: OAButtonProps["size"];
  /** Show the trailing arrow icon (default true) */
  arrow?: boolean;
  className?: string;
  /** Full-width on mobile */
  block?: boolean;
}

export function CTAButton({
  children,
  event,
  eventParams,
  variant = "primary",
  size = "lg",
  arrow = true,
  className,
  block,
}: CTAButtonProps) {
  const onClick = () => {
    // Specific event (hero_cta_click, final_cta_click, …)
    track(event, { location: event, ...eventParams });
    // Generic conversion-intent event fired for every CTA
    track(EVENTS.signupClick, { source: event, ...eventParams });
  };

  return (
    <Link
      href={SIGNUP_URL}
      onClick={onClick}
      className={block ? "block w-full sm:w-auto" : "inline-block"}
      prefetch={false}
    >
      <OAButton
        variant={variant}
        size={size}
        className={`${block ? "w-full sm:w-auto" : ""} ${className ?? ""}`}
      >
        {children}
        {arrow && <ArrowRight aria-hidden />}
      </OAButton>
    </Link>
  );
}
