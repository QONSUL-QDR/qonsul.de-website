# HSTS Preload Readiness (informational only — no submission performed)

**Status: HSTS PRELOAD: NOT SUBMITTED.** No submission to hstspreload.org has been made, and none should be made as part of this launch preparation. This document only records the preconditions for a *future*, separately-decided submission.

## Current header (verified live against RC1's built worker)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

Technically correct as a header value (max-age ≥ 1 year, `includeSubDomains`, `preload` all present — the three syntactic requirements for preload-list eligibility). Setting this header does **not** itself submit the domain anywhere; submission is a separate, manual, human step at hstspreload.org.

## Preconditions to check before ever submitting (not verified as complete in this session)

1. **All relevant `qonsul.de` subdomains must serve HTTPS permanently, with no plan to ever fall back to plain HTTP.** `includeSubDomains` means the preload decision applies to *every* subdomain, including ones outside this project's control (e.g. `cockpit.qonsul.de`, `cockpit-staging.qonsul.de`, mail-related hosts if any exist under the domain). Confirmed this session: `cockpit.qonsul.de` and `cockpit-staging.qonsul.de` both resolve to `217.160.0.156` (IONOS shared host) — their HTTPS posture is Cockpit/Codex's responsibility, not verified here (`REPORTED BY CODEX – NOT IN CLAUDE SCOPE`). **Do not submit until Cockpit's own HTTPS coverage under `includeSubDomains` is confirmed**, since preload is effectively irreversible on a useful timescale (removal from browsers' preload lists takes months and requires all major browsers to ship the update).
2. **No currently-planned subdomain service without TLS.** None identified in this review, but this project has no visibility into future subdomain plans beyond Website and Cockpit — confirm with whoever owns domain strategy before submitting.
3. **Mail is unaffected by HSTS preload** (HSTS applies to HTTP(S) traffic only, not MX/SMTP) — not a blocker, noted only to avoid confusion with the DNS cutover's mail-safety concerns, which are a separate, unrelated set of records.

## Decision to make later, not now

Preload submission is a one-way door in practice (slow, browser-vendor-controlled removal). The header itself already provides the HSTS protection for browsers that have previously visited the site, without needing the preload list — the preload list only helps *first-ever* visits skip the initial plaintext-HTTP request. Given that marginal benefit versus the irreversibility, this should be a deliberate decision made after production has been stable for a period, not a launch-day action.

**Action for this launch: none.** Leave the header as-is (it's already correctly shaped for a future preload decision without needing a code change later), and revisit submission itself only when section 1's precondition is explicitly confirmed by whoever owns the Cockpit/subdomain HTTPS posture.
