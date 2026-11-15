# Credit Wallet System

Prepaid credits for OlympiadIQ. Students buy credits through Razorpay (1 credit = ₹1, minimum 100) and spend them on credit-based features. Every new student gets 25 welcome credits, and credits never expire. Feature prices are set by admins at **/admin/credits/pricing**; none are hardcoded.

| Rule | Value | Where it lives |
|---|---|---|
| Credit value | 1 credit = ₹1 = 100 paise | `PAISE_PER_CREDIT` in `src/lib/credits/constants.ts` and `credit_create_purchase()` |
| Minimum purchase | 100 credits | `MIN_PURCHASE_CREDITS` |
| Maximum purchase | No business limit. A technical guard of 500,000 matches Razorpay's per-transaction cap | `MAX_PURCHASE_CREDITS` |
| Welcome credits | 25, once per student | `credit_grant_welcome()` default |
| Expiry | Never | — |
| Deduction | When a feature starts successfully | `chargeFeatureStart()` |
| Feature prices | Admin-configurable, initially unset | `feature_credit_costs` table |

## Files

**Database**
- `supabase/migrations/021_credit_wallet.sql`: tables, guards, functions and RLS
- `supabase/migrations/022_credit_wallet_backfill.sql`: one-time, idempotent welcome grant for existing students

**Service layer (`src/lib/credits/`)**

| File | Purpose |
|---|---|
| `constants.ts` | Business rules, labels and validation (client-safe) |
| `db.ts` | `CreditDb` interface (`.rpc` only) and the service-role client |
| `wallet.ts` | Balance, summary and the welcome grant |
| `pricing.ts` | Feature price list and admin update |
| `deduct.ts` | `deductCredits()` and its structured error responses |
| `refund.ts` | `reverseUsage()` (feature failed to start) and `refundPurchase()` (admin money refund) |
| `history.ts` | A student's own ledger and purchases (read through RLS) |
| `admin.ts` | Credit-admin authorization, reports, CSV export and adjustments |
| `purchase.ts` | Razorpay order creation, checkout verification, webhooks and reconciliation |
| `razorpay.ts` | REST client (no SDK dependency) and HMAC signature checks |
| `feature.ts` | The integration API for features (see [feature-integration.md](feature-integration.md)) |
| `api.ts`, `errors.ts`, `types.ts` | Route helpers and shared types |

**API routes**: `src/app/api/credits/**`, `src/app/api/admin/credits/**` and `src/app/api/cron/credits-reconcile`

**Student UI**
- `src/app/(student)/credits/` and `src/components/credits/`
- Balance chip in `TopBar.tsx`
- "My Credits" link in `Sidebar.tsx`
- `creditBalance` in `StudentContext`

**Admin UI**
- `src/app/admin/credits/**` and `src/components/admin/credits/`
- "Credits" link in `AdminSidebar.tsx`

**Other modified files**
- `src/lib/maintenance.ts`: the webhook is exempt from maintenance mode
- `vercel.json`: daily reconcile cron
- `src/app/(student)/layout.tsx`: loads the balance

**Tests**: `tests/credits/` (migration, payments, admin-auth)

## Database schema

All six requested tables exist with the requested columns, plus a few extras noted below.

| Table | Notes |
|---|---|
| `credit_wallets` | One row per user. `balance bigint CHECK (balance >= 0)`. A trigger rejects any balance change made outside `credit_apply()`, even by the service role. |
| `credit_transactions` | **Append-only ledger.** A trigger rejects UPDATE and DELETE. `idempotency_key` is UNIQUE. A partial unique index allows only one `welcome` row per user. A sign check enforces welcome/purchase > 0 and usage < 0; refund and admin_adjustment can be either sign. `user_id` uses ON DELETE SET NULL, so history survives account deletion. |
| `credit_purchases` | `razorpay_order_id` UNIQUE and `razorpay_payment_id` UNIQUE. Statuses: pending, paid, failed, refunded, partially_refunded. **Extra columns:** `currency`, `refunded_credits`, `refunded_paise`, `updated_at`. |
| `feature_credit_costs` | Seeded with `ai_tutor`, `mock_test`, `friend_battle` and `brain_booster`, all with **cost NULL and charging off**. A feature charges only when `is_enabled` is true and `credit_cost > 0`. |
| `credit_admins` | `super_admin` or `admin`. Existing platform admins are seeded as `super_admin`. See "Admin authorization" below. |
| `credit_webhook_events` | Dedupe and replay protection by Razorpay event id. **Extra columns:** `attempts`, `last_error`. |

### Functions

