# Production Rollback Runbook

Status: **READY**. No incident has occurred; this is prepared in advance. Preferred default across every scenario below: **revert to the last known-good Cloudflare Worker version** (Cloudflare keeps prior deployed versions; a version rollback is a single reversible action) rather than pushing an uncoordinated hotfix under pressure. Only fall through to a code hotfix when the specific scenario requires it (e.g. the previous version has the same defect).

## A) New Worker deployment is faulty (crashes, 5xx, fails to boot)

- **Detection:** Worker error rate spike in Cloudflare dashboard/observability, or manual smoke test after deploy fails (see Launch Security Checklist / Post-Launch Monitoring first 15 minutes).
- **Immediate action:** Roll back to the previously active Worker version via Cloudflare's version rollback (dashboard or `wrangler versions rollback` / deployment API — exact command depends on how the deploy was made, per `docs/DEPLOYMENT.md`'s standalone-deploy path).
- **Rollback target:** Last version that passed the Launch Security Checklist.
- **Validation:** Homepage and `/api/status` respond 200; repeat the Launch Security Checklist's live-header and maintenance-auth spot checks.
- **Data-loss risk:** None from the code rollback itself. If the faulty version wrote bad data before being rolled back, see scenario E for D1-specific recovery.
- **Escalation:** If rollback itself fails to restore service, treat as a platform-level Cloudflare incident — check Cloudflare status page before assuming an application bug.

## B) CSP blocks the website or the analytics beacon

- **Detection:** Browser console CSP violation reports; blank/broken page; analytics events stop arriving at Cockpit despite consent being granted (cross-check with Cockpit side, `REPORTED BY CODEX` for confirmation there).
- **Immediate action:** Identify the specific blocked directive from the browser console (e.g. `connect-src` rejecting the analytics origin because `NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT` was misconfigured at build time, or an unexpected inline script/style source). Do **not** loosen CSP broadly (e.g. add `*` or `https:`) as a quick fix.
- **Rollback target:** Previous Worker version (CSP is baked in at build time via `lib/security-headers.ts`, so a version rollback also reverts CSP).
- **Root-cause note:** Given `NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT` is read at **build time**, a CSP/analytics-origin mismatch in production most likely means the production build was built with the wrong (or missing) env var — the fix is rebuilding with the correct value, not patching the CSP string.
- **Validation:** Re-check the Launch Security Checklist's "no CSP console errors" item on the rolled-back version.
- **Data-loss risk:** None.
- **Escalation:** If the analytics origin itself is wrong on the Cockpit side (not a Website CSP problem), that's `CROSS-REPO CONTRACT CHANGE REQUIRED` — coordinate, don't unilaterally change the Website's expectation of the Cockpit origin.

## C) Contact form regression

- **Detection:** Contact submissions fail client-side, or `contact_requests` rows stop being created, or Resend/CRM delivery stops (`emailStatus`/`crmStatus` stuck at `pending`/`failed` in D1).
- **Immediate action:** Roll back the Worker version first (fastest mitigation for website-visible breakage). If the regression is actually a Resend/HubSpot-side issue (verify via their status pages / API error responses in Worker logs) rather than a code regression, a Worker rollback alone won't fix it — escalate to the provider-config track instead (secrets/domain verification), not a code rollback.
- **Data-loss risk:** Low — submissions during the incident window may be lost client-side (never persisted) if the failure is before the D1 write; already-persisted rows are unaffected by a Worker rollback.
- **Validation:** Submit a real (or clearly marked fictional-per-existing test-data convention) contact request end-to-end after rollback and confirm the full path: D1 row created → Resend/CRM triggered.

## D) Ishikawa intake regression (Phase 3c, server-side Cockpit HMAC)

- **Detection:** Ishikawa submissions fail, or Cockpit-side intake stops receiving them (`REPORTED BY CODEX` for Cockpit-side confirmation) despite the Website reporting success — or vice versa.
- **Immediate action:** Roll back the Worker version. If the HMAC contract itself is suspected (signature mismatch against Cockpit), this is `CROSS-REPO CONTRACT CHANGE REQUIRED` — do not modify `lib/cockpit-intake-client.ts`'s signing logic unilaterally under incident pressure; a mismatched secret/contract needs coordinated fixing, not a one-sided patch.
- **Data-loss risk:** `IntakeDeliveryError` in `lib/cockpit-intake-client.ts` already distinguishes transient vs. non-transient failures with retry (up to 3 attempts) — a genuine outage beyond that window means the specific intake event is not delivered to Cockpit; whether the Website side persists a local fallback record is worth confirming against current code before launch (not verified in this review pass).
- **Validation:** A successful end-to-end Ishikawa submission reaching Cockpit intake (cross-repo, coordinate the check).

## E) D1 problem (corruption, unexpected data, migration issue)

