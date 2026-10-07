import "server-only";

// The scheduled jobs (spec §20, §45). Called by the /api/cron/* routes
// (service-role client, triggeredBy CRON) and by the admin "run now"
// buttons (triggeredBy USER). Each job takes a database lock, so two runs
// can't overlap, and logs one summary task; the AI steps it calls log their
// own tasks too.

import type { SupabaseClient } from "@supabase/supabase-js";
import { throwIfDbError } from "../db";
import { errorMessage, seoLog } from "../logger";
import { getSeoSettings } from "../settings-data";
import { zonedDayRange, zonedTimeToUtc, formatZoned } from "../datetime";
import { runPlainTask } from "../agents/run-task";
import { supabaseTaskStore } from "../agents/task-store";
import {
  analyzeKeywordsCore, generateArticleCore, linkSuggestionsCore, planOpportunityCore, seoCheckCore, type Actor,
} from "../pipeline";
import { buildPublishCheck, loadArticleForPublish, publishArticle } from "../publishing/publisher";
import { isRunDay, LINKS_CUTOFF_MS, nextStatusAfterGeneration, pickKeywords, SEO_CHECK_CUTOFF_MS } from "./rules";

export interface JobResult {
  ok: boolean;
  skipped?: string;
  summary: string;
  details?: Record<string, unknown>;
}

