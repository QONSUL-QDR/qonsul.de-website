# Phase 3c / Phase 4 Production Contract Test Plan (against the already-live Cockpit production)

Status: **READY as a plan. Not executed** — requires `PRODUCTION_READY=true` on the Website side and either a deployed production Worker or an equivalent local run configured with the real production `QONSUL_COCKPIT_INTAKE_SECRET`, neither of which exist yet in an accessible form this session (`PRODUCTION HMAC SYNCHRONIZATION REQUIRED` status — see below).

Cockpit production (`687a2b8b88c53dc3ce703232b8bd29fd42656c73`) is reported accepted for Phase 3c and Phase 4 (`REPORTED BY CODEX – NOT IN CLAUDE SCOPE`). This plan tests the **Website side's** ability to talk to it correctly — it does not re-verify Cockpit's own internals.

## Precondition check (do this before attempting any contract test)

1. `PRODUCTION_READY` must be `'true'` on whatever Website instance runs the test — `lib/crm.ts` returns `'not_configured'` and never calls Cockpit otherwise (verified in code this session).
2. `QONSUL_COCKPIT_INTAKE_URL` must be `https://cockpit.qonsul.de` (or the production value, if different).
3. `QONSUL_COCKPIT_INTAKE_SECRET` must be set and ≥32 characters, and — per the standing instruction — must be the **existing** production HMAC, never freshly generated here.

## Step 0 — HMAC synchronization check (before any payload test)

Per the standing instruction: do not read the secret's value, do not regenerate it. Once Cloudflare access exists:

```
wrangler secret list   # (against the production Worker, once identified) — confirms presence by NAME only
```

- If `QONSUL_COCKPIT_INTAKE_SECRET` is listed as present → proceed to Step 1, using it functionally (never reading its value) via the signed request the app itself constructs.
- If absent, or if the Worker itself doesn't exist yet → mark `PRODUCTION HMAC SYNCHRONIZATION REQUIRED` and **skip to Step 1 only once this is resolved** (per the standing instruction, this single item does not block the rest of pre-cutover work, but it does block this specific contract test).

## Step 1 — Contact intake contract test

Reuse the exact synthetic-data convention already established in `tests/contracts/phase3c/contact.json` and `scripts/check-cockpit-intake.mjs` (Ada Lovelace / Example GmbH, all-zero UUID pattern) — **but with a new, distinct `source_event_id`** for the production environment specifically, so it can't collide with any staging-run event sharing the same ID in Cockpit's idempotency store:

- Suggested production test ID: `00000000-0000-4000-8000-000000000101` (contact) — clearly synthetic, distinguishable from the staging fixture's `...0001`.
- Trigger via the real code path (`syncContactLead` in `lib/crm.ts`), not a hand-rolled HTTP request, so the exact signature/header construction the production app actually uses is what's being tested.

**Expected result:** `send()` returns `'sent'`, `contact_requests.crm_status` updates to `sent` in D1. **Pass criterion:** `sent`, not `needs_review` or `pending`. **Failure implications:**
- `needs_review` immediately (non-transient `IntakeDeliveryError`) → likely signature mismatch (`PRODUCTION HMAC SYNCHRONIZATION REQUIRED`) or Cockpit rejecting the payload shape — check Cockpit-side logs (`REPORTED BY CODEX`).
- `pending` (transient) → Cockpit temporarily unavailable; retry once cleanly rather than treating as a hard failure (matches `lib/cockpit-intake-client.ts`'s own transient/non-transient distinction).

## Step 2 — Ishikawa intake contract test

Same approach, reusing `tests/contracts/phase3c/ishikawa.json`'s shape with a new production-distinct `source_event_id` (suggested: `...0102`) and cause id (suggested: `...0103`), triggered via `syncLead` in `lib/crm.ts`.

**Expected/pass/failure:** identical structure to Step 1, checked against the `reports` table's `crm_status` instead.

## Step 3 — Retry idempotency

The existing unit test (`check-cockpit-intake.mjs`) already proves the Website's own retry logic sends the same `source_event_id`/`X-Request-ID` across attempts against a mocked endpoint. The production-specific check is whether **Cockpit's real idempotency handling** treats a genuine re-delivery (e.g., re-running Step 1 with the exact same `source_event_id`) as a duplicate rather than a second lead — this is `REPORTED BY CODEX – NOT IN CLAUDE SCOPE` to confirm on the Cockpit side, but easy to trigger from the Website side: run Step 1 twice with the identical ID and compare Cockpit's resulting lead count (expected: 1, not 2).

## Step 4 — Analytics contract test (Phase 4)

Targets `https://cockpit.qonsul.de/api/v1/analytics/events` directly (this path does **not** go through `lib/crm.ts`'s HMAC/PRODUCTION_READY gate — it's the browser-side beacon from `app/analytics-client.tsx`, unauthenticated by design per the architecture doc, relying on CSP/origin restrictions instead of HMAC). Test with `Origin: https://qonsul.de` explicitly set, matching the real production browser origin:

| Check | Payload shape | Expected |
|---|---|---|
| Valid batch | A `session_start`+`page_view` pair, schema matching `app/analytics-client.tsx`'s `AnalyticsEvent` shape, clearly synthetic `event_id`s | Accepted (2xx) |
| Retry | Re-send the identical batch | Cockpit should treat as idempotent (`REPORTED BY CODEX` to confirm dedup behavior) |
| Unknown event rejection | An event `name` outside `session_start\|page_view\|engagement_update\|scroll_depth\|cta_click` | Rejected — per the prior Cockpit report, expected as `422` |
| Free-text rejection | A payload with an unexpected free-text field (e.g. injecting a `message` string into `data`) | Rejected |
| Invalid scroll value rejection | `scroll_depth` with a threshold outside `{25,50,75,100}` | Rejected |

All test events must use obviously-synthetic identifiers and should be flagged to the Cockpit/Codex side as test data so they can be excluded from any real analytics reporting, since this endpoint has no separate "preview mode" flag visible in the reviewed Website code (unlike the contact/Ishikawa test-data convention, which does have one).

## Cleanup

Per the standing "no real customer data, synthetic only, remove after test" instruction: after Steps 1–2 succeed, delete the corresponding D1 rows (`contact_requests`/`reports` matching the test IDs above) via the same maintenance/cleanup mechanism already used elsewhere in this project, and request the Cockpit side (`REPORTED BY CODEX` territory) remove the corresponding synthetic leads/analytics events from production Cockpit data.

## What this plan does NOT do

- It does not invent, output, or transmit any secret value — the HMAC is only ever used functionally, by the app's own signing code, never read or compared in the clear by a human.
- It does not run until `PRODUCTION_READY=true` and a real (or accurately simulated) production secret are in place — attempting it earlier only exercises the `'not_configured'`/`'needs_review'` code paths, which is a different (and already unit-tested) thing.
