/* ============================================================================
 * OlympiadIQ — Facebook/Instagram Ad landing page  (route: /start)
 * ----------------------------------------------------------------------------
 * ALL editable copy for the landing page lives in this one file.
 * Change text here — you should almost never need to touch Landing.tsx.
 *
 * ⚠️  DO NOT invent stats, testimonials, ranks or claims. Anything marked
 *     [PLACEHOLDER …] must be replaced with something real (or deleted)
 *     before the ad goes live.
 * ==========================================================================*/

/* ---------------------------------------------------------------------------
 * 1. CTA DESTINATION
 * ---------------------------------------------------------------------------
 * Every call-to-action button on the page points here. To send traffic to a
 * different page (e.g. the onboarding wizard at "/onboarding"), change this
 * single value.
 * ------------------------------------------------------------------------- */
export const SIGNUP_URL = "/signup";

/* ---------------------------------------------------------------------------
 * 2. ANALYTICS EVENT NAMES
 * ---------------------------------------------------------------------------
 * Each CTA fires one of these event names through src/app/start/analytics.ts.
 * Add / rename events freely — they are passed straight to gtag / fbq / GTM.
 * ------------------------------------------------------------------------- */
export const EVENTS = {
  heroPrimary:   "hero_cta_click",
  heroSecondary: "hero_explore_click",
  midPage:       "midpage_cta_click",
  finalCta:      "final_cta_click",
  stickyMobile:  "sticky_cta_click",
  header:        "header_cta_click",
  // Generic name attached to *every* CTA in addition to the specific one above:
  signupClick:   "signup_click",
} as const;

/* ---------------------------------------------------------------------------
 * 3. SEO / SOCIAL METADATA  (consumed by page.tsx)
 * ------------------------------------------------------------------------- */
export const META = {
  title: "Olympiad IQ – Smarter Learning. Bigger Challenges.",
  description:
    "Olympiad IQ helps school students (CBSE & ICSE, Classes 1–10) build strong Maths, Science and Reasoning foundations through engaging practice, quizzes, challenges and brain-boosting games. Free to start.",
  // Absolute canonical is resolved against metadataBase in page.tsx
  canonicalPath: "/start",
  ogImagePath: "/assets/og/start.png", // ← provide this image (see notes at bottom)
};

/* ---------------------------------------------------------------------------
 * 4. HERO
 * ------------------------------------------------------------------------- */
export const HERO = {
  badge: "Learn · Practice · Challenge · Grow",
  headline: "Give Your Child the IQ Advantage.",
  subhead:
    "Make learning smarter, practice more engaging, and every challenge an opportunity to grow.",
  paragraph:
    "Olympiad IQ helps school students build strong foundations in Mathematics, Science, Logical Reasoning and more — through engaging practice, challenges, quizzes and brain-boosting activities.",
  primaryCta: "Start Learning",
  secondaryCta: "Explore Olympiad IQ",
  // Small reassurance line under the buttons
  reassurance: "Free to start · CBSE & ICSE · Classes 1–10",
  // Floating decorative chips in the hero illustration
  floatChips: ["+ Challenge complete", "Logic streak · 3 days", "New badge unlocked"],
};

/* ---------------------------------------------------------------------------
 * 5. QUICK FACTS STRIP  (animated counters — keep these FACTUAL, not claims)
 * ------------------------------------------------------------------------- */
export const FACTS = [
  { value: 5,  suffix: "",  label: "Core subjects" },
  { value: 10, suffix: "",  label: "Classes covered (1–10)" },
  { value: 4,  suffix: "",  label: "Brain-booster games" },
  { value: 0,  prefix: "₹", label: "Cost to start" },
];

/* ---------------------------------------------------------------------------
 * 6. SECTION 2 — THE PROBLEM
 * ------------------------------------------------------------------------- */
export const PROBLEM = {
  eyebrow: "Why it matters",
  title: "Is Your Child Ready for the Next Challenge?",
  cards: [
    {
      icon: "brain",
      title: "Memorisation isn't enough",
      body: "Children need to understand concepts and apply them — not just recall facts.",
    },
    {
      icon: "sparkles",
      title: "Practice needs to be engaging",
      body: "Traditional worksheets get boring fast, and boredom kills consistency.",
    },
    {
      icon: "target",
      title: "Competitive exams reward thinking",
      body: "Olympiads test reasoning, accuracy and problem-solving — not speed-writing.",
    },
    {
      icon: "trophy",
      title: "Every child needs a challenge",
      body: "Regular, right-sized challenges build confidence and genuine curiosity.",
    },
  ],
};

