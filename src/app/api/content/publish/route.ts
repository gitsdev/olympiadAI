// POST /api/content/publish (spec §22): the secure publishing interface.
// Auth: Authorization: Bearer $BLOG_API_SECRET. Body: { "articleId": "<uuid>" }.
// Publishes an approved/scheduled SEO article into the blog after full
// validation; on validation failure nothing is published and the article
// moves to REVIEW_REQUIRED.

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyBearer } from "@/lib/seo-agent/publishing/auth";
import { publishArticle } from "@/lib/seo-agent/publishing/publisher";
import { errorMessage, seoLog } from "@/lib/seo-agent/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ articleId: z.uuid() });

export async function POST(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"), process.env.BLOG_API_SECRET)) {
    seoLog.warn("publish_api.unauthorized");
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "Body must be { articleId: <uuid> }." }, { status: 400 });

  try {
    const result = await publishArticle(createServiceClient(), parsed.data.articleId, { actorId: null, triggeredBy: "SYSTEM" });
    if (result.ok) return Response.json({ ok: true, url: result.url, blogPostId: result.blogPostId });
    return Response.json(
      { ok: false, error: result.error, issues: result.issues, reviewRequired: result.reviewRequired },
      { status: result.reviewRequired ? 422 : 409 },
    );
  } catch (err) {
    seoLog.error("publish_api.failed", { error: errorMessage(err) });
    return Response.json({ ok: false, error: "Publishing failed." }, { status: 500 });
  }
}
