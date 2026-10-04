// OlympiadIQ — SEO keyword plan + competitor benchmark.
//
// Hand-curated snapshot, NOT live data. Volumes, difficulty, SEO scores and
// visibility are estimates for prioritisation. To refresh, paste numbers from a
// Semrush / Ahrefs / Google Search Console export into the arrays below and bump
// SEO_DATA_AS_OF. Keep the shapes stable so /admin/seo keeps rendering.

export const SEO_DATA_AS_OF = "2026-10-04";

export type KeywordCluster =
  | "Olympiad exams"
  | "Mock tests & papers"
  | "Class-wise"
  | "Preparation"
  | "Board & syllabus"
  | "AI & product"
  | "Books (affiliate)"
  | "Brain games";

export type KeywordIntent = "informational" | "commercial" | "transactional" | "navigational";
export type Difficulty = "low" | "medium" | "high";
export type Priority = "P1" | "P2" | "P3";
export type VolumeBand = "<1K" | "1K–10K" | "10K–100K" | "100K+";

export interface SeoKeyword {
  keyword: string;
  cluster: KeywordCluster;
  intent: KeywordIntent;
  volume: VolumeBand;   // est. monthly searches, India
  difficulty: Difficulty;
  priority: Priority;
  targetPage: string;   // our URL that should rank for it
}

export const KEYWORD_CLUSTERS: KeywordCluster[] = [
  "Olympiad exams",
  "Mock tests & papers",
  "Class-wise",
  "Preparation",
  "Board & syllabus",
  "AI & product",
  "Books (affiliate)",
  "Brain games",
];

const k = (
  keyword: string,
  cluster: KeywordCluster,
  intent: KeywordIntent,
  volume: VolumeBand,
  difficulty: Difficulty,
  priority: Priority,
  targetPage: string,
): SeoKeyword => ({ keyword, cluster, intent, volume, difficulty, priority, targetPage });

