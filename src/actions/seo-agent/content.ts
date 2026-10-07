"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { seoDb } from "@/lib/seo-agent/db";
import { errorMessage, seoLog } from "@/lib/seo-agent/logger";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { planOpportunityCore, PipelineError } from "@/lib/seo-agent/pipeline";
import {
  DELETABLE_PLAN_STATUSES, planInputSchema, planInputToRow, rescheduleTo,
} from "@/lib/seo-agent/content-plans";
import { zonedDateString } from "@/lib/seo-agent/datetime";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const uuid = z.uuid();

function revalidate() {
  revalidatePath("/admin/seo-agent", "layout");
}

function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.join(".") || "input"}: ${i.message}` : "Invalid input.";
}

/**
 * Runs the Content Planner Agent on an opportunity and saves the result as
 * a PLANNED content plan on the next free publishing day.
 */
export async function createPlanFromOpportunity(opportunityId: string): Promise<Result<{ planId: string; warnings: string[] }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(opportunityId).success) return { ok: false, error: "Invalid opportunity." };
  try {
    const db = await seoDb();
    const { planId, warnings } = await planOpportunityCore(db, await getSeoSettings(), opportunityId, { createdBy: admin.id, triggeredBy: "USER" as const });
    revalidate();
    return { ok: true, planId, warnings };
  } catch (err) {
    if (err instanceof PipelineError) return { ok: false, error: err.message };
    seoLog.error("content.plan_failed", { opportunityId, error: errorMessage(err) });
    return { ok: false, error: `Content planning failed: ${errorMessage(err)}` };
  }
}

export async function setOpportunityStatus(id: string, status: "OPEN" | "DISMISSED"): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success || !["OPEN", "DISMISSED"].includes(status)) return { ok: false, error: "Invalid request." };
  const db = await seoDb();
  const { error } = await db.from("seo_content_opportunities").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function createPlan(input: unknown): Promise<Result<{ planId: string }>> {
  const admin = await requireAdmin();
  const parsed = planInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const settings = await getSeoSettings();

  const db = await seoDb();
  const { data, error } = await db
    .from("seo_content_plans")
    .insert({ ...planInputToRow(parsed.data, settings.timezone, settings.defaultPublishTime), created_by: admin.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: `Could not create plan: ${error.message}` };
  revalidate();
  return { ok: true, planId: (data as { id: string }).id };
}

/** Plans further along than these are owned by the article workflow, not the form. */
async function getEditableStatus(db: Awaited<ReturnType<typeof seoDb>>, id: string): Promise<string | null> {
  const { data } = await db.from("seo_content_plans").select("status").eq("id", id).maybeSingle();
  return (data as { status: string } | null)?.status ?? null;
}

export async function updatePlan(id: string, input: unknown): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid plan." };
  const parsed = planInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const db = await seoDb();
  const current = await getEditableStatus(db, id);
  if (!current) return { ok: false, error: "Plan not found." };
  if (!DELETABLE_PLAN_STATUSES.includes(current)) {
    return { ok: false, error: `This plan is ${current.toLowerCase()} and is now managed through its article.` };
  }
  const settings = await getSeoSettings();
  const { error } = await db.from("seo_content_plans").update(planInputToRow(parsed.data, settings.timezone, settings.defaultPublishTime)).eq("id", id);
  if (error) return { ok: false, error: `Could not save plan: ${error.message}` };
  revalidate();
  return { ok: true };
}

export async function deletePlan(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid plan." };
  const db = await seoDb();
  const { data: plan } = await db.from("seo_content_plans").select("status, opportunity_id").eq("id", id).maybeSingle();
  const p = plan as { status: string; opportunity_id: string | null } | null;
  if (!p) return { ok: false, error: "Plan not found." };
  if (!DELETABLE_PLAN_STATUSES.includes(p.status)) return { ok: false, error: "Plans with an article can't be deleted. Archive the article instead." };

  const { error } = await db.from("seo_content_plans").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  // Put the recommendation back in the queue so it isn't lost.
  if (p.opportunity_id) await db.from("seo_content_opportunities").update({ status: "OPEN" }).eq("id", p.opportunity_id).eq("status", "ACCEPTED");
  revalidate();
  return { ok: true };
}

/** Drag-and-drop on the calendar: move a plan to another day, keeping its time. */
export async function reschedulePlan(id: string, date: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Invalid request." };
  const settings = await getSeoSettings();
  if (date < zonedDateString(new Date(), settings.timezone)) return { ok: false, error: "Can't schedule into the past." };

  const db = await seoDb();
  const { data } = await db.from("seo_content_plans").select("status, planned_publish_at").eq("id", id).maybeSingle();
  const p = data as { status: string; planned_publish_at: string | null } | null;
  if (!p) return { ok: false, error: "Plan not found." };
  if (!DELETABLE_PLAN_STATUSES.includes(p.status)) return { ok: false, error: "This plan's article is already in progress; reschedule the article instead." };

  const at = rescheduleTo(date, p.planned_publish_at, settings.timezone, settings.defaultPublishTime);
  const { error } = await db.from("seo_content_plans")
    .update({ planned_publish_at: at.toISOString(), ...(p.status === "IDEA" ? { status: "PLANNED" } : {}) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
