// Shared enums for the SEO Agent. Mirrors the CHECK constraints in
// supabase/migrations/013_seo_agent.sql — keep the two in sync.

export const KEYWORD_STATUSES = ["ACTIVE", "PAUSED", "USED", "ARCHIVED"] as const;
export type KeywordStatus = (typeof KEYWORD_STATUSES)[number];

export const SEARCH_INTENTS = ["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "TRANSACTIONAL"] as const;
export type SearchIntent = (typeof SEARCH_INTENTS)[number];

export const CONTENT_PLAN_STATUSES = [
  "IDEA", "PLANNED", "GENERATING", "DRAFT", "REVIEW", "APPROVED",
  "SCHEDULED", "PUBLISHED", "REJECTED", "ARCHIVED",
] as const;
export type ContentPlanStatus = (typeof CONTENT_PLAN_STATUSES)[number];

export const ARTICLE_STATUSES = [
  "GENERATING", "DRAFT", "REVIEW", "REVIEW_REQUIRED", "APPROVED",
  "SCHEDULED", "PUBLISHED", "REJECTED", "ARCHIVED",
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const AGENT_TASK_STATUSES = ["PENDING", "RUNNING", "COMPLETED", "FAILED", "WAITING_APPROVAL", "CANCELLED"] as const;
export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number];

export const CTA_TYPES = ["MOCK_TEST", "AI_TUTOR", "BATTLE", "BRAIN_BOOSTER"] as const;
export type CtaType = (typeof CTA_TYPES)[number];

export const CTA_LABELS: Record<CtaType, string> = {
  MOCK_TEST: "Free Mock Tests",
  AI_TUTOR: "AI Tutor",
  BATTLE: "Battle with Friends",
  BRAIN_BOOSTER: "Brain Booster Games",
};

export const PUBLISHING_MODES = ["MANUAL_APPROVAL", "AUTO_PUBLISH"] as const;
export type PublishingMode = (typeof PUBLISHING_MODES)[number];

export const FREQUENCIES = ["DAILY", "WEEKLY", "OFF"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const AI_PROVIDERS = ["anthropic"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const AI_USAGE_CATEGORIES = ["CONTENT", "SEO", "KEYWORD_ANALYSIS", "BACKLINKS", "OTHER"] as const;
export type AiUsageCategory = (typeof AI_USAGE_CATEGORIES)[number];

// Must match the blog_posts.category CHECK in 003_blog_posts.sql — articles
// are published into that table.
export const BLOG_CATEGORIES = ["Olympiad Prep", "Study Guides", "Book Reviews", "Exam Strategy", "Parent Resources"] as const;

export type StatusTone = "cobalt" | "gold" | "green" | "red" | "amber" | "neutral";

/** Badge colour for any SEO Agent status value. */
export const STATUS_TONES: Record<string, StatusTone> = {
  // generic
  ACTIVE: "green", PAUSED: "amber", USED: "neutral", ARCHIVED: "neutral",
  // content
  IDEA: "neutral", PLANNED: "cobalt", GENERATING: "cobalt", DRAFT: "neutral",
  REVIEW: "amber", REVIEW_REQUIRED: "red", APPROVED: "green", SCHEDULED: "cobalt",
  PUBLISHED: "green", REJECTED: "red",
  // agent tasks
  PENDING: "neutral", RUNNING: "cobalt", COMPLETED: "green", FAILED: "red",
  WAITING_APPROVAL: "amber", CANCELLED: "neutral",
  // content opportunities / cannibalization risk
  NEW_ARTICLE: "cobalt", UPDATE_EXISTING: "amber", MERGE_ARTICLES: "amber", NO_ACTION: "neutral",
  NONE: "green", LOW: "green", MEDIUM: "amber", HIGH: "red",
};

/** "REVIEW_REQUIRED" → "Review required" */
export function humanizeStatus(status: string): string {
  const s = status.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