export const SEO_KEYWORDS: SeoKeyword[] = [
  // Olympiad exams — head terms, dominated by SOF / Silverzone
  k("olympiad exam", "Olympiad exams", "informational", "100K+", "high", "P2", "/"),
  k("imo olympiad", "Olympiad exams", "informational", "10K–100K", "high", "P1", "/learn/subject/mathematics"),
  k("nso olympiad", "Olympiad exams", "informational", "10K–100K", "high", "P1", "/learn/subject/science"),
  k("ieo olympiad", "Olympiad exams", "informational", "10K–100K", "high", "P2", "/learn/subject/english"),
  k("igko olympiad", "Olympiad exams", "informational", "1K–10K", "medium", "P2", "/learn/subject/general-knowledge"),
  k("nco cyber olympiad", "Olympiad exams", "informational", "1K–10K", "medium", "P2", "/learn/subject/cyber"),
  k("sof olympiad", "Olympiad exams", "navigational", "100K+", "high", "P3", "/blog"),
  k("silverzone olympiad", "Olympiad exams", "navigational", "10K–100K", "high", "P3", "/blog"),
  k("math olympiad for kids", "Olympiad exams", "informational", "1K–10K", "medium", "P1", "/learn/subject/mathematics"),
  k("science olympiad for kids", "Olympiad exams", "informational", "1K–10K", "medium", "P1", "/learn/subject/science"),
  k("olympiad exam date 2026", "Olympiad exams", "informational", "10K–100K", "medium", "P2", "/blog"),

  // Mock tests & papers — highest commercial intent, our core product
  k("olympiad mock test", "Mock tests & papers", "transactional", "1K–10K", "medium", "P1", "/start"),
  k("free olympiad mock test", "Mock tests & papers", "transactional", "1K–10K", "low", "P1", "/start"),
  k("imo mock test online", "Mock tests & papers", "transactional", "1K–10K", "medium", "P1", "/start"),
  k("nso mock test online", "Mock tests & papers", "transactional", "1K–10K", "medium", "P1", "/start"),
  k("olympiad sample papers", "Mock tests & papers", "informational", "10K–100K", "high", "P1", "/blog"),
  k("imo sample paper", "Mock tests & papers", "informational", "10K–100K", "high", "P2", "/blog"),
  k("nso sample paper", "Mock tests & papers", "informational", "10K–100K", "high", "P2", "/blog"),
  k("olympiad previous year papers", "Mock tests & papers", "informational", "1K–10K", "medium", "P2", "/blog"),
  k("online olympiad practice test", "Mock tests & papers", "transactional", "1K–10K", "low", "P1", "/start"),
  k("olympiad online test", "Mock tests & papers", "transactional", "1K–10K", "medium", "P1", "/start"),
  k("olympiad test online", "Mock tests & papers", "transactional", "1K–10K", "medium", "P1", "/start"),
  k("olympiad practice test", "Mock tests & papers", "transactional", "1K–10K", "medium", "P1", "/start"),
  k("free olympiad practice", "Mock tests & papers", "transactional", "<1K", "low", "P1", "/start"),
  k("olympiad questions", "Mock tests & papers", "informational", "10K–100K", "high", "P1", "/blog"),
  k("olympiad practice questions", "Mock tests & papers", "informational", "1K–10K", "medium", "P1", "/blog"),

  // Class-wise — long tail, lower difficulty, many pages
  k("olympiad test for class 1 to 10", "Class-wise", "transactional", "<1K", "low", "P1", "/start"),
  k("olympiad for class 1", "Class-wise", "informational", "1K–10K", "low", "P1", "/blog"),
  k("imo class 2 sample paper", "Class-wise", "informational", "1K–10K", "low", "P1", "/blog"),
  k("imo class 3 questions", "Class-wise", "informational", "1K–10K", "low", "P1", "/blog"),
  k("nso class 4 sample paper", "Class-wise", "informational", "1K–10K", "low", "P1", "/blog"),
  k("imo class 5 mock test", "Class-wise", "transactional", "<1K", "low", "P1", "/start"),
  k("olympiad questions for class 6", "Class-wise", "informational", "1K–10K", "low", "P2", "/blog"),
  k("nso class 7 questions", "Class-wise", "informational", "1K–10K", "low", "P2", "/blog"),
  k("imo class 8 sample paper", "Class-wise", "informational", "1K–10K", "medium", "P2", "/blog"),
  k("olympiad for class 9", "Class-wise", "informational", "1K–10K", "medium", "P3", "/blog"),
  k("olympiad for class 10", "Class-wise", "informational", "1K–10K", "medium", "P3", "/blog"),

  // Preparation — informational, good for blog + diagnostic CTA
  k("how to prepare for olympiad", "Preparation", "informational", "1K–10K", "medium", "P1", "/blog"),
  k("how to prepare for imo", "Preparation", "informational", "1K–10K", "low", "P1", "/blog"),
  k("olympiad preparation", "Preparation", "commercial", "10K–100K", "high", "P1", "/"),
  k("olympiad preparation online", "Preparation", "commercial", "1K–10K", "medium", "P1", "/"),
  k("online olympiad preparation", "Preparation", "commercial", "1K–10K", "medium", "P1", "/"),
  k("olympiad syllabus", "Preparation", "informational", "10K–100K", "medium", "P2", "/blog"),
  k("imo syllabus class 3", "Preparation", "informational", "1K–10K", "low", "P2", "/blog"),
  k("olympiad coaching online", "Preparation", "commercial", "1K–10K", "medium", "P2", "/"),
  k("olympiad tips for kids", "Preparation", "informational", "<1K", "low", "P2", "/blog"),
  k("olympiad rank improvement", "Preparation", "informational", "<1K", "low", "P3", "/blog"),

  // Board & syllabus
  k("cbse olympiad preparation", "Board & syllabus", "commercial", "1K–10K", "low", "P1", "/"),
  k("icse olympiad preparation", "Board & syllabus", "commercial", "<1K", "low", "P1", "/"),
  k("cbse maths practice class 5", "Board & syllabus", "informational", "1K–10K", "medium", "P2", "/learn/subject/mathematics"),
  k("icse science questions class 6", "Board & syllabus", "informational", "<1K", "low", "P2", "/learn/subject/science"),

  // AI & product — our differentiator, low competition
  k("ai tutor for kids", "AI & product", "commercial", "1K–10K", "medium", "P1", "/"),
  k("ai tutor for olympiad", "AI & product", "commercial", "<1K", "low", "P1", "/"),
  k("ai tutor for students", "AI & product", "commercial", "10K–100K", "high", "P1", "/"),
  k("ai tutor for maths", "AI & product", "commercial", "1K–10K", "medium", "P1", "/learn/subject/mathematics"),
  k("olympiad learning platform", "AI & product", "commercial", "<1K", "low", "P1", "/"),
  k("olympiad preparation app", "AI & product", "commercial", "1K–10K", "medium", "P1", "/"),
  k("free olympiad preparation app", "AI & product", "transactional", "<1K", "low", "P1", "/start"),
  k("olympiad readiness test", "AI & product", "transactional", "<1K", "low", "P1", "/onboarding"),
  k("math quiz battle for kids", "AI & product", "transactional", "<1K", "low", "P2", "/"),
  k("olympiadiq", "AI & product", "navigational", "<1K", "low", "P1", "/"),

  // Books — Amazon affiliate blog posts
  k("best book for imo preparation", "Books (affiliate)", "commercial", "1K–10K", "medium", "P1", "/blog"),
  k("mtg olympiad books", "Books (affiliate)", "commercial", "1K–10K", "medium", "P1", "/blog"),
  k("best olympiad books for class 1", "Books (affiliate)", "commercial", "<1K", "low", "P1", "/blog"),
  k("oswaal olympiad books", "Books (affiliate)", "commercial", "1K–10K", "low", "P2", "/blog"),
  k("science olympiad books class 5", "Books (affiliate)", "commercial", "<1K", "low", "P2", "/blog"),

  // Brain games
  k("brain games for kids", "Brain games", "transactional", "10K–100K", "high", "P2", "/brain-booster"),
  k("math games for kids online", "Brain games", "transactional", "10K–100K", "high", "P2", "/brain-booster/number-ninja"),
  k("memory games for kids", "Brain games", "transactional", "10K–100K", "high", "P3", "/brain-booster/memory-match"),
  k("logical reasoning games for kids", "Brain games", "transactional", "1K–10K", "medium", "P2", "/brain-booster/pattern-blitz"),
  k("coding puzzles for kids", "Brain games", "transactional", "1K–10K", "medium", "P3", "/brain-booster/code-breaker"),
];

