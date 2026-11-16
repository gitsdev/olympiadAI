# Connecting a feature to credits

None of the existing features (AI Tutor, Mock Tests, Battle, Brain Booster, Question Paper Solver) has been changed yet. All five are registered in `feature_credit_costs` with no price and charging off, so they stay free until you do the steps below **and** enable charging in **/admin/credits/pricing**.

## The rule

1. Run the feature's own checks first: auth, validation, quotas, question availability.
2. **Charge**: call `chargeFeatureStart()` right before the session actually starts.
3. Start the session.
4. If the start fails **before the student got anything**, call `refundFailedStart()`.
5. Never refund a session that ran. Completed sessions are not refunded automatically.

```ts
import { chargeFeatureStart, refundFailedStart } from "@/lib/credits/feature";
import { deductErrorResponse } from "@/lib/credits/deduct";

// …after auth + validation pass:
const charge = await chargeFeatureStart({
  userId: user.id,
  featureKey: "mock_test",
  sessionKey: attemptId,          // stable per start: retries never double-charge
  referenceId: attemptId,
});
if (!charge.ok) {
  const { status, body } = deductErrorResponse(charge);  // 402 with required/balance/shortfall/buyUrl
  return Response.json(body, { status });
}
// charge.status is "charged", "duplicate" (same sessionKey again; not charged twice) or "free"

try {
  await startTheSession();
} catch (err) {
  if (charge.transactionId) {
    await refundFailedStart({ userId: user.id, transactionId: charge.transactionId, reason: "session failed to start" });
  }
  throw err;
}
```

`refundFailedStart()` is idempotent (one reversal per charge) and only works within 60 minutes of the charge. **It is deliberately server-only.** There is no student-facing reversal endpoint, because one would let a student refund a session they had already used. Admins can refund any charge from the student's wallet page.

## Choosing the `sessionKey`

The key must identify one start of the feature, so a network retry or a double-click reuses it.

| Feature | Suggested key | Where to charge |
|---|---|---|
| `mock_test` | the new `test_attempts.id` (create the attempt row first, then charge) | `src/actions/assessment.ts`, after questions are generated and before they're returned |
| `ai_tutor` | the conversation id (charge per new conversation), or `conversationId:messageIndex` (charge per message) | `src/app/api/tutor/route.ts`, before calling the model |
| `friend_battle` | the battle id, charged per participant when the battle starts | `src/actions/battle.ts`, when the battle moves to in-progress |
| `brain_booster` | a `crypto.randomUUID()` generated when the game starts | the game component calls `POST /api/credits/deduct` (the games run client-side) |
| `question_paper_solver` | the `qps_jobs.id` (one charge per paper) | `src/app/api/question-paper/jobs/[id]/start/route.ts`, after the upload is checked and before the worker is kicked. Refund with `refundFailedStart()` if extraction fails before any answers are produced |

Charge granularity (per conversation vs per message, per battle vs per round) is a product decision; the service supports either.

## Handling "not enough credits" in the UI

Both the endpoint and `deductErrorResponse()` return:

```json
{ "error": "You need 10 credits to start this, but you have 4.", "code": "INSUFFICIENT_CREDITS",
  "required": 10, "balance": 4, "shortfall": 6, "buyUrl": "/credits" }
```

Show the message with a "Buy credits" button linking to `buyUrl`. After a charge, call `router.refresh()` so the balance chip in the top bar updates.

## Showing the price before starting

`GET /api/credits/pricing` lists the features that currently charge and their cost. A feature missing from the list is free right now.

## Who can be charged

Only accounts with `profiles.role = 'student'`. Admins and parents get `NOT_ELIGIBLE` (403) when a feature is charging. If admins need to try paid features, skip the charge for `platform_admin` in the feature code.
