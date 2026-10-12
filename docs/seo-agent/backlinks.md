# Backlinks (spec §26–29)

A small, manual-first system for **legitimate, editorially earned** links. The agent never creates links, never contacts anyone by itself, and never crawls sites in bulk.

## Pages

| Page | Route | What it does |
|---|---|---|
| Opportunities | `/admin/seo-agent/backlinks` | Prospects you add one at a time: URL, topic, opportunity type, contact, status, notes. Filter by status, search. |
| Opportunity detail | `/admin/seo-agent/backlinks/[id]` | **Evaluate**, outreach drafts, and backlinks from that site. |
| Outreach | `/admin/seo-agent/backlinks/outreach` | Every draft across prospects (Draft / Approved / Copied). |
| Backlink Tracker | `/admin/seo-agent/backlinks/tracker` | Tracked links: source URL, target URL, anchor text, first detected, last checked (with the result), status. **Check now** / **Check all**. |

Opportunity types: `GUEST_CONTRIBUTION`, `RESOURCE_PAGE`, `EDUCATION_DIRECTORY`, `TEACHER_RESOURCE`, `PARENTING_RESOURCE`, `EDUCATIONAL_COLLABORATION`, `EXPERT_CONTRIBUTION`, `BROKEN_LINK`, `OTHER`.
Statuses: `PROSPECT → CONTACTED → RESPONDED → ACCEPTED → PUBLISHED → ACTIVE`, or `LOST` / `REJECTED`.

## Backlink Agent (§27): `agents/backlink-evaluator.ts`

**Evaluate** fetches the prospect's page (see *Safe fetching*), extracts facts (title, description, headings, readable text, link counts, contact emails, "write for us" / resources signals, spam terms) and asks Claude to score:
- **relevance** and **quality** (0–100), judged only from what's on the page
- editorial fit, content quality and a recommended approach
- **spam risk**: LOW, MEDIUM, HIGH or `DATA_UNAVAILABLE`, with the signals behind it

**No invented metrics:** there's no domain authority, traffic or backlink-count data source connected, so:
- `estimatedTraffic` is **always** `DATA_UNAVAILABLE`, overwritten in code whatever the model returns
- if the page can't be read, spam risk becomes `DATA_UNAVAILABLE` (unless clearly HIGH) and confidence is LOW
- code-detected signals (gambling/adult terms, "buy a backlink" / sponsored-post language, huge link counts with little content) can only raise the risk, never lower it

Saved to `seo_backlink_prospects` (scores, spam risk, `evaluation` JSON). An `OTHER` type is replaced by the suggested type, and a contact email found on the page fills an empty contact field. Logged as `BacklinkAgent · evaluate_prospect`, usage category `BACKLINKS`. Measured live: ~10–15 s, a couple of cents.

## Outreach (§28): `agents/outreach-writer.ts`

**Generate outreach** drafts an email with: subject, personalised opening, reason for contacting, suggested contribution, one OlympiadIQ resource, and a low-pressure call to action, plus a fixed sign-off.
- Personalisation may use **only** the fetched page's title, description and headings; no pretending to have read things.
- The resource URL is restricted (in the output schema) to real OlympiadIQ pages: published posts and feature pages.
- The prompt forbids payment, link exchanges, "dofollow" asks and anchor-text demands. Any such wording that slips through is flagged as a warning.
- Prospects rated HIGH spam risk can't get outreach.

**Workflow:** Draft (editable) → **Approve** (recorded: who and when, audit-logged) → **Copy message** (to the clipboard; status COPIED) → you send it from your own email → **Mark as contacted**. Nothing is ever sent by the system. The database refuses `APPROVED`/`COPIED`/`SENT` without an approval record (migration 017). **Reopen to edit** returns a message to Draft and clears its approval.

## Backlink tracker (§29)

**Check** fetches the source page once and looks for a link to the target URL (same host, `www`-insensitive, trailing slash ignored). It records whether the link was found, its anchor text, its `rel` (nofollow / sponsored / ugc are shown as "not followed"), the HTTP status and any error. Status rules (`nextBacklinkStatus`):
- found → `ACTIVE`, and `first_detected_at` is set the first time
- live (`ACTIVE`/`PUBLISHED`) but missing, or the page returns 404/410 → `LOST`
- a temporary fetch error doesn't mark a live link `LOST`

**Weekly recheck:** `GET /api/cron/backlinks` (Vercel Cron, `0 3 * * *` ≈ 08:30 IST daily, valid on Hobby) runs on the day set in **Settings → Backlink checking** (Weekly = Mondays, Daily, or Off). It checks up to 25 links, least recently checked first. It is protected by `CRON_SECRET`, uses a lock, and logs `BacklinkMonitor · check_backlinks`.

## Safe fetching (`backlinks/safe-fetch.ts`, `url-safety.ts`)

Admin-entered URLs are fetched from our server, so:
- only `http`/`https` on default ports, and no credentials in the URL
- the host must resolve only to public IPs: loopback, private, link-local (incl. the cloud metadata address 169.254.169.254), CGNAT, multicast and reserved ranges are refused
- redirects are followed manually (at most 3), and each hop is re-checked
- 10-second timeout, HTML only, at most ~1.5 MB read
- identifies itself as `OlympiadIQ-SEO-Agent/1.0 (+https://www.olympiadiq.in)`

Verified live: the metadata IP and `localhost` are refused. (DNS can change between the check and the fetch; acceptable for an admin-only tool.)

## Setup

Run `supabase/migrations/017_seo_backlinks.sql` (after 013–016). It adds the `last_check` column, URL checks, a uniqueness rule on source → target, and the outreach approval constraint.
