"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/service";
import { seoDb } from "@/lib/seo-agent/db";
import { errorMessage, seoLog } from "@/lib/seo-agent/logger";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { EDITABLE_ARTICLE_STATUSES } from "@/lib/seo-agent/articles";
import { canTransition, parseSchedule, planStatusFor, TRANSITIONS, type ValidationIssue, type WorkflowAction } from "@/lib/seo-agent/publishing/rules";
import { buildPublishCheck, loadArticleForPublish, publishArticle, storeImage } from "@/lib/seo-agent/publishing/publisher";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; issues?: ValidationIssue[] };
const uuid = z.uuid();

function revalidate() {
  revalidatePath("/admin/seo-agent", "layout");
}

/**
 * Moves an article from one of the action's allowed statuses to its target,
 * atomically (the status filter makes concurrent clicks safe), and keeps the
 * content plan's status in step.
 */
async function transition(articleId: string, action: WorkflowAction, patch: Record<string, unknown> = {}): Promise<Result> {
  const db = await seoDb();
  const { from, to } = TRANSITIONS[action];
  const { data, error } = await db.from("seo_articles").update({ status: to, ...patch })
    .eq("id", articleId).in("status", from as string[]).select("content_plan_id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "The article isn't in a state that allows this. Reload and try again." };
  const planId = (data as { content_plan_id: string | null }).content_plan_id;
  const planStatus = planStatusFor(to);
  if (planId && planStatus) await db.from("seo_content_plans").update({ status: planStatus }).eq("id", planId);
  revalidate();
  return { ok: true };
}

export async function submitForReview(articleId: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  return transition(articleId, "SUBMIT_FOR_REVIEW");
}

/** Records the human approval (§18). Blocked while hard validation errors remain. */
export async function approveArticle(articleId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  try {
    const db = await seoDb();
    const a = await loadArticleForPublish(db, articleId);
    if (!a) return { ok: false, error: "Article not found." };
    if (!canTransition(a.status, "APPROVE")) return { ok: false, error: `A ${a.status.toLowerCase()} article can't be approved.` };
    // Check everything except the approval itself; read-only checks use the service client.
    const check = await buildPublishCheck(createServiceClient(), a, "MANUAL_APPROVAL", { assumeApproved: true });
    if (check.errors.length) {
      return { ok: false, error: "Fix these before approving:", issues: check.errors };
    }
    const res = await transition(articleId, "APPROVE", {
      publish_authorization: "MANUAL_APPROVAL",
      approved_by: admin.id,
      approved_at: new Date().toISOString(),
    });
    if (res.ok) await logAdminAction(admin.id, "seo_article_approved", "seo_article", articleId, { title: a.title });
    return res;
  } catch (err) {
    seoLog.error("workflow.approve_failed", { articleId, error: errorMessage(err) });
    return { ok: false, error: `Approval failed: ${errorMessage(err)}` };
  }
}

/** Back to review so the article can be edited; clears the approval and any schedule. */
export async function withdrawApproval(articleId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  const res = await transition(articleId, "WITHDRAW_APPROVAL", {
    approved_by: null, approved_at: null, publish_authorization: null, scheduled_for: null,
  });
  if (res.ok) await logAdminAction(admin.id, "seo_article_approval_withdrawn", "seo_article", articleId);
  return res;
}

/** Schedules publication at a wall-clock date/time in the configured timezone (§19). */
export async function scheduleArticle(articleId: string, date: string, time: string): Promise<Result<{ at: string }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  const settings = await getSeoSettings();
  const parsed = parseSchedule(date, time, settings.timezone);
  if (!parsed.ok) return parsed;
  const at = parsed.at.toISOString();

  const db = await seoDb();
  const res = await transition(articleId, "SCHEDULE", { scheduled_for: at });
  if (!res.ok) return res;
  const { data } = await db.from("seo_articles").select("content_plan_id").eq("id", articleId).maybeSingle();
  const planId = (data as { content_plan_id: string | null } | null)?.content_plan_id;
  if (planId) await db.from("seo_content_plans").update({ planned_publish_at: at }).eq("id", planId);
  await logAdminAction(admin.id, "seo_article_scheduled", "seo_article", articleId, { at });
  return { ok: true, at };
}

export async function unscheduleArticle(articleId: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  return transition(articleId, "UNSCHEDULE", { scheduled_for: null });
}

/** Publishes immediately through the same pipeline as the API and cron. */
export async function publishArticleNow(articleId: string): Promise<Result<{ url: string }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  const out = await publishArticle(createServiceClient(), articleId, { actorId: admin.id, triggeredBy: "USER" });
  revalidate();
  if (!out.ok) return { ok: false, error: out.error, issues: out.issues };
  await logAdminAction(admin.id, "seo_article_published", "seo_article", articleId, { url: out.url });
  return { ok: true, url: out.url };
}

export async function rejectArticle(articleId: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  return transition(articleId, "REJECT");
}

export async function reopenArticle(articleId: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  return transition(articleId, "REOPEN");
}

/** Uploads a featured image (JPEG/PNG/WebP, ≤ 5 MB) to the blog-images bucket. */
export async function uploadFeaturedImage(articleId: string, form: FormData): Promise<Result<{ url: string }>> {
  await requireAdmin();
  if (!uuid.safeParse(articleId).success) return { ok: false, error: "Invalid article." };
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose an image file." };
  try {
    const db = await seoDb();
    const { data } = await db.from("seo_articles").select("status").eq("id", articleId).maybeSingle();
    const status = (data as { status: string } | null)?.status;
    if (!status) return { ok: false, error: "Article not found." };
    if (!EDITABLE_ARTICLE_STATUSES.includes(status)) return { ok: false, error: `A ${status.toLowerCase()} article can't be edited.` };

    const url = await storeImage(createServiceClient(), articleId, new Uint8Array(await file.arrayBuffer()), file.type);
    const { error } = await db.from("seo_articles").update({ featured_image_url: url }).eq("id", articleId);
    if (error) throw error;
    revalidate();
    return { ok: true, url };
  } catch (err) {
    seoLog.error("workflow.upload_failed", { articleId, error: errorMessage(err) });
    return { ok: false, error: errorMessage(err) };
  }
}