/* ---------------------------------------------------------------------------
 * 7. SECTION 3 — THE OLYMPIAD IQ DIFFERENCE (feature cards)
 * ---------------------------------------------------------------------------
 * Every card below maps to something that exists in the product today. If a
 * feature changes, edit or delete the card — nothing else depends on it.
 * ------------------------------------------------------------------------- */
export const FEATURES = {
  eyebrow: "The Olympiad IQ difference",
  title: "Learning That Feels Like a Challenge, Not a Chore.",
  sub: "One platform to learn a concept, practise it, and prove you've mastered it.",
  cards: [
    { emoji: "🧠", title: "Think Smarter",        body: "Build logical reasoning and problem-solving through Olympiad-style questions." },
    { emoji: "🎯", title: "Practice with Purpose", body: "Unlimited practice questions designed to strengthen concepts, not just fill time." },
    { emoji: "🏆", title: "Challenge Yourself",    body: "Adaptive mock tests that adjust to your child's level and turn learning into a challenge." },
    { emoji: "📊", title: "Track Progress",        body: "A readiness score and weak-area insights so parents and students always know where they stand." },
    { emoji: "⚡", title: "Brain-Booster Games",   body: "Short, playful games — Number Ninja, Memory Match & more — that sharpen focus and speed. Free, no login." },
    { emoji: "📚", title: "Olympiad Preparation",  body: "Aligned to CBSE & ICSE syllabus for Classes 1–10 across Maths, Science, English, GK and Cyber." },
  ],
};

/* ---------------------------------------------------------------------------
 * 8. SECTION 4 — "MORE THAN MARKS" interactive skill selector
 * ------------------------------------------------------------------------- */
export const SKILLS = {
  eyebrow: "More than marks",
  title: "What Can Your Child Develop?",
  sub: "Tap a skill to see how Olympiad IQ helps build it.",
  items: [
    { key: "logic",       label: "Logical Thinking",      body: "Spot patterns, follow reasoning step by step, and reach sound conclusions." },
    { key: "problem",     label: "Problem Solving",       body: "Learn to break complex questions into smaller, manageable steps." },
    { key: "maths",       label: "Mathematical Thinking", body: "Move from rote formulas to genuinely understanding how and why maths works." },
    { key: "focus",       label: "Concentration",         body: "Timed challenges and quick games train the ability to focus under pressure." },
    { key: "accuracy",    label: "Accuracy",              body: "Practise reading carefully and checking work — the habits that win Olympiads." },
    { key: "critical",    label: "Critical Thinking",     body: "Question assumptions, compare options, and justify the answer chosen." },
    { key: "confidence",  label: "Confidence",            body: "Small wins add up. Progress your child can see builds real self-belief." },
    { key: "curiosity",   label: "Curiosity",             body: "Playful challenges make your child want to find out what comes next." },
  ],
};

/* ---------------------------------------------------------------------------
 * 9. SECTION 5 — HOW IT WORKS
 * ------------------------------------------------------------------------- */
export const HOW = {
  eyebrow: "How it works",
  title: "Up and Running in Minutes.",
  steps: [
    { n: 1, title: "Sign Up",          body: "Create your child's Olympiad IQ account — free." },
    { n: 2, title: "Choose & Explore", body: "Pick the board, class and subjects that matter." },
    { n: 3, title: "Practice & Challenge", body: "Solve questions, take quizzes and challenge yourself." },
    { n: 4, title: "Learn & Grow",     body: "See strengths, fix weak areas and keep progressing." },
  ],
};

/* ---------------------------------------------------------------------------
 * 10. SECTION 6 — "A DAY WITH OLYMPIAD IQ" demo dashboard
 * ---------------------------------------------------------------------------
 * ⚠️  This is an ILLUSTRATIVE demo of the interface — NOT real user data.
 *     The "Demo" label on the card must stay.
 * ------------------------------------------------------------------------- */
export const DEMO = {
  eyebrow: "A day with Olympiad IQ",
  title: "A Peek Inside the Experience.",
  sub: "An illustration of what a learning session looks like — not real student data.",
  challengeSubject: "Mathematics",
  challengeProgressText: "Question 7 / 10",
  challengePercent: 70,
  items: [
    { emoji: "✓",  text: "6 questions solved" },
    { emoji: "🔥", text: "3-day learning streak" },
    { emoji: "🧠", text: "Logical challenge completed" },
    { emoji: "🏆", text: "New achievement unlocked" },
  ],
};

/* ---------------------------------------------------------------------------
 * 11. SECTION 7 — PARENT BENEFITS
 * ------------------------------------------------------------------------- */
export const PARENTS = {
  eyebrow: "For parents",
  title: "Why Parents Choose Olympiad IQ",
  items: [
    "Builds stronger thinking skills, not just exam tricks",
    "Encourages regular, consistent practice",
    "Makes learning something your child actually wants to do",
    "Supports Olympiad and competitive-exam preparation",
    "Highlights exactly which areas need more work",
    "Turns screen time into productive learning time",
  ],
};

