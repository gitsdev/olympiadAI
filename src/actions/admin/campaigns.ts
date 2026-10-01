"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { getAdminSettings } from "@/lib/admin/settings";
import {
  CAMPAIGN_COOLDOWN_DAYS, listCampaignCandidates, getCampaignCounts, dueCount,
  listUnsubscribeHeaders, type CampaignCandidate, type StudentEmailHistoryItem,
} from "@/lib/admin/campaigns";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import {
  CAMPAIGNS, buildCampaignEmail, isCampaignId, sampleRecipients, unsubscribePageUrl,
  type CampaignId, type CampaignSegment,
} from "@/lib/email/campaign-templates";

// Small enough that one server-action call finishes well inside a serverless
// timeout even with slow SMTP round-trips; the admin UI loops until done.
const BATCH_SIZE = 20;

export interface CampaignBatchResult {
  error: string | null;
  studentsSent: number;
  parentsSent: number;
  remaining: number;
}

function validate(campaign: string, segment?: string): { id: CampaignId; error: null } | { id: null; error: string } {
  if (!isCampaignId(campaign)) return { id: null, error: "Unknown email template." };
  if (segment !== undefined && !CAMPAIGNS[campaign].segments.includes(segment as CampaignSegment)) {
    return { id: null, error: "That audience isn't available for this template." };
  }
  return { id: campaign, error: null };
}

/** Sends one copy of each sample variant to the signed-in admin's own inbox. */
export async function sendCampaignTest(campaign: string, includeParents: boolean): Promise<{ error: string | null; sent: number }> {
  const admin = await requireAdmin();
  const v = validate(campaign);
  if (!v.id) return { error: v.error, sent: 0 };
  if (!admin.email) return { error: "Your admin account has no email address.", sent: 0 };

  const samples = sampleRecipients(v.id, admin.fullName)
    .filter((s) => includeParents || s.recipient.audience !== "parent");

  let sent = 0;
  for (const { recipient } of samples) {
    const email = buildCampaignEmail(v.id, recipient, unsubscribePageUrl("preview"));
    const result = await sendEmail({ to: admin.email, subject: `[TEST] ${email.subject}`, html: email.html, text: email.text });
    if (!result.sent) return { error: result.error ?? "Send failed.", sent };
    sent++;
  }
  return { error: null, sent };
}

/**
 * Sends the next batch of a campaign. Every successful send is recorded in
 * email_campaign_sends immediately, which drops that student out of the
 * candidate query, so the client just calls this repeatedly until
 * `remaining` is 0. On the first failure (Brevo daily limit, bad config) it
 * stops and returns the error; calling it again later resumes exactly where
 * it left off without double-sending.
 */
export async function sendCampaignBatch(campaign: string, segment: string, includeParents: boolean): Promise<CampaignBatchResult> {
  const admin = await requireAdmin();
  const v = validate(campaign, segment);
  if (!v.id) return { error: v.error, studentsSent: 0, parentsSent: 0, remaining: 0 };
  const id = v.id;
  const seg = segment as CampaignSegment;
  const withParents = includeParents && CAMPAIGNS[id].supportsParents;

  const service = createServiceClient();
  const settings = await getAdminSettings();
  const inactiveDays = settings.inactive_days_warning;

  let candidates: CampaignCandidate[];
  try {
    candidates = await listCampaignCandidates(id, seg, inactiveDays, BATCH_SIZE);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not load recipients.", studentsSent: 0, parentsSent: 0, remaining: 0 };
  }

  let studentsSent = 0;
  let parentsSent = 0;
  let error: string | null = null;

  for (const c of candidates) {
    const email = buildCampaignEmail(id, {
      audience: "student",
      studentName: c.full_name,
      classLevel: c.class_level,
      lastActiveAt: c.last_active_at,
      streakDays: c.streak_days,
    }, unsubscribePageUrl(c.unsubscribe_token));
    const result = await sendEmail({ to: c.email, ...email, headers: listUnsubscribeHeaders(c.unsubscribe_token) });
    if (!result.sent) {
      error = `Stopped at ${c.email}: ${result.error ?? "send failed"}`;
      break;
    }
    await service.from("email_campaign_sends").insert({
      campaign: id, student_id: c.student_id,
      recipient_email: c.email, recipient_role: "student", sent_by: admin.id,
    });
    studentsSent++;

    if (withParents) {
      const parentResult = await sendToParents(id, c, admin.id);
      parentsSent += parentResult.sent;
      if (parentResult.error) {
        error = parentResult.error;
        break;
      }
    }
  }

  if (studentsSent > 0) {
    await logAdminAction(admin.id, "campaign_emails_sent", "email_campaign", null, {
      campaign: id, segment: seg, studentsSent, parentsSent, inactiveDays,
    });
  }

  const counts = await getCampaignCounts(id, seg, inactiveDays);
  revalidatePath("/admin/emails");
  return { error, studentsSent, parentsSent, remaining: dueCount(counts) };
}