All functions are SECURITY DEFINER. EXECUTE is granted to `service_role` only and revoked from public, anon and authenticated.

| Function | What it does |
|---|---|
| `credit_apply(user, type, amount, idempotency_key, …)` | **The only way a balance changes.** Locks the wallet row with `SELECT … FOR UPDATE`, returns the original transaction if the key already exists, raises `INSUFFICIENT_CREDITS` rather than going negative, then updates the wallet and inserts the ledger row in one transaction. |
| `credit_grant_welcome(user)` | Grants 25 credits if `profiles.role = 'student'` and the user hasn't received them. Returns `granted`, `already_granted` or `not_eligible`. |
| `credit_deduct(user, feature_key, key, …)` | Reads the price. Returns `free` when charging is off or the cost is unset, otherwise charges. Returns JSON: `charged`, `duplicate`, `free`, `INSUFFICIENT_CREDITS`, `FEATURE_NOT_FOUND` or `NOT_ELIGIBLE`. |
| `credit_reverse_usage(user, usage_tx, reason, max_age)` | One reversal per charge, within a time window (60 minutes by default). |
| `credit_create_purchase`, `credit_fulfil_purchase`, `credit_mark_purchase_failed`, `credit_record_purchase_refund` | Purchase lifecycle. Fulfilment locks the purchase row, checks amount and currency against the server-created order, and credits exactly once (key `purchase:<order_id>`). |
| `credit_admin_adjust` | Manual adjustment. A reason is mandatory. Writes an `admin_adjustment` ledger row. |
| `credit_user_summary`, `credit_admin_overview`, `credit_admin_list_wallets`, `credit_list_unsettled_purchases`, `credit_recent_pending_count`, `credit_webhook_begin/finish` | Reporting and bookkeeping. |

### Welcome-credit eligibility

A trigger on `profiles` (after insert, or when `role` changes) calls `credit_grant_welcome()`. It fires for normal signups (`handle_new_user` inserts a `student` profile) and for any account later switched to `student`. It never fires for `platform_admin`, `parent`, `teacher` or `school_admin`. If the grant fails, it logs a warning and **never blocks signup**. Re-running `credit_grant_welcome()` repairs a missed grant.

### RLS

| Table | Student access |
|---|---|
| Wallets, transactions, purchases | SELECT only their own rows |
| `feature_credit_costs` | Readable by signed-in users |
| `credit_admins` | A user can read only their own row |
| `credit_webhook_events` | No access |

Students have no INSERT, UPDATE or DELETE path. Those table privileges are also revoked from `anon` and `authenticated`. Admin screens read through the service role, after server-side authorization.

## Admin authorization

The credit system builds on the **existing** admin model; there is no second admin system.

1. Every credit admin page and endpoint first requires `profiles.role = 'platform_admin'`. This is the same check `requireAdmin()` makes.
2. Money-moving actions also require a `credit_admins` row:

| Action | Role needed |
|---|---|
| View dashboards, reports and CSV export | any platform admin |
| Edit feature pricing; manual adjustments; refund a feature charge; reconcile | `admin` or `super_admin` |
| Refund a Razorpay purchase | `super_admin` |

A `credit_admins` row without `platform_admin` grants nothing. To give another admin credit powers:

```sql
insert into credit_admins (user_id, role) values ('<profile id>', 'admin');
```

Pricing changes, adjustments, refunds, reconcile runs and CSV exports are all written to the existing `admin_audit_log`.

## Razorpay configuration

1. **Dashboard → Account & Settings → API Keys.** Generate keys in **Test Mode** first. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. **Payment capture:** turn on automatic capture (Account & Settings → Payment Capture). If it stays off, the server captures authorized payments itself.
3. **Webhooks → Add new webhook:**
   - URL: `https://<your-domain>/api/credits/webhook`
   - Secret: a long random string (`openssl rand -hex 32`). Set it as `RAZORPAY_WEBHOOK_SECRET`.
   - Active events: `payment.captured`, `payment.failed`, `order.paid` and `refund.processed`. `payment.authorized` is optional.
4. Repeat steps 1–3 in **Live Mode** for production. Live keys and the live webhook secret are different from the test ones.
5. Test cards and UPI IDs: <https://razorpay.com/docs/payments/payments/test-card-upi-details/>

No `NEXT_PUBLIC_RAZORPAY_KEY_ID` is needed. The key id is returned by `create-order` and passed to Checkout. The secret never leaves the server.

### How a payment is completed

The paths below race safely. They all funnel into `credit_fulfil_purchase()`, which locks the purchase row and credits once.

