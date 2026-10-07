// Reusable CTA components (spec §16). One definition per CTA, used by the
// editor card, preview, version views and (Phase 6) publishing. Pure +
// client-safe. Copy only describes features the brand profile lists.

import { CTA_TYPES, type CtaType } from "./constants";
import { CTA_DESTINATIONS } from "./site-pages";

export interface CtaCopy {
  headline: string;
  body: string;
  button: string;
}

export const CTA_COPY: Record<CtaType, CtaCopy> = {
  MOCK_TEST: {
    headline: "Practise with free Olympiad mock tests",
    body: "Try OlympiadIQ's Free Unlimited Mock Tests and find out which topics need more practice.",
    button: "Start a free mock test",
  },
  AI_TUTOR: {
    headline: "Stuck on a question? Ask the AI Tutor",
    body: "OlympiadIQ's AI Tutor helps you work through tricky Olympiad questions at your own pace.",
    button: "Try the AI Tutor",
  },
  BATTLE: {
    headline: "Make practice a game: Battle with Friends",
    body: "Challenge your friends to Olympiad quiz battles on OlympiadIQ.",
    button: "Start a battle",
  },
  BRAIN_BOOSTER: {
    headline: "Warm up with Brain Booster Games",
    body: "Free games for mental maths, memory, patterns and logic. No sign-up needed.",
    button: "Play Brain Booster Games",
  },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Static card markup for a CTA (only constant copy and paths; nothing user-supplied). */
export function ctaCardHtml(type: CtaType): string {
  const c = CTA_COPY[type];
  const d = CTA_DESTINATIONS[type];
  return `<aside class="seo-cta-card" data-cta-card="${type}"><p class="seo-cta-headline">${esc(c.headline)}</p>`
    + `<p class="seo-cta-body">${esc(c.body)}</p><a class="seo-cta-button" href="${esc(d.path)}">${esc(c.button)}</a></aside>`;
}

/** Replaces stored CTA placeholders (<div data-cta="TYPE"></div>) with cards, for previews. */
export function withCtaCards(sanitizedHtml: string): string {
  return sanitizedHtml.replace(/<div data-cta="([A-Z_]+)"><\/div>/g, (m, t: string) =>
    (CTA_TYPES as readonly string[]).includes(t) ? ctaCardHtml(t as CtaType) : "");
}
