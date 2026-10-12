import "server-only";

import { seoDb, throwIfDbError } from "../db";
import { escapeLike } from "../keywords-data";
import type { BacklinkEvaluation } from "../agents/backlink-evaluator";
import type { LinkCheckResult } from "./model";

export interface ProspectRow {
  id: string;
  website: string;
  url: string;
  topic: string | null;
  relevanceScore: number | null;
  qualityScore: number | null;
  spamRisk: string;
  opportunityType: string;
  contactName: string | null;
  contactEmail: string | null;
  contactUrl: string | null;
  status: string;
  notes: string | null;
  evaluated: boolean;
  createdAt: string;
}

type RawProspect = {
  id: string; website: string; url: string; topic: string | null; relevance_score: number | null; quality_score: number | null;
  spam_risk: string; opportunity_type: string; contact_name: string | null; contact_email: string | null; contact_url: string | null;
  status: string; notes: string | null; evaluation: BacklinkEvaluation | null; created_at: string;
};
const PROSPECT_COLS = "id, website, url, topic, relevance_score, quality_score, spam_risk, opportunity_type, contact_name, contact_email, contact_url, status, notes, evaluation, created_at";
const toProspect = (r: RawProspect): ProspectRow => ({
  id: r.id, website: r.website, url: r.url, topic: r.topic, relevanceScore: r.relevance_score, qualityScore: r.quality_score,
  spamRisk: r.spam_risk, opportunityType: r.opportunity_type, contactName: r.contact_name, contactEmail: r.contact_email,
  contactUrl: r.contact_url, status: r.status, notes: r.notes, evaluated: Boolean(r.evaluation), createdAt: r.created_at,
});

export async function listProspects(f: { status?: string; type?: string; q?: string }): Promise<ProspectRow[]> {
  const db = await seoDb();
  let q = db.from("seo_backlink_prospects").select(PROSPECT_COLS);
  if (f.status) q = q.eq("status", f.status);
  if (f.type) q = q.eq("opportunity_type", f.type);
  if (f.q) {
    const term = escapeLike(f.q).replace(/[,()]/g, " ");
    q = q.or(`website.ilike.%${term}%,url.ilike.%${term}%,topic.ilike.%${term}%`);
  }
  const { data, error } = await q.order("created_at", { ascending: false }).limit(300);
  throwIfDbError(error, "Loading prospects");
  return ((data ?? []) as RawProspect[]).map(toProspect);
}

export interface OutreachMessageRow {
  id: string;
  subject: string;
  body: string;
  status: string;
  approvedAt: string | null;
  createdAt: string;
  prospect: { id: string; website: string } | null;
}

type RawMessage = {
  id: string; subject: string; body: string; status: string; approved_at: string | null; created_at: string;
  seo_outreach_campaigns: { seo_backlink_prospects: { id: string; website: string } | null } | null;
};
const toMessage = (m: RawMessage): OutreachMessageRow => ({
  id: m.id, subject: m.subject, body: m.body, status: m.status, approvedAt: m.approved_at, createdAt: m.created_at,
  prospect: m.seo_outreach_campaigns?.seo_backlink_prospects ?? null,
});

export interface BacklinkRow {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  anchorText: string | null;
  status: string;
  firstDetectedAt: string | null;
  lastCheckedAt: string | null;
  lastCheck: LinkCheckResult | null;
  notes: string | null;
  prospectId: string | null;
}
type RawBacklink = {
  id: string; source_url: string; target_url: string; anchor_text: string | null; status: string; first_detected_at: string | null;
  last_checked_at: string | null; last_check: LinkCheckResult | null; notes: string | null; prospect_id: string | null;
};
const BACKLINK_COLS = "id, source_url, target_url, anchor_text, status, first_detected_at, last_checked_at, last_check, notes, prospect_id";
const toBacklink = (b: RawBacklink): BacklinkRow => ({
  id: b.id, sourceUrl: b.source_url, targetUrl: b.target_url, anchorText: b.anchor_text, status: b.status,
  firstDetectedAt: b.first_detected_at, lastCheckedAt: b.last_checked_at, lastCheck: b.last_check, notes: b.notes, prospectId: b.prospect_id,
});

export interface ProspectDetail extends ProspectRow {
  evaluation: (BacklinkEvaluation & { pageSummary?: { title: string; description: string; headings: string[] } }) | null;
  messages: OutreachMessageRow[];
  backlinks: BacklinkRow[];
}

export async function getProspect(id: string): Promise<ProspectDetail | null> {
  const db = await seoDb();
  const [p, msgs, links] = await Promise.all([
    db.from("seo_backlink_prospects").select(PROSPECT_COLS).eq("id", id).maybeSingle(),
    db.from("seo_outreach_messages")
      .select("id, subject, body, status, approved_at, created_at, seo_outreach_campaigns!inner(prospect_id, seo_backlink_prospects(id, website))")
      .eq("seo_outreach_campaigns.prospect_id", id).order("created_at", { ascending: false }),
    db.from("seo_backlinks").select(BACKLINK_COLS).eq("prospect_id", id).order("created_at", { ascending: false }),
  ]);
  throwIfDbError(p.error, "Loading prospect");
  throwIfDbError(msgs.error, "Loading outreach");
  throwIfDbError(links.error, "Loading backlinks");
  if (!p.data) return null;
  const raw = p.data as RawProspect;
  return {
    ...toProspect(raw),
    evaluation: raw.evaluation as ProspectDetail["evaluation"],
    messages: ((msgs.data ?? []) as unknown as RawMessage[]).map(toMessage),
    backlinks: ((links.data ?? []) as RawBacklink[]).map(toBacklink),
  };
}

export async function listOutreachMessages(status?: string): Promise<OutreachMessageRow[]> {
  const db = await seoDb();
  let q = db.from("seo_outreach_messages").select("id, subject, body, status, approved_at, created_at, seo_outreach_campaigns(seo_backlink_prospects(id, website))");
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  throwIfDbError(error, "Loading outreach");
  return ((data ?? []) as unknown as RawMessage[]).map(toMessage);
}

export async function listBacklinks(status?: string): Promise<BacklinkRow[]> {
  const db = await seoDb();
  let q = db.from("seo_backlinks").select(BACKLINK_COLS);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
  throwIfDbError(error, "Loading backlinks");
  return ((data ?? []) as RawBacklink[]).map(toBacklink);
}