1. **Checkout handler.** The browser posts `{order_id, payment_id, signature}` to `/purchase/verify`. The server checks the HMAC, **re-fetches the payment from Razorpay**, checks that the order id matches, and requires status `captured` (or captures an `authorized` payment). Only then does it fulfil. The browser's success claim is never trusted on its own.
2. **Webhook.** It completes the purchase even if the tab was closed. The signature is checked against the raw body, and events are deduplicated by `x-razorpay-event-id`. A failure returns 500 so Razorpay retries.
3. **Reconciliation.** It asks Razorpay `GET /orders/:id/payments` for every unsettled purchase. It runs:
   - when **My Credits** loads (the student's own purchases)
   - daily by cron (`/api/cron/credits-reconcile`)
   - on demand from the admin overview ("Reconcile payments")

   Unpaid orders older than 24 hours are closed as `failed`. A later successful retry on the same order still fulfils it.

Payment amounts are always computed on the server (`credits × 100` paise). Fulfilment refuses if the paid amount or currency differs from the order (`AMOUNT_MISMATCH`, recorded in the purchase metadata).

## Environment variables

| Variable | Scope | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | server | `rzp_test_…` / `rzp_live_…`. Sent to the browser per order (safe). |
| `RAZORPAY_KEY_SECRET` | **server only** | Signs Checkout and authorizes API calls. |
| `RAZORPAY_WEBHOOK_SECRET` | **server only** | Must match the secret set on the Razorpay webhook. |
| `NEXT_PUBLIC_SUPABASE_URL` | existing | Reused as is. A separate `SUPABASE_URL` is not needed. |
| `SUPABASE_SERVICE_ROLE_KEY` | existing, server only | Reused. Only imported from `server-only` modules. |
| `CRON_SECRET` | existing | Reused by the reconcile cron. |

If the Razorpay keys are missing, purchase endpoints return 503 ("Payments are not available right now"). The rest of the wallet, including balances, welcome credits and deductions, keeps working. Your existing `.env` files were not modified; add the three Razorpay variables to `.env.local` and to Vercel.

## API reference

Every endpoint returns JSON with `cache-control: no-store`. Errors look like `{ error, code?, … }`; internal errors are never exposed.

### Student endpoints (signed in, email verified)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/api/credits/balance` | `?summary=1` optional | `{ balance, summary? }` |
| GET | `/api/credits/pricing` | — | `{ features: [{ featureKey, featureName, creditCost }] }` (charging features only) |
| GET | `/api/credits/history` | `kind=transactions\|purchases`, `page`, `pageSize` (≤100), `type` | `{ rows, page, pageSize, totalCount }` |
| POST | `/api/credits/purchase/create-order` | `{ credits }` (students only) | `{ purchaseId, orderId, keyId, credits, amountPaise, currency, prefill }`. 400 below 100 · 429 if more than 10 unpaid orders in an hour · 503 if not configured |
| POST | `/api/credits/purchase/verify` | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | `{ status: "paid", credits, balance }`, `{ status: "processing" }` or `{ status: "failed" }`. 400 bad signature or order mismatch |
| POST | `/api/credits/purchase/reconcile` | — | `{ checked, fulfilled }` |
| POST | `/api/credits/deduct` | `{ featureKey, idempotencyKey, referenceId? }` (students only) | 200 `{ status: "charged"\|"duplicate"\|"free", cost, balance, transactionId }`. 402 `{ code: "INSUFFICIENT_CREDITS", required, balance, shortfall, buyUrl }` |

### Webhook

| Method | Path | Notes |
|---|---|---|
| POST | `/api/credits/webhook` | Razorpay only. Returns 401 for a bad signature and 200 for processed, duplicate or ignored events. |

### Admin endpoints (platform admin; extra credit role where noted)

| Method | Path | Role | Body / query |
|---|---|---|---|
| GET | `/api/admin/credits/dashboard` | viewer | — |
| GET | `/api/admin/credits/students` | viewer | `q`, `page`, `pageSize`; or `userId` for one student's summary and ledger |
| GET | `/api/admin/credits/transactions` | viewer | `from`, `to` (YYYY-MM-DD, India time), `student`, `q`, `feature`, `type`, `page`, `pageSize`, `format=csv` |
| GET | `/api/admin/credits/purchases` | viewer | `from`, `to`, `student`, `q` (name, email, `order_…` or `pay_…`), `status`, `format=csv` |
| GET / POST | `/api/admin/credits/pricing` | viewer / admin | POST `{ featureKey, featureName, creditCost (int ≥0 or null), isEnabled }`. Enabling requires cost > 0. |
| POST | `/api/admin/credits/adjust` | admin | `{ userId, amount (±int), reason (≥3 chars), idempotencyKey }` |
| POST | `/api/admin/credits/refund` | admin / super_admin | `{ usageTransactionId, reason }` (admin) or `{ purchaseId, credits?, reason, allowShortfall? }` (super_admin; refunds money through Razorpay) |
| POST | `/api/admin/credits/reconcile` | admin | — |

CSV exports are capped at 5,000 rows; the `x-export-truncated` header reports whether the cap was hit.

## Test results

Run with `npx vitest run tests/credits`. **59 tests, all passing.** Full suite: 404 passed, 6 skipped (the existing opt-in live AI tests). `tsc --noEmit` and `next build` both pass.

The tests run the real migrations on PGlite (in-memory Postgres) and the real service code against a simulated Razorpay API.

| # | Requirement | Test |
|---|---|---|
| 1 | New student gets 25 welcome credits | migration › welcome credits 1 |
| 2 | Welcome credits can't be granted twice | migration › 2 (function, role flip, direct insert) |
| 3 | Existing-student migration works | migration › 3 (backfill once; skips admins; re-run is a no-op) |
| 4 | Purchase below 100 is rejected | payments › 4 (no Razorpay order created) |
| 5 | 100 credits → ₹100 order | payments › 5 |
| 6 | 500 credits → ₹500 order | payments › 6 |
| 7 | Failed payment doesn't credit | payments › 7 and migration › 7 |
| 8 | Successful payment credits exactly once | payments › 8 (checkout + repeat + webhook) |
| 9 | Duplicate webhook doesn't double-credit | payments › 9 (same event, and `order.paid` for the same payment) |
| 10 | Browser closure doesn't block fulfilment | payments › 10 (webhook only) + reconciliation |
| 11 | Student can't modify the wallet | migration › 11 (10 direct-write attempts as the `authenticated` role) |
| 12 | Insufficient balance blocks the start | migration › 12 |
| 13 | Correct price is deducted | migration › 13 |
| 14 | Repeated request doesn't double-deduct | migration › 14 |
| 15 | Concurrency can't go negative | migration › 15 (see limitation below) |
| 16 | Unauthorized admin requests are rejected | admin-auth › 16 (real route handlers: signed out, student, admin without a credit role) |
| 17 | Manual adjustments create ledger entries | migration › 17 |
| 18 | Refunds create reversal entries | migration › 18 and payments › 18 (Razorpay refund + webhook no-op) |
| 19 | Disabled features consume nothing | migration › 19 |
| 20 | Balances and ledgers stay consistent | migration › 20 and payments › 20 |

**Limitation for #15:** PGlite has a single connection, so the "burst" test runs serially. Under real concurrency the guarantee comes from the `FOR UPDATE` row lock plus `CHECK (balance >= 0)`; the test confirms the CHECK rejects a negative balance outright. To exercise true parallelism, run [`concurrency-check.sql`](concurrency-check.sql) against a **staging** Supabase project from two SQL sessions.

**Not yet done:** the Razorpay Test Mode end-to-end run (real Checkout, real webhook delivery) needs your test keys and a deployed URL. See the checklist below.

## Production deployment checklist

- [ ] Review `021_credit_wallet.sql` and `022_credit_wallet_backfill.sql`. **Neither has been applied to any database.**
- [ ] Apply both to a **staging** project first (SQL editor, 021 then 022). Check the backfill notice (granted / skipped counts).
- [ ] Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` (test mode) to `.env.local` and Vercel Preview.
- [ ] Create the test-mode webhook pointing at the preview URL.
- [ ] Test in Razorpay Test Mode:
  - [ ] Buy 100 credits.
  - [ ] Buy a custom amount.
  - [ ] Fail a payment.
  - [ ] Pay, then close the tab before the success screen; the credits should arrive via the webhook.
  - [ ] Refund from the admin panel.
  - [ ] Refund from the Razorpay dashboard; it should be recorded via the webhook.
- [ ] Optionally run `concurrency-check.sql` on staging.
- [ ] Check which admins should have `credit_admins` rows (all current platform admins start as `super_admin`).
- [ ] Apply 021 and then 022 to **production**.
- [ ] Switch Vercel Production to live keys and create the live webhook.
- [ ] Make one small live purchase and refund it.
- [ ] Confirm the `/api/cron/credits-reconcile` cron appears in Vercel (daily at 01:15 UTC).
- [ ] Only then set prices and enable charging per feature at **/admin/credits/pricing**, after the feature has been wired in (see [feature-integration.md](feature-integration.md)).