/* ---------------------------------------------------------------------------
 * 12. SECTION 8 — CHILD EXPERIENCE
 * ------------------------------------------------------------------------- */
export const KIDS = {
  eyebrow: "For kids",
  title: "For Kids, It's a Challenge. For Parents, It's Progress.",
  cards: [
    { emoji: "🧩", label: "Solve" },
    { emoji: "🎯", label: "Challenge" },
    { emoji: "⚡", label: "Play" },
    { emoji: "🏆", label: "Achieve" },
    { emoji: "🧠", label: "Think" },
    { emoji: "🚀", label: "Grow" },
  ],
};

/* ---------------------------------------------------------------------------
 * 13. SECTION 9 — SOCIAL PROOF
 * ---------------------------------------------------------------------------
 * ⚠️  NO fabricated testimonials, ratings or student counts. Replace each
 *     [PLACEHOLDER] with a REAL quote (with permission) or delete the card.
 *     If you have none yet, set `SOCIAL_PROOF.show = false` to hide the
 *     whole section.
 * ------------------------------------------------------------------------- */
export const SOCIAL_PROOF = {
  show: true,
  eyebrow: "Parents & students",
  title: "What Families Are Saying",
  // Factual trust signals (safe to show — these are true statements about the product)
  trustSignals: [
    "Aligned to CBSE & ICSE",
    "Classes 1–10",
    "Free to start",
    "Brain-Booster games — no login needed",
  ],
  testimonials: [
    { quote: "[PLACEHOLDER — add a real parent testimonial here]", name: "[Parent name]", meta: "[City]" },
    { quote: "[PLACEHOLDER — add a real parent or student testimonial here]", name: "[Name]", meta: "[Class / City]" },
    { quote: "[PLACEHOLDER — add a real testimonial here]", name: "[Name]", meta: "[City]" },
  ],
};

/* ---------------------------------------------------------------------------
 * 14. SECTION 10 — FAQ
 * ---------------------------------------------------------------------------
 * ⚠️  Review every answer against the live product before running ads.
 *     Anything you're unsure about is marked [VERIFY].
 * ------------------------------------------------------------------------- */
export const FAQ = {
  eyebrow: "Questions",
  title: "Parents Ask, We Answer",
  items: [
    {
      q: "What is Olympiad IQ?",
      a: "An online learning platform for school students that combines concept learning, unlimited practice, adaptive mock tests and brain-boosting games — built to strengthen Maths, Science and reasoning skills.",
    },
    {
      q: "Which classes are supported?",
      a: "Classes 1 to 10, for both CBSE and ICSE boards.",
    },
    {
      q: "Which subjects can my child practise?",
      a: "Mathematics, Science, English, General Knowledge and Cyber.",
    },
    {
      q: "Is Olympiad IQ suitable for beginners?",
      a: "Yes. Practice and mock tests adapt to your child's current level, so they can start from wherever they are and build up.",
    },
    {
      q: "How does my child get started?",
      a: "Create a free account, choose your board, class and subjects, and start practising right away.",
    },
    {
      q: "Is Olympiad IQ useful for Olympiad preparation?",
      a: "It's designed to build the reasoning, accuracy and problem-solving skills that competitive exams and Olympiads test. [VERIFY the exact exams / question styles you want to reference.]",
    },
    {
      q: "Can parents track progress?",
      a: "Yes — a readiness score and weak-area insights show how your child is progressing and where to focus next. [VERIFY the current parent-facing reporting.]",
    },
  ],
};

/* ---------------------------------------------------------------------------
 * 15. SECTION 11 — FINAL CTA
 * ------------------------------------------------------------------------- */
export const FINAL = {
  title: "Your Child's Next Challenge Starts Here.",
  sub: "Turn curiosity into confidence. Turn practice into progress.",
  cta: "Start Your Child's Journey",
  footnote: "Create an account and explore Olympiad IQ.",
};

/* ---------------------------------------------------------------------------
 * 16. STICKY MOBILE CTA
 * ------------------------------------------------------------------------- */
export const STICKY = {
  label: "Start Learning",
};

/* ============================================================================
 * ASSETS YOU NEED TO PROVIDE
 * ----------------------------------------------------------------------------
 *  • public/assets/og/start.png   — 1200×630 social share image (see META).
 *    Until it exists, social shares fall back to text-only cards (harmless).
 *
 * The page ships with NO photographic images — all illustration is CSS +
 * emoji + inline SVG, so it stays fast on mobile. If you want a real hero
 * illustration later, drop it in public/assets/ and wire it into the Hero
 * block in Landing.tsx.
 * ==========================================================================*/
