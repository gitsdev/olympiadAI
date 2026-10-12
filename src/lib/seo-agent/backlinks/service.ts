import "server-only";

// Backlink work: evaluate prospects, draft outreach, check tracked links.
// Callers authenticate first (requireAdmin for actions, CRON_SECRET for cron).

import type { SupabaseClient } from "@supabase/supabase-js";
import { throwIfDbError } from "../db";
import type { SeoSettings } from "../settings-schema";
import { createAIProvider } from "../ai";
import { runAgentTask, runPlainTask } from "../agents/run-task";
import { supabaseTaskStore } from "../agents/task-store";
import { evaluateBacklinkProspect, type BacklinkEvaluation } from "../agents/backlink-evaluator";
import { writeOutreach } from "../agents/outreach-writer";
import { getLinkCandidates } from "../content-data";
import { PipelineError, type Actor } from "../pipeline";
import { fetchPage } from "./safe-fetch";
import { findLinksTo, parsePage, type PageFacts } from "./page-parse";
import { nextBacklinkStatus, type BacklinkStatus, type LinkCheckResult } from "./model";

interface ProspectRow {
  id: string; website: string; url: string; topic: string | null; opportunity_type: string; contact_name: string | null;
  contact_email: string | null; notes: string | null; evaluation: (BacklinkEvaluation & { pageSummary?: PageSummary }) | null;
}
interface PageSummary { title: string; description: string; headings: string[] }

async function loadProspect(db: SupabaseClient, id: string): Promise<ProspectRow> {
  const { data, error } = await db.from("seo_backlink_prospects")
    .select("id, website, url, topic, opportunity_type, contact_name, contact_email, notes, evaluation").eq("id", id).maybeSingle();
  throwIfDbError(error, "Loading prospect");
  if (!data) throw new PipelineError("Prospect not found.");
  return data as ProspectRow;
}

async function readPage(url: string): Promise<PageFacts | { fetchError: string; url: string }> {
  const res = await fetchPage(url);
  if (!res.ok) return { fetchError: res.error, url: res.url };
  return parsePage(res.html, res.url);
}

/** Backlink Agent: fetch the page, judge it from what's actually there, save scores. */
export async function evaluateProspectCore(db: SupabaseClient, settings: SeoSettings, prospectId: string, actor: Actor): Promise<BacklinkEvaluation> {
  const p = await loadProspect(db, prospectId);
  const provider = createAIProvider(settings);
  const page = await readPage(p.url);

  return runAgentTask(
    {
      agentType: "BacklinkAgent", taskType: "evaluate_prospect", category: "BACKLINKS", entityType: "backlink_prospect", entityId: p.id,
      inputSummary: `${p.website} (${p.url}); page ${"fetchError" in page ? `not fetched: ${page.fetchError}` : `fetched, ${page.wordCount} words`}`,
      createdBy: actor.createdBy, triggeredBy: actor.triggeredBy,
    },
    { store: supabaseTaskStore(db), provider, pricing: settings.aiPricing },
    async ({ ai }) => {
      const evaluation = await evaluateBacklinkProspect(ai, {
        brand: settings.brand,
        prospect: { website: p.website, url: p.url, topic: p.topic, opportunityType: p.opportunity_type, notes: p.notes },
        page,
      });
      const pageSummary: PageSummary | undefined = "fetchError" in page ? undefined
        : { title: page.title, description: page.description, headings: page.headings.slice(0, 12) };
      const patch: Record<string, unknown> = {
        relevance_score: evaluation.relevanceScore,
        quality_score: evaluation.qualityScore,
        spam_risk: evaluation.spamRisk,
        evaluation: { ...evaluation, pageSummary },
      };
      if (p.opportunity_type === "OTHER") patch.opportunity_type = evaluation.suggestedOpportunityType;
      if (!p.contact_email && !("fetchError" in page) && page.emails[0]) patch.contact_email = page.emails[0];
      const { error } = await db.from("seo_backlink_prospects").update(patch).eq("id", p.id);
      if (error) throw new Error(`Saving evaluation: ${error.message}`);
      return {
        result: evaluation,
        outputSummary: `Relevance ${evaluation.relevanceScore}, quality ${evaluation.qualityScore}, spam risk ${evaluation.spamRisk} (${evaluation.confidence.toLowerCase()} confidence); traffic DATA_UNAVAILABLE`,
      };
    },
  );
}

