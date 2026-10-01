import { requireAdmin } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { CampaignId, CampaignSegment } from "@/lib/email/campaign-templates";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** A student won't get the same campaign again until this many days after the last one. */
export const CAMPAIGN_COOLDOWN_DAYS = 14;

export interface CampaignCounts {
  neverStarted: number;
  lapsed: number;
  active: number;
  recentlyEmailed: number;
  optedOut: number;
}

export interface CampaignCandidate {
  student_id: string;
  email: string;
  full_name: string;
  class_level: number;
  streak_days: number;
  total_points: number;
  last_active_at: string | null;
  unsubscribe_token: string;
}

export interface StudentEmailHistoryItem {
  campaign: string;
  sent_at: string;
  /** Sent within CAMPAIGN_COOLDOWN_DAYS, i.e. a bulk send would skip them. */
  within_cooldown: boolean;
}

export function dueCount(c: CampaignCounts): number {
  return c.neverStarted + c.lapsed + c.active;
}

export async function getCampaignCounts(campaign: CampaignId, segment: CampaignSegment, inactiveDays: number): Promise<CampaignCounts> {
  await requireAdmin();
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_campaign_counts", {
    p_campaign: campaign,
    p_segment: segment,
    p_inactive_days: inactiveDays,
    p_cooldown_days: CAMPAIGN_COOLDOWN_DAYS,
  });
  if (error) throw new Error(error.message);
  const row = (data as Record<string, number>[] | null)?.[0];
  return {
    neverStarted: Number(row?.never_started ?? 0),
    lapsed: Number(row?.lapsed ?? 0),
    active: Number(row?.active ?? 0),
    recentlyEmailed: Number(row?.recently_emailed ?? 0),
    optedOut: Number(row?.opted_out ?? 0),
  };
}

/** Next batch of students still due the campaign. Caller must have run requireAdmin(). */
export async function listCampaignCandidates(
  campaign: CampaignId, segment: CampaignSegment, inactiveDays: number, limit: number,
): Promise<CampaignCandidate[]> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_campaign_candidates", {
    p_campaign: campaign,
    p_segment: segment,
    p_inactive_days: inactiveDays,
    p_cooldown_days: CAMPAIGN_COOLDOWN_DAYS,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignCandidate[];
}

/** RFC 8058 one-click unsubscribe headers (Gmail/Yahoo bulk-sender requirement). */
export function listUnsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