/** Runs `fn` only if the named lock is free; returns a "skipped" result otherwise. */
async function withLock(db: SupabaseClient, job: string, ttlSeconds: number, fn: () => Promise<JobResult>): Promise<JobResult> {
  const owner = `${job}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const { data: got, error } = await db.rpc("seo_try_acquire_lock", { p_job: job, p_ttl_seconds: ttlSeconds, p_owner: owner });
  if (error) throw new Error(`Lock error: ${error.message}`);
  if (!got) return { ok: true, skipped: "already-running", summary: `${job} is already running; skipped.` };
  try {
    return await fn();
  } finally {
    await db.rpc("seo_release_lock", { p_job: job, p_owner: owner });
  }
}

/**
 * Cleans up after crashed or timed-out runs, so nothing is left looking
 * "running" forever and claims can be retried.
 */
export async function housekeeping(db: SupabaseClient, now = new Date()): Promise<{ tasks: number; plans: number; articles: number }> {
  const taskCutoff = new Date(now.getTime() - 20 * 60_000).toISOString();
  const claimCutoff = new Date(now.getTime() - 15 * 60_000).toISOString();
  const [tasks, plans, articles] = await Promise.all([
    db.from("seo_agent_tasks").update({ status: "FAILED", completed_at: now.toISOString(), error: "Timed out or crashed: no completion was recorded." })
      .eq("status", "RUNNING").lt("started_at", taskCutoff).select("id"),
    db.from("seo_content_plans").update({ status: "PLANNED" }).eq("status", "GENERATING").lt("updated_at", claimCutoff).select("id"),
    db.from("seo_articles").update({ status: "DRAFT" }).eq("status", "GENERATING").lt("updated_at", claimCutoff).select("id"),
  ]);
  throwIfDbError(tasks.error, "Cleaning stale tasks");
  throwIfDbError(plans.error, "Cleaning stale plans");
  throwIfDbError(articles.error, "Cleaning stale articles");
  const out = { tasks: tasks.data?.length ?? 0, plans: plans.data?.length ?? 0, articles: articles.data?.length ?? 0 };
  if (out.tasks + out.plans + out.articles > 0) seoLog.warn("cron.housekeeping", out);
  return out;
}

// ── Publish due articles ─────────────────────────────────────────────────

export async function publishDueArticles(db: SupabaseClient, actor: Actor, now = new Date()): Promise<JobResult> {
  return withLock(db, "cron:publish-due", 270, async () => {
    const { data, error } = await db.from("seo_articles").select("id, title, scheduled_for")
      .eq("status", "SCHEDULED").lte("scheduled_for", now.toISOString()).order("scheduled_for").limit(10);
    throwIfDbError(error, "Loading due articles");
    const due = (data ?? []) as { id: string; title: string; scheduled_for: string }[];
    if (due.length === 0) return { ok: true, skipped: "nothing-due", summary: "No scheduled articles are due." };

    return runPlainTask<JobResult>(
      { agentType: "Scheduler", taskType: "publish_due", inputSummary: `${due.length} article(s) due`, triggeredBy: actor.triggeredBy, createdBy: actor.createdBy },
      { store: supabaseTaskStore(db) },
      async () => {
        const results: { id: string; title: string; ok: boolean; url?: string; error?: string }[] = [];
        for (const a of due) {
          // Each publish validates, takes its own lock and logs its own Publisher task.
          const r = await publishArticle(db, a.id, { actorId: actor.createdBy, triggeredBy: actor.triggeredBy });
          results.push(r.ok ? { id: a.id, title: a.title, ok: true, url: r.url } : { id: a.id, title: a.title, ok: false, error: r.error });
        }
        const published = results.filter((r) => r.ok).length;
        const summary = `Published ${published} of ${due.length}` + (published < due.length ? `; ${due.length - published} sent to review` : "");
        return {
          result: { ok: true, summary, details: { results } },
          outputSummary: summary,
        };
      },
    );
  });
}

// ── Tomorrow's article ───────────────────────────────────────────────────

const ACTIVE_PLAN = ["IDEA", "PLANNED"];

/**
 * Spec §20: make sure tomorrow (in the configured timezone) has an article
 * draft ready for review. Never publishes directly; in AUTO_PUBLISH mode it
 * schedules the draft only if every publishing check passes.
 */
export async function prepareTomorrowsArticle(db: SupabaseClient, actor: Actor, now = new Date()): Promise<JobResult> {
  return withLock(db, "cron:daily-article", 290, async () => {
    const started = Date.now();
    const settings = await getSeoSettings(db);
    const tz = settings.timezone;
    if (actor.triggeredBy === "CRON" && !isRunDay(settings.articleGenerationFrequency, now, tz)) {
      return { ok: true, skipped: "not-a-run-day", summary: `Article generation is ${settings.articleGenerationFrequency.toLowerCase()}; not running today.` };
    }
    const tomorrow = zonedDayRange(now, tz, 1);
    const startIso = tomorrow.start.toISOString();
    const endIso = tomorrow.end.toISOString();

    // Already prepared? An article dated tomorrow, or a plan for tomorrow that's past the IDEA/PLANNED stage.
    const [{ data: arts, error: aErr }, { data: plans, error: pErr }] = await Promise.all([
      db.from("seo_articles").select("id").gte("scheduled_for", startIso).lt("scheduled_for", endIso).not("status", "in", "(ARCHIVED,REJECTED)").limit(1),
      db.from("seo_content_plans").select("id, status, title").gte("planned_publish_at", startIso).lt("planned_publish_at", endIso)
        .not("status", "in", "(ARCHIVED,REJECTED)").order("planned_publish_at"),
    ]);
    throwIfDbError(aErr, "Checking tomorrow's articles");
    throwIfDbError(pErr, "Checking tomorrow's plans");
    const tomorrowPlans = (plans ?? []) as { id: string; status: string; title: string }[];
    if ((arts ?? []).length || tomorrowPlans.some((p) => !ACTIVE_PLAN.includes(p.status))) {
      return { ok: true, skipped: "already-prepared", summary: `Tomorrow (${tomorrow.date}) already has an article.` };
    }

    return runPlainTask<JobResult>(
      { agentType: "DailyArticle", taskType: "prepare_tomorrow", inputSummary: `Article for ${tomorrow.date} (${tz})`, triggeredBy: actor.triggeredBy, createdBy: actor.createdBy },
      { store: supabaseTaskStore(db) },
      async () => {
        const steps: string[] = [];
        let planId = tomorrowPlans.find((p) => ACTIVE_PLAN.includes(p.status))?.id ?? null;
        if (planId) steps.push("Used tomorrow's existing plan");

        if (!planId) {
          if (settings.contentPlanningFrequency === "OFF") {
            return { result: { ok: true, skipped: "planning-off", summary: "Nothing planned for tomorrow and automatic planning is off." }, outputSummary: "Nothing planned; automatic planning is off" };
          }
          let oppId = await oldestOpenOpportunity(db);
          if (!oppId) {
            // No open recommendations: analyse the highest-priority unclustered keywords first.
            const { data: kw, error } = await db.from("seo_keywords_overview").select("id, priority, created_at")
              .eq("status", "ACTIVE").eq("is_clustered", false).limit(200);
            throwIfDbError(error, "Loading keywords");
            const picked = pickKeywords((kw ?? []) as { id: string; priority: string; created_at: string }[], 10);
            if (picked.length === 0) {
              return { result: { ok: true, skipped: "no-keywords", summary: "No open recommendations and no unanalysed active keywords. Add keywords to keep the daily article going." }, outputSummary: "Nothing to write about: add keywords" };
            }
            const analysis = await analyzeKeywordsCore(db, settings, picked.map((k) => k.id), actor);
            steps.push(`Analysed ${picked.length} keyword(s) → ${analysis.clusters.length} cluster(s)`);
            oppId = await oldestOpenOpportunity(db);
            if (!oppId) {
              return { result: { ok: true, skipped: "no-opportunity", summary: "Keyword analysis found no new-article opportunity." }, outputSummary: steps.concat("No new-article opportunity").join("; ") };
            }
          }
          const publishAt = zonedTimeToUtc(tomorrow.date, settings.defaultPublishTime, tz);
          planId = (await planOpportunityCore(db, settings, oppId, actor, { publishAt })).planId;
          steps.push(`Planned for ${formatZoned(publishAt, tz)}`);
        }

        const { articleId, words } = await generateArticleCore(db, settings, planId, actor);
        steps.push(`Wrote ${words} words`);

        if (Date.now() - started < SEO_CHECK_CUTOFF_MS) {
          const seo = await seoCheckCore(db, settings, articleId, actor);
          steps.push(`SEO ${seo.score}/100${seo.critical.length ? ` (${seo.critical.length} critical)` : ""}`);
        } else steps.push("SEO check skipped (time budget); run it from the editor");
        if (Date.now() - started < LINKS_CUTOFF_MS) {
          const links = await linkSuggestionsCore(db, settings, articleId, actor);
          steps.push(`${links.added} link suggestion(s)`);
        } else steps.push("Link suggestions skipped (time budget)");

        // Quality gate + where the draft goes next.
        const full = await loadArticleForPublish(db, articleId);
        const validation = full ? await buildPublishCheck(db, full, settings.publishingMode) : null;
        const next = nextStatusAfterGeneration(settings.publishingMode, validation);
        const { data: planRow } = await db.from("seo_content_plans").select("planned_publish_at").eq("id", planId).maybeSingle();
        const publishAt = (planRow as { planned_publish_at: string | null } | null)?.planned_publish_at
          ?? zonedTimeToUtc(tomorrow.date, settings.defaultPublishTime, tz).toISOString();
        const patch: Record<string, unknown> = { status: next.status };
        if (next.status === "SCHEDULED") Object.assign(patch, { publish_authorization: "AUTO_PUBLISH", scheduled_for: publishAt });
        const { error: upErr } = await db.from("seo_articles").update(patch).eq("id", articleId);
        throwIfDbError(upErr, "Updating article status");
        await db.from("seo_content_plans").update({ status: next.status === "SCHEDULED" ? "SCHEDULED" : "REVIEW" }).eq("id", planId);
        steps.push(next.reason);

        const summary = steps.join("; ");
        seoLog.info("cron.daily_article", { articleId, status: next.status, elapsedMs: Date.now() - started });
        return {
          result: { ok: true, summary, details: { articleId, status: next.status } },
          entityId: articleId,
          outputSummary: summary,
        };
      },
    );
  });
}

async function oldestOpenOpportunity(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db.from("seo_content_opportunities").select("id")
    .eq("status", "OPEN").eq("type", "NEW_ARTICLE").in("cannibalization_risk", ["NONE", "LOW"])
    .order("created_at").limit(1).maybeSingle();
  throwIfDbError(error, "Loading opportunities");
  return (data as { id: string } | null)?.id ?? null;
}

/** Runs a job with housekeeping first; never throws (cron failures must not block the next run). */
export async function runCronJob(db: SupabaseClient, name: string, job: () => Promise<JobResult>): Promise<JobResult> {
  try {
    await housekeeping(db);
  } catch (err) {
    seoLog.error("cron.housekeeping_failed", { job: name, error: errorMessage(err) });
  }
  try {
    const r = await job();
    seoLog.info("cron.done", { job: name, ...r });
    return r;
  } catch (err) {
    seoLog.error("cron.failed", { job: name, error: errorMessage(err) });
    return { ok: false, summary: `${name} failed: ${errorMessage(err)}` };
  }
}
