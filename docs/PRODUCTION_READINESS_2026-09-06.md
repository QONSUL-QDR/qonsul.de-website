# Production Readiness – 6 September 2026

This document records a readiness assessment only. It is not a deployment
instruction and does not authorize a production change.

## Verified baseline

- Website RC1: `0e67691690d9f2b0f9729dec2681846538a25bbe`
- Website staging worker: `qonsul-quality-engineering`
- Cockpit staging: Phase 3c and Phase 4 accepted at
  `687a2b8b88c53dc3ce703232b8bd29fd42656c73`
- Cockpit production: `e4785fd99c0526883e7bddee8fe0476c5fad79f3`;
  Phase 3c and Phase 4 are not deployed there.

## D1 recovery evidence

An export of the isolated website staging D1 was restored into a newly created
temporary D1 database. The temporary target was deleted after validation. The
private export is retained outside the repository and has a recorded SHA-256.

The following application-level structures matched before cleanup:

| Check | Result |
| --- | --- |
| `contact_requests` row count | matched |
| `reports` row count | matched |
| `trends` row count | matched |
| `rate_limits` row count | matched |
| non-internal table count | matched |
| non-internal index count | matched |
| trigger count | matched |

Cloudflare D1 remote queries reject `PRAGMA integrity_check` with
`SQLITE_AUTH`; successful supported export/import plus the structural comparison
is the available validation method. A fresh backup and restore probe are still
required against the eventual production D1 immediately before cutover.

## Production configuration matrix

| Area | Required production setting | Readiness |
| --- | --- | --- |
| Website canonical origin | `https://qonsul.de` | identified |
| Analytics browser endpoint | `https://cockpit.qonsul.de/api/v1/analytics/events` | identified |
| CSP `connect-src` origin | derived from the analytics endpoint: `https://cockpit.qonsul.de` | build-dry-run verified |
| Cockpit intake endpoint | `https://cockpit.qonsul.de` | identified |
| Production D1 binding | a distinct, migrated production D1 database | not yet defined |
| HMAC, maintenance, rate-limit and provider secrets | production secret store only | not yet verified |
| Resend sender and recipient | verified production provider configuration | not yet verified |
| `PRODUCTION_READY` | enable only during the coordinated cutover | not yet enabled |

The production build must use the production analytics endpoint above. No
staging analytics origin may be present in the production build.

## Deployment sequencing guard

The website must not be activated for production until Cockpit production has
been deployed and accepted with Phase 3c and Phase 4. This is required for both
the HMAC-protected website intake and first-party analytics ingestion.

## Edge-protection status

Application-level, D1-backed throttling currently exists for `/api/analyze`,
`/api/contact`, and `/api/reports`. It is not a substitute for Cloudflare edge
rate limiting.

Before production, configure and test edge rules separately for:

| Endpoint | Proposed initial control | Preserve |
| --- | --- | --- |
| `/api/analyze` | low burst, challenge or block after a modest sustained limit | normal diagnostic use |
| `/api/contact` | low burst, block after a modest sustained limit | valid form retries |
| `/api/reports` | low burst, block after a modest sustained limit | report retrieval and retry flow |
| `/api/maintenance` | no public rate-limit UX; bearer authorization remains primary | maintenance access |
| Cockpit analytics endpoint | separate policy; do not group with expensive website APIs | event batches and retry safety |

Turnstile is not required for the initial launch if those edge rules are
configured and observed. Reassess it only after concrete abuse evidence.

## DNS and mail safety

No DNS change is part of this assessment. Before a cutover, preserve current
MX, SPF, DKIM, and DMARC records. The DKIM selector names must be confirmed from
the mail provider rather than guessed. A website target and redirect plan for
both `qonsul.de` and `www.qonsul.de` must be selected before DNS cutover.

## Cutover smoke matrix

| Test | Expected result | Rollback trigger |
| --- | --- | --- |
| Homepage and navigation | HTTPS 200, hydration and navigation work | repeated 5xx, broken navigation, CSP error |
| Impressum and Datenschutz | reachable with expected legal content | 4xx/5xx or wrong environment content |
| Contact form and mail | valid request persists once; expected delivery status | duplicate persistence, failed CRM/mail handoff |
| Ishikawa report | consent-gated report and retry work | report loss, consent bypass, wrong CRM behavior |
| Cockpit HMAC intake | accepted once by production Cockpit | signature/authentication failure |
| Analytics consent off/on | no events before activation; events after activation | pre-consent tracking or blocked post-consent request |
| Page view, CTA, scroll, conversion, UTM | allowlisted data ingests and retry is idempotent | event rejection or duplicate persistence |
| Security headers, CSP, HSTS | exact header set; no console CSP errors | missing, conflicting, or blocking header |
| Maintenance authorization | absent/invalid bearer returns 401 | unauthorized response or unavailable maintenance |
| D1 write and Worker logs | expected writes; no unexpected Worker errors | persistence or runtime failure |
| Cockpit health | production health endpoint and DB TLS healthy | Cockpit unavailable or analytics intake unavailable |

## Rollback order

1. Put the website into its previously accepted Worker version; do not change
   the Cockpit independently while intake is still enabled.
2. Disable production website-to-Cockpit integration before any Cockpit
   rollback.
3. Restore the production D1 only from a pre-cutover, verified production
   backup and only into the intended recovery target.
4. Revert DNS only to a documented previous target while preserving all mail
   records.
5. If the regression is CSP-only, redeploy the previous Worker version or a
   reviewed, minimal CSP correction; do not widen source directives broadly.
6. Verify contact persistence, analytics behavior, and Cockpit health after
   rollback.

## Post-launch observation

| Window | Observe | Escalate when |
| --- | --- | --- |
| T+15 minutes | availability, Worker errors, D1 errors, contact delivery, Cockpit intake, CSP violations | repeated request failures, unexpected 4xx/5xx, delivery failure |
| T+1 hour | analytics ingest volume, idempotency, rate-limit events, bot/anomaly indicators | missing analytics, duplicate events, excessive blocks or abuse |
| T+24 hours | delivery backlog, Resend failures, D1 growth, retention jobs, Cockpit health | unresolved intake state, retention failure, sustained error trend |

Current gaps to close before production are a defined production Worker/D1
target, server-side production configuration verification, Cloudflare edge
rate-limit configuration, verified DNS cutover target, and the Cockpit Phase
3c/4 production deployment.

HSTS preload has not been submitted. Such a submission requires a separate
long-term HTTPS review of all relevant subdomains.
