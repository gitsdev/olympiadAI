"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { seoDb } from "@/lib/seo-agent/db";
import { errorMessage, seoLog } from "@/lib/seo-agent/logger";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { linkSuggestionsCore, PipelineError, seoCheckCore } from "@/lib/seo-agent/pipeline";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = z.uuid();

/** SEO Agent: deterministic checks + AI review → internal score, stored on the article. */
export async function runSeoCheck(articleId: string): Promise<Result<{ score: number }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  try {
    const db = await seoDb();
    const analysis = await seoCheckCore(db, await getSeoSettings(), articleId, { createdBy: admin.id, triggeredBy: "USER" as const });
    revalidatePath("/admin/seo-agent", "layout");
    return { ok: true, score: analysis.score };
  } catch (err) {
    if (err instanceof PipelineError) return { ok: false, error: err.message };
    seoLog.error("seo.check_failed", { articleId, error: errorMessage(err) });
    return { ok: false, error: `SEO check failed: ${errorMessage(err)}` };
  }
}

/** Internal Linking Agent: fresh link suggestions for the article (anchored on its own text). */
export async function findLinkSuggestions(articleId: string): Promise<Result<{ added: number; dropped: number }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  try {
    const db = await seoDb();
    const out = await linkSuggestionsCore(db, await getSeoSettings(), articleId, { createdBy: admin.id, triggeredBy: "USER" as const });
    revalidatePath("/admin/seo-agent", "layout");
    return { ok: true, ...out };
  } catch (err) {
    if (err instanceof PipelineError) return { ok: false, error: err.message };
    seoLog.error("seo.links_failed", { articleId, error: errorMessage(err) });
    return { ok: false, error: `Link suggestions failed: ${errorMessage(err)}` };
  }
}

/** Dismiss a suggestion; it is kept as REJECTED so it isn't suggested again. */
export async function dismissLinkSuggestion(linkId: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(linkId).success) return { ok: false, error: "Invalid suggestion." };
  const db = await seoDb();
  const { error } = await db.from("seo_article_links").update({ status: "REJECTED" }).eq("id", linkId).eq("status", "SUGGESTED");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/seo-agent", "layout");
  return { ok: true };
}