/** Drafts an outreach email for a prospect (DRAFT; must be approved before it can be copied). */
export async function generateOutreachCore(db: SupabaseClient, settings: SeoSettings, prospectId: string, actor: Actor): Promise<{ messageId: string; warnings: string[] }> {
  const p = await loadProspect(db, prospectId);
  if (p.evaluation?.spamRisk === "HIGH") throw new PipelineError("This prospect was rated high spam risk; outreach isn't recommended.");
  const provider = createAIProvider(settings);
  const resources = (await getLinkCandidates(db, { targetClass: null, subject: null }))
    .filter((c) => c.kind !== "TOPIC_PAGE")
    .slice(0, 40)
    .map(({ url, title, summary }) => ({ url, title, summary }));

  return runAgentTask(
    {
      agentType: "OutreachWriter", taskType: "draft_outreach", category: "BACKLINKS", entityType: "backlink_prospect", entityId: p.id,
      inputSummary: `${p.website}; ${resources.length} resources to offer`, createdBy: actor.createdBy, triggeredBy: actor.triggeredBy,
    },
    { store: supabaseTaskStore(db), provider, pricing: settings.aiPricing },
    async ({ ai, taskId }) => {
      const msg = await writeOutreach(ai, {
        brand: settings.brand,
        prospect: { website: p.website, url: p.url, topic: p.topic, opportunityType: p.opportunity_type, contactName: p.contact_name },
        pageFacts: p.evaluation?.pageSummary ?? null,
        evaluation: p.evaluation ? { editorialFit: p.evaluation.editorialFit, recommendedApproach: p.evaluation.recommendedApproach } : null,
        resources,
      });

      const { data: existing } = await db.from("seo_outreach_campaigns").select("id").eq("prospect_id", p.id).neq("status", "CLOSED").limit(1).maybeSingle();
      let campaignId = (existing as { id: string } | null)?.id;
      if (!campaignId) {
        const { data, error } = await db.from("seo_outreach_campaigns")
          .insert({ prospect_id: p.id, name: `${p.website} outreach`, created_by: actor.createdBy }).select("id").single();
        throwIfDbError(error, "Creating campaign");
        campaignId = (data as { id: string }).id;
      }
      const { data: m, error: mErr } = await db.from("seo_outreach_messages")
        .insert({ campaign_id: campaignId, subject: msg.subject, body: msg.body, agent_task_id: taskId }).select("id").single();
      throwIfDbError(mErr, "Saving message");
      return {
        result: { messageId: (m as { id: string }).id, warnings: msg.warnings },
        outputSummary: `Draft "${msg.subject}"${msg.warnings.length ? ` | ${msg.warnings.length} warning(s)` : ""}`,
      };
    },
  );
}

// ── Link checks ──────────────────────────────────────────────────────────

interface BacklinkRow { id: string; source_url: string; target_url: string; status: BacklinkStatus; first_detected_at: string | null; anchor_text: string | null }

/** Fetches the source page and looks for our link. No AI involved. */
export async function checkBacklinkCore(db: SupabaseClient, backlinkId: string, now = new Date()): Promise<LinkCheckResult & { status: BacklinkStatus }> {
  const { data, error } = await db.from("seo_backlinks").select("id, source_url, target_url, status, first_detected_at, anchor_text").eq("id", backlinkId).maybeSingle();
  throwIfDbError(error, "Loading backlink");
  if (!data) throw new PipelineError("Backlink not found.");
  const b = data as BacklinkRow;

  const res = await fetchPage(b.source_url);
  let check: LinkCheckResult;
  if (!res.ok) {
    check = { found: false, anchorText: null, rel: [], followed: null, httpStatus: res.status, error: res.error, checkedUrl: res.url, checkedAt: now.toISOString() };
  } else {
    const page = parsePage(res.html, res.url);
    const match = findLinksTo(page.links, b.target_url)[0];
    check = {
      found: Boolean(match), anchorText: match?.anchorText ?? null, rel: match?.rel ?? [], followed: match ? match.followed : null,
      httpStatus: res.status, error: null, checkedUrl: res.url, checkedAt: now.toISOString(),
    };
  }
  const status = nextBacklinkStatus(b.status, check);
  const { error: upErr } = await db.from("seo_backlinks").update({
    last_check: check,
    last_checked_at: check.checkedAt,
    status,
    ...(check.found && !b.first_detected_at ? { first_detected_at: check.checkedAt } : {}),
    ...(check.found && !b.anchor_text && check.anchorText ? { anchor_text: check.anchorText } : {}),
  }).eq("id", b.id);
  throwIfDbError(upErr, "Saving link check");
  return { ...check, status };
}

/** Rechecks tracked links, least recently checked first (weekly cron / "Check all"). */
export async function checkTrackedBacklinks(db: SupabaseClient, actor: Actor, limit = 25): Promise<{ checked: number; active: number; lost: number; errors: number }> {
  const { data, error } = await db.from("seo_backlinks").select("id")
    .in("status", ["ACCEPTED", "PUBLISHED", "ACTIVE", "LOST"])
    .order("last_checked_at", { ascending: true, nullsFirst: true }).limit(limit);
  throwIfDbError(error, "Loading tracked backlinks");
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);

  return runPlainTask(
    { agentType: "BacklinkMonitor", taskType: "check_backlinks", inputSummary: `${ids.length} link(s) to check`, triggeredBy: actor.triggeredBy, createdBy: actor.createdBy },
    { store: supabaseTaskStore(db) },
    async () => {
      const out = { checked: 0, active: 0, lost: 0, errors: 0 };
      for (const id of ids) {
        try {
          const r = await checkBacklinkCore(db, id);
          out.checked++;
          if (r.status === "ACTIVE") out.active++;
          if (r.status === "LOST") out.lost++;
          if (r.error) out.errors++;
        } catch {
          out.errors++;
        }
      }
      return { result: out, outputSummary: `Checked ${out.checked}: ${out.active} active, ${out.lost} lost, ${out.errors} couldn't be fetched` };
    },
  );
}
