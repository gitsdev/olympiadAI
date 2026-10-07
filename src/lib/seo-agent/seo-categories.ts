// SEO score categories and weights (spec §14). Pure, tiny and client-safe:
// UI imports this instead of seo-checks.ts, which pulls in the HTML parser.

export const SEO_CATEGORIES = [
  "TITLE", "META_TITLE", "META_DESCRIPTION", "HEADINGS", "SEARCH_INTENT", "KEYWORD_USAGE",
  "COMPLETENESS", "READABILITY", "INTERNAL_LINKING", "EXTERNAL_REFERENCES", "CTA", "OVERALL_QUALITY",
] as const;
export type SeoCategory = (typeof SEO_CATEGORIES)[number];

export const SEO_CATEGORY_LABELS: Record<SeoCategory, string> = {
  TITLE: "Title",
  META_TITLE: "Meta title",
  META_DESCRIPTION: "Meta description",
  HEADINGS: "Heading structure",
  SEARCH_INTENT: "Search intent match",
  KEYWORD_USAGE: "Keyword usage",
  COMPLETENESS: "Content completeness",
  READABILITY: "Readability",
  INTERNAL_LINKING: "Internal linking",
  EXTERNAL_REFERENCES: "External references",
  CTA: "CTA relevance",
  OVERALL_QUALITY: "Overall quality",
};

/** Weights sum to 100. Judgement-heavy categories weigh most. */
export const SEO_WEIGHTS: Record<SeoCategory, number> = {
  TITLE: 6, META_TITLE: 7, META_DESCRIPTION: 7, HEADINGS: 8, SEARCH_INTENT: 12, KEYWORD_USAGE: 8,
  COMPLETENESS: 14, READABILITY: 10, INTERNAL_LINKING: 8, EXTERNAL_REFERENCES: 4, CTA: 6, OVERALL_QUALITY: 10,
};
