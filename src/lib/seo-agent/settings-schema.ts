// SEO Agent settings: Zod schema, defaults, and row ↔ model mapping.
// Pure + client-safe (used by the settings form and the server action).

import { z } from "zod";
import {
  AI_PROVIDERS, BLOG_CATEGORIES, CTA_TYPES, FREQUENCIES, PUBLISHING_MODES,
} from "./constants";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "./datetime";

const nonEmptyList = z.array(z.string().trim().min(1).max(120)).min(1).max(30);

export const brandSchema = z.object({
  name: z.string().trim().min(1).max(80),
  website: z.url(),
  audience: nonEmptyList,
  topics: nonEmptyList,
  // Only real OlympiadIQ features — agents must never invent others.
  features: nonEmptyList,
});
export type BrandProfile = z.infer<typeof brandSchema>;

/** USD per 1M tokens. Entered by the admin; never assumed. */
export const modelPricingSchema = z.object({
  input: z.number().min(0).max(1000),
  output: z.number().min(0).max(1000),
});
export const aiPricingSchema = z.record(z.string().trim().min(1).max(100), modelPricingSchema);
export type AiPricing = z.infer<typeof aiPricingSchema>;

export const seoSettingsSchema = z.object({
  aiProvider: z.enum(AI_PROVIDERS),
  aiModel: z.string().trim().min(1).max(100),
  aiPricing: aiPricingSchema,
  publishingMode: z.enum(PUBLISHING_MODES),
  defaultPublishTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)"),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
  contentPlanningFrequency: z.enum(FREQUENCIES),
  articleGenerationFrequency: z.enum(FREQUENCIES),
  searchConsoleSyncFrequency: z.enum(FREQUENCIES),
  backlinkCheckFrequency: z.enum(FREQUENCIES),
  defaultArticleCategory: z.enum(BLOG_CATEGORIES),
  defaultCta: z.enum(CTA_TYPES),
  searchConsoleSiteUrl: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || v.startsWith("sc-domain:") || /^https?:\/\//.test(v), "Use sc-domain:example.com or a full https:// URL")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  blogBaseUrl: z.url(),
  brand: brandSchema,
});
export type SeoSettings = z.infer<typeof seoSettingsSchema>;

export const DEFAULT_BRAND: BrandProfile = {
  name: "OlympiadIQ",
  website: "https://www.olympiadiq.in/",
  audience: ["Students", "Parents", "Teachers"],
  topics: ["Olympiad preparation", "Mathematics", "Science", "Reasoning", "Practice", "Mock tests", "AI learning", "Brain games"],
  features: ["Free Unlimited Mock Tests", "AI Tutor", "Battle with Friends", "Brain Booster Games"],
};

/** Matches the column defaults in 013_seo_agent.sql. */
export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  aiProvider: "anthropic",
  aiModel: "claude-opus-5-5",
  // Anthropic's published price for the default model (USD per 1M tokens,
  // as of Sept 2026). Editable in Settings; other models stay unpriced
  // until the admin enters them.
  aiPricing: { "claude-opus-5-5": { input: 4, output: 20 } },
  publishingMode: "MANUAL_APPROVAL",
  defaultPublishTime: "10:00",
  timezone: DEFAULT_TIMEZONE,
  contentPlanningFrequency: "DAILY",
  articleGenerationFrequency: "DAILY",
  searchConsoleSyncFrequency: "DAILY",
  backlinkCheckFrequency: "WEEKLY",
  defaultArticleCategory: "Olympiad Prep",
  defaultCta: "MOCK_TEST",
  searchConsoleSiteUrl: null,
  blogBaseUrl: "https://www.olympiadiq.in/blog",
  brand: DEFAULT_BRAND,
};

/** Shape of the seo_settings row (snake_case, as returned by Supabase). */
export interface SeoSettingsRow {
  ai_provider: string;
  ai_model: string;
  ai_pricing: unknown;
  publishing_mode: string;
  default_publish_time: string; // "10:00:00"
  timezone: string;
  content_planning_frequency: string;
  article_generation_frequency: string;
  search_console_sync_frequency: string;
  backlink_check_frequency: string;
  default_article_category: string;
  default_cta: string;
  search_console_site_url: string | null;
  blog_base_url: string;
  brand: unknown;
  updated_at?: string;
}

/**
 * Row → validated settings. Throws if the row is corrupt rather than
 * silently running agents on bad configuration.
 */
export function settingsFromRow(row: SeoSettingsRow): SeoSettings {
  return seoSettingsSchema.parse({
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    aiPricing: row.ai_pricing ?? {},
    publishingMode: row.publishing_mode,
    defaultPublishTime: row.default_publish_time.slice(0, 5),
    timezone: row.timezone,
    contentPlanningFrequency: row.content_planning_frequency,
    articleGenerationFrequency: row.article_generation_frequency,
    searchConsoleSyncFrequency: row.search_console_sync_frequency,
    backlinkCheckFrequency: row.backlink_check_frequency,
    defaultArticleCategory: row.default_article_category,
    defaultCta: row.default_cta,
    searchConsoleSiteUrl: row.search_console_site_url ?? "",
    blogBaseUrl: row.blog_base_url,
    brand: row.brand,
  });
}

export function settingsToRow(s: SeoSettings): Omit<SeoSettingsRow, "updated_at"> {
  return {
    ai_provider: s.aiProvider,
    ai_model: s.aiModel,
    ai_pricing: s.aiPricing,
    publishing_mode: s.publishingMode,
    default_publish_time: s.defaultPublishTime,
    timezone: s.timezone,
    content_planning_frequency: s.contentPlanningFrequency,
    article_generation_frequency: s.articleGenerationFrequency,
    search_console_sync_frequency: s.searchConsoleSyncFrequency,
    backlink_check_frequency: s.backlinkCheckFrequency,
    default_article_category: s.defaultArticleCategory,
    default_cta: s.defaultCta,
    search_console_site_url: s.searchConsoleSiteUrl,
    blog_base_url: s.blogBaseUrl,
    brand: s.brand,
  };
}

/**
 * Cost of a call in USD, or null when pricing for `model` hasn't been
 * configured — callers must show "unknown", never a guessed number.
 */
export function estimateCost(pricing: AiPricing, model: string, inputTokens: number, outputTokens: number): number | null {
  const p = pricing[model];
  if (!p) return null;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
