# Production HMAC Verification Procedure

**Current status: `PRODUCTION HMAC SYNCHRONIZATION: UNVERIFIED`** — not yet checked (requires Cloudflare access, which this session does not currently have). This document is the procedure to run once access exists; it does not itself verify anything.

Per the standing instruction: the existing production HMAC (set up during the Cockpit Phase 3c/4 production cutover) must never be regenerated, never requested through chat, and never displayed. This procedure only ever confirms **presence** and **functional agreement**, never the value.

## Step 1 — Presence check (Website side)

```sh
wrangler secret list --name qonsul-de
```
Confirm `QONSUL_COCKPIT_INTAKE_SECRET` appears in the name list.
- Present → go to Step 2.
- Absent, or `qonsul-de` doesn't exist yet → stop here, report `PRODUCTION HMAC SYNCHRONIZATION REQUIRED` (per the standing instruction, do not generate a replacement — this specific finding alone does not block other, independent pre-cutover work).

## Step 2 — Presence check (Cockpit side)

This is `REPORTED BY CODEX – NOT IN CLAUDE SCOPE` to confirm directly (no Cockpit repository access from this session) — request confirmation that `QONSUL_WEBSITE_INTAKE_SECRET` is present on Cockpit production, by name only, the same way. Proceed to Step 3 only once both sides report presence.

## Step 3 — Functional signed contract test (the only real proof of synchronization)

Presence on both sides does not prove the *values match* — only a successful signed request does. Execute Step 1 of the Cockpit Production Contract Test Plan (the contact-intake test, using the established synthetic-data convention with a production-distinct `source_event_id`) through the actual application code path (`syncContactLead` in `lib/crm.ts`), which:

1. Reads the real `QONSUL_COCKPIT_INTAKE_SECRET` from the Worker's own secret store (never surfaced to any human or log).
2. Signs the request with it (`lib/cockpit-intake-client.ts`'s `signature()` function, HMAC-SHA256).
3. Sends it to Cockpit production.

## Step 4 — Interpret the result

| Result | Meaning | Status to report |
|---|---|---|
| `sent` (contact_requests.crm_status) | Cockpit accepted the signature — both sides use the same secret | `PRODUCTION HMAC SYNCHRONIZATION: VERIFIED` |
| `needs_review` with a non-transient `IntakeDeliveryError`, and Cockpit-side logs show a signature/auth rejection (`REPORTED BY CODEX` to confirm the specific reason) | Secrets don't match, or one side is missing/misconfigured | `PRODUCTION HMAC SYNCHRONIZATION REQUIRED` — do not generate a replacement secret yourself; this needs the same coordinated process that originally set it up |
| `needs_review` for a different reason (payload validation, unrelated Cockpit-side error) | Not an HMAC problem at all | Report the actual error distinctly — do not misclassify an unrelated failure as an HMAC sync issue |
| `pending` (transient) | Cockpit temporarily unreachable | Not a synchronization verdict either way — retry once cleanly, per `lib/cockpit-intake-client.ts`'s own transient/non-transient distinction, before concluding anything |

## What this procedure deliberately does not do

- It never reads, logs, or displays either side's secret value.
- It never creates a new secret on either side — a missing or mismatched secret is reported for the appropriate humans/process to resolve, not silently "fixed" by generating a new one.
- It does not run until `PRODUCTION_READY=true` is set on the Website side (per `lib/crm.ts`'s gating, already documented in the Production Environment Matrix) — running it earlier only proves the `'not_configured'` code path works, which is a different and already-tested thing.

## Cleanup

Delete the synthetic test row created in Step 3 from `contact_requests` afterward, and request the corresponding synthetic lead be removed from Cockpit production (`REPORTED BY CODEX` territory) — same convention as the Cockpit Production Contract Test Plan's own cleanup step.