- **Detection:** Application errors referencing D1 queries; data anomalies reported; `d1_migrations` table shows an unexpected/missing entry.
- **Immediate action:** **Do not** run ad-hoc destructive SQL against production D1 to "fix" data under pressure. First take a fresh backup (Backup/Restore Runbook, step 1) of the *current* (even if suspect) state before changing anything further, so the pre-fix state isn't lost. Then diagnose against that backup copy, not the live database.
- **Rollback target:** Code rollback does **not** revert D1 data (Worker version rollback has no effect on already-written rows) — this is explicitly called out in `docs/OPERATIONS.md`'s existing guidance ("Code-Rollback setzt Datenbankänderungen nicht zurück"). A real data-level rollback requires restoring from a verified backup taken before the incident, which overwrites current data — only do this after confirming the backup's integrity (Backup/Restore Runbook step 2) and accepting the data-loss window between that backup and now.
- **Data-loss risk:** High if a full restore-from-backup is needed — anything written between the backup timestamp and the incident is lost. Weigh this against the alternative of a targeted manual fix.
- **Escalation:** Any full-database restore to production is a significant, hard-to-reverse action — treat it with the same caution as a production deployment: confirm with the operator before executing, not as an autonomous action.

## F) Resend (email) problem

- **Detection:** `contact_requests.emailStatus` stuck at `pending`/`failed`; Resend API errors in Worker logs; no CRM-summary emails arriving.
- **Immediate action:** Check Resend's own status/dashboard and the configured sending domain's verification status first — this is very often a provider-side or domain-verification issue, not a Website code defect, and a Worker rollback won't fix it.
- **Data-loss risk:** None to D1 (the contact request itself is still persisted); only the email-notification side-effect is affected. Existing `emailStatus`-tracking already supports a later reconciliation pass per `docs/OPERATIONS.md`'s maintenance guidance.
- **Escalation:** Provider/domain-config issue → operator with Resend account access, not a code fix.

## G) Analytics problem (Phase 4)

- **Detection:** No `analytics_*` activity appearing on the Cockpit side despite consent being granted and traffic occurring (`REPORTED BY CODEX` for confirming Cockpit-side ingestion) — or, from the Website side only, no `qonsul:analytics-consent` events firing, or the CSP blocking the beacon (see scenario B).
- **Immediate action:** Confirm first whether this is a Website-side problem (CSP, wrong `NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT` value at build time, or the consent gate itself) versus a Cockpit-side ingestion problem — these require different fixes and different owners.
- **Data-loss risk:** Analytics is explicitly designed to be non-critical to core site function (`app/analytics-client.tsx`'s `send()` swallows its own errors: "Analytics must never affect the website experience") — a broken analytics pipeline should never itself justify a website rollback; treat it as a lower-severity, separately-tracked fix.
- **Escalation:** Cockpit-side ingestion issues are out of Website scope — `REPORTED BY CODEX` territory to hand off, not to patch here.

## H) Cockpit production API unreachable from the Website

- **Detection:** `lib/cockpit-intake-client.ts`'s `deliverIntake` exhausts its 3 retries and raises a transient `IntakeDeliveryError`; contact/Ishikawa submissions to Cockpit intake fail while the Website itself stays up.
- **Immediate action:** Confirm Cockpit production availability independently (this is squarely `REPORTED BY CODEX / NOT IN CLAUDE SCOPE` to diagnose on the Cockpit side). From the Website side, there is nothing to roll back — the Website's own retry/error-handling behavior (already reviewed as sound: bounded retries, distinguishing transient vs. non-transient, HTTPS-only base URL enforcement) is the correct behavior during a Cockpit-side outage, not a defect to patch.
- **Data-loss risk:** Depends on whether the Website persists a fallback record for undelivered intake events during the outage window — verify this specifically before launch if not already covered by existing tests, since it directly determines whether affected leads/submissions can be replayed once Cockpit recovers.
- **Escalation:** To the Cockpit/Codex side; do not attempt a Website-side workaround that bypasses the HMAC-signed intake contract.

## I) DNS cutover problem

- **Detection:** `qonsul.de` fails to resolve, resolves to the wrong target, or — critically — mail stops working (MX/SPF/DMARC accidentally touched).
- **Immediate action:** Revert the specific record(s) changed during cutover (DNS Cutover Checklist section 6) to their pre-cutover state. Because TTL was lowered ahead of the change, this should propagate quickly.
- **Data-loss risk:** None to application data; risk is availability/reachability only, and — if mail records were mistakenly touched — mail deliverability, which is the single highest-severity failure mode in this whole launch (irreversible bounced/lost email during the outage window).
- **Validation:** Re-run the exact DNS lookups from the DNS Cutover Checklist section 1/5 and confirm MX/SPF/DMARC match the pre-cutover values exactly.
- **Escalation:** If mail was affected, this is a "stop everything and fix mail first" situation — treat with higher urgency than the website's own availability.

## General principles across all scenarios

- Prefer the Worker version rollback over a hotfix wherever the previous version was known-good — it's faster, fully reversible, and doesn't risk introducing a *new* defect under pressure.
- A hotfix is only appropriate when the previous version shares the same defect (rare, since these are all *new* Phase 3c/4/security changes relative to what was previously live) or when the issue is DNS/provider-config rather than code.
- Every scenario above that touches data (E, and partially C/D/H) requires explicit confirmation before any destructive/irreversible action — this runbook documents the decision tree, it does not pre-authorize executing it.
