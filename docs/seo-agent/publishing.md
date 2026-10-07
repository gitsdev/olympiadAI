# Approval, scheduling and publishing (Phase 6)

SEO Agent articles are published into OlympiadIQ's **existing blog**: the `blog_posts` table, served at `/blog/[slug]`, the same posts `/admin/blog` edits. There is no second blog and no external CMS.

## Workflow

```
DRAFT ──Submit──▶ REVIEW ──Approve──▶ APPROVED ──Schedule──▶ SCHEDULED ──(time reached / Publish now)──▶ PUBLISHED
  │                  │                    │  ▲                    │
  └──────Approve─────┘                    │  └──Unschedule────────┘
                                          └──Withdraw approval──▶ REVIEW (editable again; approval and schedule cleared)
Validation fails at publish time ──▶ REVIEW_REQUIRED (fix, then approve again)
Reject ──▶ REJECTED ──Reopen──▶ DRAFT
```

- **Approve** records `approved_by` + `approved_at` and `publish_authorization = MANUAL_APPROVAL`, and writes the admin audit log. It is refused while any blocking check fails (everything below except the approval itself).
- Approved and scheduled articles are **read-only**. **Withdraw approval to edit** sends one back to Review.
- **Schedule** takes a date and time in the configured timezone (default Asia/Kolkata), stores `scheduled_for` in UTC, and moves the plan's date to match. It must be at least 5 minutes ahead and within a year. Phase 7's cron publishes scheduled articles when their time arrives.
- **Publish now** runs the same pipeline immediately.
- The content plan's status follows the article (Approved, Scheduled, Published…), so the calendar stays accurate.

**Database guarantee:** the `seo_articles_requires_approval` constraint makes `APPROVED`/`SCHEDULED`/`PUBLISHED` impossible without an approval record, unless `publish_authorization = AUTO_PUBLISH`. Withdrawing approval while still `PUBLISHED` is also rejected. A test checks this against real Postgres.

## Publishing pipeline (`src/lib/seo-agent/publishing/publisher.ts`)

1. **Lock:** `seo_try_acquire_lock('publish:<id>')`, so a manual click and the cron can't publish twice.
2. **Authorization:** only `APPROVED`/`SCHEDULED` articles. In manual mode there must be an approval record.
3. **Validation** (`rules.ts → validateForPublish`; errors block, warnings don't):
   - required fields: title, valid slug, meta title, meta description, excerpt, category, at least 300 words
   - slug uniqueness against `blog_posts` (re-publishing over the article's own post is allowed)
   - internal links must point to pages that exist
   - image: https only, alt text required, reachable, and JPEG/PNG/WebP ≤ 5 MB
   - duplicate content: an identical published title, or ≥ 50% text overlap (5-word shingles) with any published post; 25–50% is a warning
   - SEO gate: in **AUTO_PUBLISH** mode a fresh SEO check with no critical items is required; in manual mode these are warnings (the approver decides)
4. **Image:** external featured images are copied into the `blog-images` Storage bucket, so the post doesn't depend on another server.
5. **Convert:** sanitized HTML → GFM Markdown (`markdown.ts`). Each CTA block becomes a bold headline, a line of text and a link on its own line, which the blog renders as a button. Internal CTA buttons open in the same tab without `sponsored`/`nofollow` (the small change to `src/components/blog/Markdown.tsx`; Amazon buttons are unchanged).
6. **Write:** insert the `blog_posts` row (or update it when re-publishing, keeping its URL and first-published date) with title, excerpt, content, cover, category, class (from the keyword), tags (primary + secondary keywords), SEO title/description, reading time, author "OlympiadIQ Team".
7. **Record:** article → `PUBLISHED` with `published_url` (`settings.blog_base_url + /slug`), `published_at` and `blog_post_id`; the plan → `PUBLISHED`; the primary keyword → `USED`.
8. **Revalidate** `/blog`, the sitemap and the admin pages, and **log** a `Publisher · publish` agent task.

If validation fails, **nothing is published**. The article moves to `REVIEW_REQUIRED`, and the task is logged as FAILED with the reasons.

The editor's **Publishing checks** card shows the same checklist (from the last saved version) before you approve or publish.

## Secure API: `POST /api/content/publish`

```http
POST /api/content/publish
Authorization: Bearer <BLOG_API_SECRET>
Content-Type: application/json

{ "articleId": "<uuid>" }
```

| Response | Meaning |
|---|---|
| `200 { ok: true, url, blogPostId }` | Published |
| `401` | Missing or wrong secret. Also returned if `BLOG_API_SECRET` isn't set or is shorter than 16 characters (fails closed) |
| `400` | Body isn't `{ articleId: uuid }` |
| `409 { ok: false, error }` | Not publishable right now (not approved, already being published…) |
| `422 { ok: false, error, issues, reviewRequired: true }` | Validation failed; article moved to Review required |

The secret is compared as SHA-256 digests in constant time. The route uses the service-role key server-side only. "Publish now" and the Phase 7 cron call the same `publishArticle()` function directly instead of going over HTTP.

## Setup

1. Run `supabase/migrations/016_seo_agent_images.sql`. It creates the public `blog-images` bucket (JPEG/PNG/WebP, 5 MB). Uploads only happen from server code with the service role.
2. Set `BLOG_API_SECRET` (e.g. `openssl rand -hex 32`) if you'll call the API from outside the app.
3. `next.config.ts` raises the server-action body limit to 6 MB for image uploads.

## Not in the MVP

Unpublishing and editing an already-published article from the SEO Agent: use `/admin/blog` to edit or unpublish the live post. Image generation from the AI prompt: upload an image or paste a URL.