async function sendToParents(id: CampaignId, c: CampaignCandidate, adminId: string): Promise<{ sent: number; error: string | null }> {
  const service = createServiceClient();
  const { data } = await service
    .from("parents")
    .select("profile:profiles(email, email_opt_out, unsubscribe_token)")
    .contains("student_ids", [c.student_id]);

  const parents = ((data ?? []) as unknown as { profile: { email: string; email_opt_out: boolean; unsubscribe_token: string } | null }[])
    .map((p) => p.profile)
    .filter((p): p is NonNullable<typeof p> => !!p?.email && !p.email_opt_out);

  let sent = 0;
  for (const p of parents) {
    const email = buildCampaignEmail(id, {
      audience: "parent",
      studentName: c.full_name,
      classLevel: c.class_level,
      lastActiveAt: c.last_active_at,
      streakDays: c.streak_days,
    }, unsubscribePageUrl(p.unsubscribe_token));
    const result = await sendEmail({ to: p.email, ...email, headers: listUnsubscribeHeaders(p.unsubscribe_token) });
    if (!result.sent) return { sent, error: `Stopped at parent ${p.email}: ${result.error ?? "send failed"}` };
    await service.from("email_campaign_sends").insert({
      campaign: id, student_id: c.student_id,
      recipient_email: p.email, recipient_role: "parent", sent_by: adminId,
    });
    sent++;
  }
  return { sent, error: null };
}

/* ── Individual student ─────────────────────────────────────────────── */

export interface StudentEmailInfo {
  error: string | null;
  fullName: string;
  email: string;
  classLevel: number;
  lastActiveAt: string | null;
  streakDays: number;
  optedOut: boolean;
  history: StudentEmailHistoryItem[];
}

/** Everything the "Send email" dialog needs about one student. */
export async function getStudentEmailInfo(studentId: string): Promise<StudentEmailInfo> {
  await requireAdmin();
  const service = createServiceClient();
  const empty: StudentEmailInfo = {
    error: null, fullName: "", email: "", classLevel: 0, lastActiveAt: null,
    streakDays: 0, optedOut: false, history: [],
  };

  const [{ data: student }, { data: sends }] = await Promise.all([
    service
      .from("students")
      .select("class_level, streak_days, last_active_at, profile:profiles(full_name, email, email_opt_out)")
      .eq("id", studentId)
      .maybeSingle(),
    service
      .from("email_campaign_sends")
      .select("campaign, sent_at")
      .eq("student_id", studentId)
      .eq("recipient_role", "student")
      .order("sent_at", { ascending: false })
      .limit(20),
  ]);

  const row = student as unknown as {
    class_level: number; streak_days: number; last_active_at: string | null;
    profile: { full_name: string; email: string; email_opt_out: boolean } | null;
  } | null;
  if (!row?.profile) return { ...empty, error: "Student not found." };

  return {
    ...empty,
    fullName: row.profile.full_name,
    email: row.profile.email,
    classLevel: row.class_level,
    lastActiveAt: row.last_active_at,
    streakDays: row.streak_days,
    optedOut: row.profile.email_opt_out,
    history: ((sends ?? []) as { campaign: string; sent_at: string }[]).map((h) => ({
      ...h,
      within_cooldown: Date.now() - new Date(h.sent_at).getTime() < CAMPAIGN_COOLDOWN_DAYS * 86_400_000,
    })),
  };
}

/**
 * Sends one template to one student, on demand. Ignores the bulk cooldown
 * (the admin chose to send it and the dialog shows when they last got it)
 * but never overrides an unsubscribe. Logged like a bulk send, so the next
 * bulk run of the same template skips this student for the cooldown period.
 */
export async function sendCampaignToStudent(studentId: string, campaign: string): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const v = validate(campaign);
  if (!v.id) return { error: v.error };
  const service = createServiceClient();

  const { data } = await service
    .from("students")
    .select("class_level, streak_days, last_active_at, profile:profiles(full_name, email, email_opt_out, unsubscribe_token)")
    .eq("id", studentId)
    .maybeSingle();
  const row = data as unknown as {
    class_level: number; streak_days: number; last_active_at: string | null;
    profile: { full_name: string; email: string; email_opt_out: boolean; unsubscribe_token: string } | null;
  } | null;

  if (!row?.profile?.email) return { error: "Student email not found." };
  if (row.profile.email_opt_out) return { error: "This student has unsubscribed from emails." };

  const email = buildCampaignEmail(v.id, {
    audience: "student",
    studentName: row.profile.full_name,
    classLevel: row.class_level,
    lastActiveAt: row.last_active_at,
    streakDays: row.streak_days,
  }, unsubscribePageUrl(row.profile.unsubscribe_token));

  const result = await sendEmail({ to: row.profile.email, ...email, headers: listUnsubscribeHeaders(row.profile.unsubscribe_token) });
  if (!result.sent) return { error: result.error ?? "Send failed." };

  await service.from("email_campaign_sends").insert({
    campaign: v.id, student_id: studentId,
    recipient_email: row.profile.email, recipient_role: "student", sent_by: admin.id,
  });
  await logAdminAction(admin.id, "campaign_email_sent", "student", studentId, { campaign: v.id });
  revalidatePath("/admin/emails");
  return { error: null };
}
