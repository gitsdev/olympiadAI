// Server-side data for /admin/seo-agent/dashboard (RLS-checked, admin session).

import { seoDb, throwIfDbError } from "./db";
import { zonedDayRange, zonedMonthRange } from "./datetime";
import { summarizeUsage, type UsageRow, type UsageSummary } from "./usage";

type Db = Awaited<ReturnType<typeof seoDb>>;

export interface DashboardCounts {
  keywords: number;
  activeClusters: number;
  plannedArticles: number;
  draftArticles: number;
  awaitingReview: number;
  scheduledArticles: number;
  publishedArticles: number;
  backlinkOpportunities: number;
}

export interface AgentTaskSummary {
  id: string;
  agent_type: string;
  task_type: string;
  status: string;
  error: string | null;
  output_summary: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TomorrowArticle {
  /** Present once an article exists; otherwise only the plan is ready. */
  articleId: string | null;
  planId: string | null;
  title: string;
  primaryKeyword: string | null;
  status: string;
  seoScore: number | null;
  publishAt: string | null;
}

export interface SeoDashboardData {
  counts: DashboardCounts;
  avgContentScore: number | null;
  usageToday: UsageSummary;
  usageMonth: UsageSummary;
  recentTasks: AgentTaskSummary[];
  tomorrow: TomorrowArticle | null;
  tomorrowDate: string;
}

type CountFilter =
  | { op: "eq" | "neq"; column: string; value: string }
  | { op: "in"; column: string; value: string[] };

async function count(db: Db, table: string, filter?: CountFilter): Promise<number> {
  let q = db.from(table).select("id", { count: "exact", head: true });
  if (filter?.op === "eq") q = q.eq(filter.column, filter.value);
  else if (filter?.op === "neq") q = q.neq(filter.column, filter.value);
  else if (filter?.op === "in") q = q.in(filter.column, filter.value);
  const { count: n, error } = await q;
  throwIfDbError(error, `Counting ${table}`);
  return n ?? 0;
}

async function usageBetween(db: Db, start: Date, end: Date): Promise<UsageSummary> {
  const { data, error } = await db
    .from("seo_ai_usage")
    .select("category, estimated_cost, input_tokens, output_tokens")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  throwIfDbError(error, "Loading AI usage");
  return summarizeUsage((data ?? []) as UsageRow[]);
}

/**
 * Tomorrow's article: an article scheduled for tomorrow (in `tz`) wins;
 * otherwise a content plan dated tomorrow, joined to its newest article.
 */
async function findTomorrow(db: Db, start: Date, end: Date): Promise<TomorrowArticle | null> {
  const { data: art, error: artErr } = await db
    .from("seo_articles")
    .select("id, content_plan_id, title, primary_keyword, status, seo_score, scheduled_for")
    .gte("scheduled_for", start.toISOString())
    .lt("scheduled_for", end.toISOString())
    .neq("status", "ARCHIVED")
    .order("scheduled_for")
    .limit(1)
    .maybeSingle();
  throwIfDbError(artErr, "Loading tomorrow's article");
  if (art) {
    return {
      articleId: art.id, planId: art.content_plan_id, title: art.title, primaryKeyword: art.primary_keyword,
      status: art.status, seoScore: art.seo_score, publishAt: art.scheduled_for,
    };
  }

  const { data: plan, error: planErr } = await db
    .from("seo_content_plans")
    .select("id, title, primary_keyword, status, planned_publish_at, seo_articles(id, title, status, seo_score, created_at)")
    .gte("planned_publish_at", start.toISOString())
    .lt("planned_publish_at", end.toISOString())
    .not("status", "in", "(REJECTED,ARCHIVED)")
    .order("planned_publish_at")
    .limit(1)
    .maybeSingle();
  throwIfDbError(planErr, "Loading tomorrow's content plan");
  if (!plan) return null;

  type ArticleLite = { id: string; title: string; status: string; seo_score: number | null; created_at: string };
  const articles = ((plan as { seo_articles?: ArticleLite[] }).seo_articles ?? [])
    .filter((a) => a.status !== "ARCHIVED")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latest = articles[0];
  return {
    articleId: latest?.id ?? null,
    planId: plan.id,
    title: latest?.title ?? plan.title,
    primaryKeyword: plan.primary_keyword,
    status: latest?.status ?? plan.status,
    seoScore: latest?.seo_score ?? null,
    publishAt: plan.planned_publish_at,
  };
}

export async function getSeoDashboardData(tz: string, now = new Date()): Promise<SeoDashboardData> {
  const db = await seoDb();
  const today = zonedDayRange(now, tz, 0);
  const tomorrow = zonedDayRange(now, tz, 1);
  const month = zonedMonthRange(now, tz);

  const [
    keywords, activeClusters, plannedArticles, draftArticles, awaitingReview,
    scheduledArticles, publishedArticles, backlinkOpportunities,
    scoreRes, usageToday, usageMonth, tasksRes, tomorrowArticle,
  ] = await Promise.all([
    count(db, "seo_keywords", { op: "neq", column: "status", value: "ARCHIVED" }),
    count(db, "seo_keyword_clusters", { op: "eq", column: "status", value: "ACTIVE" }),
    count(db, "seo_content_plans", { op: "in", column: "status", value: ["IDEA", "PLANNED"] }),
    count(db, "seo_articles", { op: "eq", column: "status", value: "DRAFT" }),
    count(db, "seo_articles", { op: "in", column: "status", value: ["REVIEW", "REVIEW_REQUIRED"] }),
    count(db, "seo_articles", { op: "eq", column: "status", value: "SCHEDULED" }),
    count(db, "seo_articles", { op: "eq", column: "status", value: "PUBLISHED" }),
    count(db, "seo_backlink_prospects", { op: "eq", column: "status", value: "PROSPECT" }),
    db.from("seo_articles").select("seo_score").eq("status", "PUBLISHED").not("seo_score", "is", null),
    usageBetween(db, today.start, today.end),
    usageBetween(db, month.start, month.end),
    db.from("seo_agent_tasks")
      .select("id, agent_type, task_type, status, error, output_summary, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(10),
    findTomorrow(db, tomorrow.start, tomorrow.end),
  ]);

  throwIfDbError(scoreRes.error, "Loading content scores");
  throwIfDbError(tasksRes.error, "Loading agent tasks");
  const scores = ((scoreRes.data ?? []) as { seo_score: number }[]).map((r) => r.seo_score);

  return {
    counts: {
      keywords, activeClusters, plannedArticles, draftArticles, awaitingReview,
      scheduledArticles, publishedArticles, backlinkOpportunities,
    },
    avgContentScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    usageToday,
    usageMonth,
    recentTasks: (tasksRes.data ?? []) as AgentTaskSummary[],
    tomorrow: tomorrowArticle,
    tomorrowDate: tomorrow.date,
  };
}