export interface SeoCompetitor {
  name: string;
  domain: string;
  seoScore: number;     // 0–100, est. domain authority for the niche
  visibility: number;   // 0–100, est. share of top-10 rankings across SEO_KEYWORDS
  strengths: string;    // what they win on
  gap: string;          // where we can beat them
}

// Ordered by visibility. Scores are estimates — see header comment.
export const SEO_COMPETITORS: SeoCompetitor[] = [
  {
    name: "Science Olympiad Foundation",
    domain: "sofworld.org",
    seoScore: 62,
    visibility: 34,
    strengths: "Owns IMO/NSO/IEO brand terms, official sample papers, exam dates",
    gap: "No practice engine; static PDFs only",
  },
  {
    name: "Physics Wallah",
    domain: "pw.live",
    seoScore: 78,
    visibility: 22,
    strengths: "Huge domain authority; olympiad sample-paper hub pages",
    gap: "Olympiad is a side section; thin for Classes 1–5",
  },
  {
    name: "BYJU'S",
    domain: "byjus.com",
    seoScore: 83,
    visibility: 19,
    strengths: "Ranks on syllabus and class-wise question pages by sheer authority",
    gap: "Generic content, not olympiad-specific",
  },
  {
    name: "Vedantu",
    domain: "vedantu.com",
    seoScore: 79,
    visibility: 17,
    strengths: "Class-wise olympiad question PDFs, strong internal linking",
    gap: "Lead-gen heavy pages; weak on interactive practice",
  },
  {
    name: "SilverZone Foundation",
    domain: "silverzone.org",
    seoScore: 52,
    visibility: 15,
    strengths: "Owns iOM/iSO brand terms and official sample papers",
    gap: "Slow site, little explanatory content",
  },
  {
    name: "Aakash",
    domain: "aakash.ac.in",
    seoScore: 71,
    visibility: 13,
    strengths: "IMO/IOM sample paper pages with solutions",
    gap: "Focused on older classes; little for primary",
  },
  {
    name: "Olympiad Success",
    domain: "olympiadsuccess.com",
    seoScore: 44,
    visibility: 12,
    strengths: "Long-tail class-wise sample papers and mock tests",
    gap: "Dated UX, paywalled practice, no AI",
  },
  {
    name: "CREST Olympiads",
    domain: "crestolympiads.com",
    seoScore: 47,
    visibility: 10,
    strengths: "Large blog of class-wise tips and worksheets",
    gap: "Content promotes their own exams only",
  },
  {
    name: "AglaSem Schools",
    domain: "schools.aglasem.com",
    seoScore: 58,
    visibility: 9,
    strengths: "Fast-indexed sample-paper and exam-date posts",
    gap: "Aggregator content, no practice or feedback",
  },
  {
    name: "TCYonline",
    domain: "tcyonline.com",
    seoScore: 49,
    visibility: 7,
    strengths: "IMO/NSO mock test series for Classes 3–10",
    gap: "Paid-only, nothing for Classes 1–2",
  },
];

// Our own row, for side-by-side comparison in the competitor table.
export const OUR_SITE: SeoCompetitor = {
  name: "OlympiadIQ (you)",
  domain: "olympiadiq.in",
  seoScore: 12,
  visibility: 1,
  strengths: "AI tutor, free adaptive mock tests, readiness score",
  gap: "New domain — build backlinks and class-wise long-tail pages",
};
