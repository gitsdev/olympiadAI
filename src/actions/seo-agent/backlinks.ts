"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/service";
import { seoDb } from "@/lib/seo-agent/db";
import { errorMessage, seoLog } from "@/lib/seo-agent/logger";
import { getSeoSettings } from "@/lib/seo-agent/settings-data";
import { PipelineError } from "@/lib/seo-agent/pipeline";
import { BACKLINK_STATUSES, backlinkInputSchema, prospectInputSchema, websiteFromUrl } from "@/lib/seo-agent/backlinks/model";
import { checkBacklinkCore, checkTrackedBacklinks, evaluateProspectCore, generateOutreachCore } from "@/lib/seo-agent/backlinks/service";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const uuid = z.uuid();

function revalidate() {
  revalidatePath("/admin/seo-agent", "layout");
}

function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.join(".") || "input"}: ${i.message}` : "Invalid input.";
}

const isUnique = (e: { code?: string } | null) => e?.code === "23505";

function fail(context: string, err: unknown): { ok: false; error: string } {
  if (err instanceof PipelineError) return { ok: false, error: err.message };
  seoLog.error(`backlinks.${context}_failed`, { error: errorMessage(err) });
  return { ok: false, error: `${context} failed: ${errorMessage(err)}` };
}

// ── Prospects ────────────────────────────────────────────────────────────

function prospectRow(p: z.infer<typeof prospectInputSchema>) {
  return {
    url: p.url, website: p.website ?? websiteFromUrl(p.url), topic: p.topic ?? null, opportunity_type: p.opportunityType,
    contact_name: p.contactName ?? null, contact_email: p.contactEmail ?? null, contact_url: p.contactUrl ?? null,
    status: p.status, notes: p.notes ?? null,
  };
}

export async function createProspect(input: unknown): Promise<Result<{ id: string }>> {
  const admin = await requireAdmin();
  const parsed = prospectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const db = await seoDb();
  const { data, error } = await db.from("seo_backlink_prospects").insert({ ...prospectRow(parsed.data), created_by: admin.id }).select("id").single();
  if (isUnique(error)) return { ok: false, error: "That URL is already in your opportunities." };
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateProspect(id: string, input: unknown): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid prospect." };
  const parsed = prospectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const db = await seoDb();
  const { error } = await db.from("seo_backlink_prospects").update(prospectRow(parsed.data)).eq("id", id);
  if (isUnique(error)) return { ok: false, error: "That URL is already in your opportunities." };
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function setProspectStatus(id: string, status: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success || !z.enum(BACKLINK_STATUSES).safeParse(status).success) return { ok: false, error: "Invalid request." };
  const db = await seoDb();
  const { error } = await db.from("seo_backlink_prospects").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteProspect(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid prospect." };
  const db = await seoDb();
  const { error } = await db.from("seo_backlink_prospects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Backlink Agent: fetches the page and scores it (no invented metrics). */
export async function evaluateProspect(id: string): Promise<Result<{ relevance: number; quality: number; spamRisk: string }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid prospect." };
  try {
    const e = await evaluateProspectCore(await seoDb(), await getSeoSettings(), id, { createdBy: admin.id, triggeredBy: "USER" });
    revalidate();
    return { ok: true, relevance: e.relevanceScore, quality: e.qualityScore, spamRisk: e.spamRisk };
  } catch (err) {
    return fail("Evaluation", err);
  }
}

// ── Outreach ─────────────────────────────────────────────────────────────

export async function generateOutreach(prospectId: string): Promise<Result<{ messageId: string; warnings: string[] }>> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(prospectId).success) return { ok: false, error: "Invalid prospect." };
  try {
    const r = await generateOutreachCore(await seoDb(), await getSeoSettings(), prospectId, { createdBy: admin.id, triggeredBy: "USER" });
    revalidate();
    return { ok: true, ...r };
  } catch (err) {
    return fail("Outreach drafting", err);
  }
}

const messageEditSchema = z.object({ subject: z.string().trim().min(3).max(150), body: z.string().trim().min(20).max(5000) });

/** Edit a draft. Approved messages are locked; reopen them to edit. */
export async function updateOutreachMessage(id: string, input: unknown): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid message." };
  const parsed = messageEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const db = await seoDb();
  const { data, error } = await db.from("seo_outreach_messages").update(parsed.data).eq("id", id).eq("status", "DRAFT").select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Only drafts can be edited. Reopen the message first." };
  revalidate();
  return { ok: true };
}

/** §28: approval is required before a message can be copied (or, in future, sent). */
export async function approveOutreachMessage(id: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid message." };
  const db = await seoDb();
  const { data, error } = await db.from("seo_outreach_messages")
    .update({ status: "APPROVED", approved_by: admin.id, approved_at: new Date().toISOString() })
    .eq("id", id).eq("status", "DRAFT").select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "This message isn't a draft any more." };
  await logAdminAction(admin.id, "seo_outreach_approved", "seo_outreach_message", id);
  revalidate();
  return { ok: true };
}

export async function reopenOutreachMessage(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid message." };
  const db = await seoDb();
  const { error } = await db.from("seo_outreach_messages")
    .update({ status: "DRAFT", approved_by: null, approved_at: null }).eq("id", id).in("status", ["APPROVED", "COPIED"]);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Records that the approved message was copied (the admin sends it from their own email). */
export async function markOutreachCopied(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid message." };
  const db = await seoDb();
  const { data, error } = await db.from("seo_outreach_messages").update({ status: "COPIED" }).eq("id", id).in("status", ["APPROVED", "COPIED"]).select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Approve the message before copying it." };
  revalidate();
  return { ok: true };
}

export async function deleteOutreachMessage(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid message." };
  const db = await seoDb();
  const { error } = await db.from("seo_outreach_messages").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ── Tracker ──────────────────────────────────────────────────────────────

export async function createBacklink(input: unknown, prospectId?: string): Promise<Result<{ id: string }>> {
  await requireAdmin();
  const parsed = backlinkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (prospectId && !uuid.safeParse(prospectId).success) return { ok: false, error: "Invalid prospect." };
  const db = await seoDb();
  const v = parsed.data;
  const { data, error } = await db.from("seo_backlinks").insert({
    source_url: v.sourceUrl, target_url: v.targetUrl, anchor_text: v.anchorText ?? null, status: v.status, notes: v.notes ?? null,
    prospect_id: prospectId ?? null,
  }).select("id").single();
  if (isUnique(error)) return { ok: false, error: "That source → target link is already being tracked." };
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateBacklink(id: string, input: unknown): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid backlink." };
  const parsed = backlinkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;
  const db = await seoDb();
  const { error } = await db.from("seo_backlinks").update({
    source_url: v.sourceUrl, target_url: v.targetUrl, anchor_text: v.anchorText ?? null, status: v.status, notes: v.notes ?? null,
  }).eq("id", id);
  if (isUnique(error)) return { ok: false, error: "That source → target link is already being tracked." };
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteBacklink(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid backlink." };
  const db = await seoDb();
  const { error } = await db.from("seo_backlinks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Fetches the source page now and records whether our link is there. */
export async function checkBacklinkNow(id: string): Promise<Result<{ found: boolean; status: string; error: string | null }>> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid backlink." };
  try {
    const r = await checkBacklinkCore(await seoDb(), id);
    revalidate();
    return { ok: true, found: r.found, status: r.status, error: r.error };
  } catch (err) {
    return fail("Link check", err);
  }
}

export async function checkAllBacklinksNow(): Promise<Result<{ checked: number; active: number; lost: number; errors: number }>> {
  const admin = await requireAdmin();
  try {
    // The batch logs a task via the service role (same path as the weekly cron).
    const r = await checkTrackedBacklinks(createServiceClient(), { createdBy: admin.id, triggeredBy: "USER" });
    revalidate();
    return { ok: true, ...r };
  } catch (err) {
    return fail("Link checks", err);
  }
}
