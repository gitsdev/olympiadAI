"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { getAdminSettings } from "@/lib/admin/settings";
import {
  REENGAGEMENT_CAMPAIGN, listReengagementCandidates, getReengagementCounts,
  reengagementActionUrl, unsubscribePageUrl, listUnsubscribeHeaders,
  type ReengagementCandidate,
} from "@/lib/admin/campaigns";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { buildReengagementEmail } from "@/lib/email/reengagement-template";

// Small enough that one server-action call finishes well inside a serverless
// timeout even with slow SMTP round-trips; the admin UI loops until done.
const BATCH_SIZE = 20;

export interface ReengagementBatchResult {
  error: string | null;
  studentsSent: number;
  parentsSent: number;
  remaining: number;
}

/** Sends one copy of each variant to the signed-in admin's own inbox. */
export async function sendReengagementTest(includeParents: boolean): Promise<{ error: string | null; sent: number }> {
  const admin = await requireAdmin();
  if (!admin.email) return { error: "Your admin account has no email address.", sent: 0 };

  const base = {
    studentName: admin.fullName,
    classLevel: 6,
    unsubscribeUrl: unsubscribePageUrl("preview"),
  };
  const variants = [
    buildReengagementEmail({ ...base, audience: "student", lastActiveAt: null, streakDays: 0, actionUrl: reengagementActionUrl("student") }),
    buildReengagementEmail({ ...base, audience: "student", lastActiveAt: new Date().toISOString(), streakDays: 5, actionUrl: reengagementActionUrl("student") }),
    ...(includeParents
      ? [buildReengagementEmail({ ...base, audience: "parent", lastActiveAt: new Date().toISOString(), streakDays: 5, actionUrl: reengagementActionUrl("parent") })]
      : []),
  ];

  let sent = 0;
  for (const email of variants) {
    const result = await sendEmail({ to: admin.email, subject: `[TEST] ${email.subject}`, html: email.html, text: email.text });
    if (!result.sent) return { error: result.error ?? "Send failed.", sent };
    sent++;
  }
  return { error: null, sent };
}

/**
 * Sends the next batch of re-engagement emails. Every successful send is
 * recorded in email_campaign_sends immediately, which drops that student
 * out of the candidate query, so the client just calls this repeatedly
 * until `remaining` is 0. On the first failure (Brevo daily limit, bad
 * config) it stops and returns the error; calling it again later resumes
 * exactly where it left off without double-sending.
 */
export async function sendReengagementBatch(includeParents: boolean): Promise<ReengagementBatchResult> {
  const admin = await requireAdmin();
  const service = createServiceClient();
  const settings = await getAdminSettings();
  const inactiveDays = settings.inactive_days_warning;

  let candidates: ReengagementCandidate[];
  try {
    candidates = await listReengagementCandidates(inactiveDays, BATCH_SIZE);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not load recipients.", studentsSent: 0, parentsSent: 0, remaining: 0 };
  }

  let studentsSent = 0;
  let parentsSent = 0;
  let error: string | null = null;

  for (const c of candidates) {
    const email = buildReengagementEmail({
      audience: "student",
      studentName: c.full_name,
      classLevel: c.class_level,
      lastActiveAt: c.last_active_at,
      streakDays: c.streak_days,
      actionUrl: reengagementActionUrl("student"),
      unsubscribeUrl: unsubscribePageUrl(c.unsubscribe_token),
    });
    const result = await sendEmail({ to: c.email, ...email, headers: listUnsubscribeHeaders(c.unsubscribe_token) });
    if (!result.sent) {
      error = `Stopped at ${c.email}: ${result.error ?? "send failed"}`;
      break;
    }
    await service.from("email_campaign_sends").insert({
      campaign: REENGAGEMENT_CAMPAIGN, student_id: c.student_id,
      recipient_email: c.email, recipient_role: "student", sent_by: admin.id,
    });
    studentsSent++;

    if (includeParents) {
      const parentResult = await sendToParents(c, admin.id);
      parentsSent += parentResult.sent;
      if (parentResult.error) {
        error = parentResult.error;
        break;
      }
    }
  }

  if (studentsSent > 0) {
    await logAdminAction(admin.id, "reengagement_emails_sent", "email_campaign", null, {
      campaign: REENGAGEMENT_CAMPAIGN, studentsSent, parentsSent, inactiveDays,
    });
  }

  const counts = await getReengagementCounts(inactiveDays);
  revalidatePath("/admin/emails");
  return { error, studentsSent, parentsSent, remaining: counts.neverStarted + counts.lapsed };
}

async function sendToParents(c: ReengagementCandidate, adminId: string): Promise<{ sent: number; error: string | null }> {
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
    const email = buildReengagementEmail({
      audience: "parent",
      studentName: c.full_name,
      classLevel: c.class_level,
      lastActiveAt: c.last_active_at,
      streakDays: c.streak_days,
      actionUrl: reengagementActionUrl("parent"),
      unsubscribeUrl: unsubscribePageUrl(p.unsubscribe_token),
    });
    const result = await sendEmail({ to: p.email, ...email, headers: listUnsubscribeHeaders(p.unsubscribe_token) });
    if (!result.sent) return { sent, error: `Stopped at parent ${p.email}: ${result.error ?? "send failed"}` };
    await service.from("email_campaign_sends").insert({
      campaign: REENGAGEMENT_CAMPAIGN, student_id: c.student_id,
      recipient_email: p.email, recipient_role: "parent", sent_by: adminId,
    });
    sent++;
  }
  return { sent, error: null };
}
