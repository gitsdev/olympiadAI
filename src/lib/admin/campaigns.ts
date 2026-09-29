import { requireAdmin } from "@/lib/admin/auth";
import { getAdminSettings } from "@/lib/admin/settings";
import { createServiceClient } from "@/lib/supabase/service";
import { buildReengagementEmail, type ReengagementAudience } from "@/lib/email/reengagement-template";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const REENGAGEMENT_CAMPAIGN = "reengagement";
/** A student won't get this email again until this many days after the last one. */
export const REENGAGEMENT_COOLDOWN_DAYS = 14;

export interface ReengagementCounts {
  neverStarted: number;
  lapsed: number;
  recentlyEmailed: number;
  optedOut: number;
}

export interface ReengagementCandidate {
  student_id: string;
  email: string;
  full_name: string;
  class_level: number;
  streak_days: number;
  total_points: number;
  last_active_at: string | null;
  unsubscribe_token: string;
}

export async function getReengagementCounts(inactiveDays: number): Promise<ReengagementCounts> {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_reengagement_counts", {
    p_inactive_days: inactiveDays,
    p_cooldown_days: REENGAGEMENT_COOLDOWN_DAYS,
  });
  if (error) throw new Error(error.message);
  const row = (data as { never_started: number; lapsed: number; recently_emailed: number; opted_out: number }[] | null)?.[0];
  return {
    neverStarted: Number(row?.never_started ?? 0),
    lapsed: Number(row?.lapsed ?? 0),
    recentlyEmailed: Number(row?.recently_emailed ?? 0),
    optedOut: Number(row?.opted_out ?? 0),
  };
}

/** Next batch of students still due the email. Caller must have run requireAdmin(). */
export async function listReengagementCandidates(inactiveDays: number, limit: number): Promise<ReengagementCandidate[]> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_reengagement_candidates", {
    p_inactive_days: inactiveDays,
    p_cooldown_days: REENGAGEMENT_COOLDOWN_DAYS,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReengagementCandidate[];
}

export function reengagementActionUrl(audience: ReengagementAudience): string {
  return `${SITE_URL}/dashboard?utm_source=email&utm_medium=email&utm_campaign=${REENGAGEMENT_CAMPAIGN}_${audience}`;
}

export function unsubscribePageUrl(token: string): string {
  return `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** RFC 8058 one-click unsubscribe headers (Gmail/Yahoo bulk-sender requirement). */
export function listUnsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Sample renders for the admin preview pane. */
export async function getReengagementPreviews() {
  const admin = await requireAdmin();
  const settings = await getAdminSettings();
  const base = {
    studentName: "Aarav Sharma",
    classLevel: 6,
    actionUrl: reengagementActionUrl("student"),
    unsubscribeUrl: unsubscribePageUrl("preview"),
  };
  return {
    adminEmail: admin.email,
    inactiveDays: settings.inactive_days_warning,
    neverStarted: buildReengagementEmail({ ...base, audience: "student", lastActiveAt: null, streakDays: 0 }),
    lapsed: buildReengagementEmail({ ...base, audience: "student", lastActiveAt: new Date().toISOString(), streakDays: 5 }),
    parent: buildReengagementEmail({ ...base, audience: "parent", lastActiveAt: new Date().toISOString(), streakDays: 5, actionUrl: reengagementActionUrl("parent") }),
  };
}
