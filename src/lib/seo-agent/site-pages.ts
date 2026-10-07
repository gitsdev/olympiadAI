// OlympiadIQ pages the SEO Agent may link to or use as CTA destinations.
// Pure + client-safe. Only list pages that really exist and that a
// logged-out visitor from Google can open.

import type { CtaType } from "./constants";

/**
 * Where each CTA sends a reader. Mock tests, AI Tutor and Battle are behind
 * login, and /login has no "return to" support, so new visitors go to
 * /signup (the same target as the /start landing page).
 */
export const CTA_DESTINATIONS: Record<CtaType, { path: string; label: string; description: string }> = {
  MOCK_TEST: { path: "/signup", label: "Free Unlimited Mock Tests", description: "Olympiad-style mock tests with instant results" },
  AI_TUTOR: { path: "/signup", label: "AI Tutor", description: "Step-by-step help from OlympiadIQ's AI Tutor" },
  BATTLE: { path: "/signup", label: "Battle with Friends", description: "Live quiz battles against friends" },
  BRAIN_BOOSTER: { path: "/brain-booster", label: "Brain Booster Games", description: "Free brain-training games, no sign-up needed" },
};

export interface LinkCandidate {
  url: string; // site-relative path
  title: string;
  kind: "BLOG_POST" | "FEATURE_PAGE" | "TOPIC_PAGE";
  summary?: string;
}

/** Public feature pages that exist today (see src/app/sitemap.ts). */
export const STATIC_LINK_CANDIDATES: LinkCandidate[] = [
  { url: "/brain-booster", title: "Brain Booster Games", kind: "FEATURE_PAGE", summary: "Free brain-training games for students" },
  { url: "/brain-booster/number-ninja", title: "Number Ninja (Brain Booster game)", kind: "FEATURE_PAGE", summary: "Mental maths speed game" },
  { url: "/brain-booster/memory-match", title: "Memory Match (Brain Booster game)", kind: "FEATURE_PAGE", summary: "Memory training game" },
  { url: "/brain-booster/pattern-blitz", title: "Pattern Blitz (Brain Booster game)", kind: "FEATURE_PAGE", summary: "Pattern-recognition / reasoning game" },
  { url: "/brain-booster/code-breaker", title: "Code Breaker (Brain Booster game)", kind: "FEATURE_PAGE", summary: "Logic and coding-style puzzle game" },
  { url: "/learn/subject/mathematics", title: "Mathematics topics", kind: "FEATURE_PAGE", summary: "Free maths topic pages by class" },
  { url: "/learn/subject/science", title: "Science topics", kind: "FEATURE_PAGE", summary: "Free science topic pages by class" },
  { url: "/learn/subject/english", title: "English topics", kind: "FEATURE_PAGE", summary: "Free English topic pages by class" },
  { url: "/learn/subject/general-knowledge", title: "General Knowledge topics", kind: "FEATURE_PAGE", summary: "Free GK topic pages by class" },
  { url: "/learn/subject/cyber", title: "Cyber topics", kind: "FEATURE_PAGE", summary: "Free cyber/computer topic pages by class" },
];
