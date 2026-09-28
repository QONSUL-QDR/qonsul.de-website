# Production Acceptance Test Plan — Consent, Maintenance, Resend, OpenAI, D1

Status: **READY as a plan.** Execution requires a deployed (or equivalently configured local) production Worker — `EXECUTION PENDING` until then. Each section states exactly what passes and what escalation a failure implies.

## Consent gate (Phase 4, Website side)

Code reviewed this session: `app/analytics-client.tsx`'s `AnalyticsClient()` only calls `start()` — which is the only path that ever calls `send()` — in response to the `qonsul:analytics-consent` custom event, and only when `detail?.granted === true`. There is no default-on path and no separate reuse of any diagnostic/Ishikawa consent flag for analytics.

| Test | Steps | Pass criterion | Failure escalation |
|---|---|---|---|
| Consent OFF | Load the production site fresh (cleared storage), do not interact with any consent UI, observe network traffic for 30+ seconds including a scroll and a route change | Zero requests to the analytics endpoint | If any request fires without consent: this is a privacy/compliance defect (not cosmetic) — treat as launch-blocking, do not ship with this state |
| Consent ON | Grant consent via the site's actual consent UI, then reload/re-navigate | `session_start` + `page_view` requests fire; `sessionStorage` key `qonsul.analytics.session.v1` is populated | If no request fires after explicit consent: Rollback Runbook scenario G |
| Consent OFF → then ON mid-session | Load without consent, interact briefly, then grant consent without reloading | Analytics starts only from the moment consent is granted, no retroactive send of pre-consent interactions | Any evidence of a pre-consent interaction being sent after the fact would be a defect — not expected given the code's structure (nothing is buffered before `start()` is called), but worth confirming empirically once, not just by code reading |

## Maintenance auth (production)

Already exhaustively verified against RC1's exact code in this review's earlier passes (correct/wrong/missing/empty/near-miss/malformed-format, all six cases behaving correctly). The production-specific remaining check is purely operational, not a new code question:

| Test | Steps | Pass criterion | Failure escalation |
|---|---|---|---|
| Missing auth | `POST /api/maintenance` with no `Authorization` header against the production URL | 401 | — |
| Invalid auth | Same, with a clearly-wrong bearer value | 401 | — |
| Correct auth | Same, with the real production `MAINTENANCE_SECRET` (never typed into chat/logs — paste directly into the request tool being used) | 200, `{"purged":true}`, and `purgeExpired()`'s effect is confined to genuinely expired rows (verify via a D1 row-count check before/after, not by trusting the 200 alone) | A 401 on the correct secret → check the secret was actually set correctly on the production Worker, not a code defect (code is already proven correct) |

**Do not** run the correct-auth case against production until there's confidence the D1 database in use is the intended production one (not accidentally the still-empty freshly-initialized one, where "purged" would trivially succeed either way) — sequence this test after the D1 acceptance test below, not before.

## Resend (email delivery)

| Test | Steps | Pass criterion | Failure escalation |
|---|---|---|---|
| Sender domain verification | Public DNS already shows the expected records this session: `resend._domainkey.qonsul.de` carries a DKIM public-key TXT record, and `send.qonsul.de` has the SPF (`include:amazonses.com`) and MX (`feedback-smtp.eu-west-1.amazonses.com`) Resend/SES bounce-subdomain setup — strong evidence the domain has already been added in Resend. Still confirm the dashboard itself shows "Verified" (DNS presence alone doesn't prove Resend's own verification check has completed) before any send attempt | Domain shows verified in Resend's dashboard | If not verified despite the DNS being in place, it's a Resend-side verification-check issue, not a missing-DNS problem — check the dashboard directly rather than re-deriving DNS records that are already confirmed correct |
| Single controlled send | One real (or clearly synthetic, per the existing test-data convention already used elsewhere) contact-form submission through the actual production path: form → D1 → Resend → mailbox | Email arrives at the configured recipient within a few minutes, correct content, correct sender | No arrival within a reasonable window → Rollback Runbook scenario F (check Resend dashboard/API errors first, this is very often provider/domain-config, not a Website code defect) |
| No mass mail | N/A — explicitly bounded to exactly one test send, to one authorized QONSUL-controlled recipient, never third parties | — | — |

## OpenAI / `/api/analyze` production readiness

| Test | Steps | Pass criterion | Failure escalation |
|---|---|---|---|
| Secret presence | Confirm (by name only, via `wrangler secret list` once access exists) whether `OPENAI_API_KEY` is set on the production Worker | Present if the AI-assisted feature is wanted live; absent is also a valid, working configuration (rules-only fallback) — this is a deliberate choice, not a defect either way | N/A |
| Server-side only / no browser leak | Code review (already done this session, no new finding): `OPENAI_API_KEY` is only read via `setting()` inside `lib/analysis.ts`'s server-side code path, never passed to any client component or `NEXT_PUBLIC_*` variable | Confirmed by code inspection; optionally re-confirm by grepping a production build's `dist/client/` output for the literal key prefix pattern (never the real key itself) to prove it isn't bundled client-side | Any occurrence of the key material in `dist/client/` would be a critical leak — escalate immediately, do not deploy |
| Error handling | Code review: the app's existing fallback-to-rules behavior when the key is absent or the OpenAI call fails is already the production behavior, not a special case to newly configure | No new test needed beyond confirming the fallback path still works with a deliberately-invalid key in a non-production test, which is already implicitly covered by "no key configured" behaving correctly | — |
| Rate-limit/abuse protection | Covered by the Edge Rate Limiting Plan's `/api/analyze` rule (10/min/IP, block) plus the existing app-level limit (20/hour/IP) | Both layers present before launch | If the edge rule isn't yet applied (permission-blocked), the app-level limit alone is the interim protection — acceptable but should be noted as a temporary gap, not silently accepted as final |
| Minimal smoke test | At most one single synthetic `/api/analyze` request with a clearly fictional problem statement, if a live check is wanted at all | Suggestions returned, no error | Given the cost profile, prefer to skip a live OpenAI smoke test entirely if code-level confidence is already high (which it is, per the existing security review) — only run it if there's a specific reason to doubt the production key itself works |

## D1 application test (production)

Reuses the same schema already verified (`reports`, `rate_limits`, `trends`, `contact_requests`, `d1_migrations`) — no schema changes accompany this launch.

| Test | Steps | Pass criterion | Failure escalation |
|---|---|---|---|
| Contact persistence | One synthetic contact submission (see Cockpit Production Contract Test Plan for the exact fixture convention to reuse) | New row in `contact_requests` with expected field values | Rollback Runbook scenario E |
| Ishikawa/report persistence | One synthetic Ishikawa analysis saved | New row in `reports` | Rollback Runbook scenario E |
| Maintenance cleanup | After the above, confirm `purgeExpired()` does **not** remove the just-created rows (they aren't expired yet) — only run the real cleanup call once rows are deliberately aged past `expiresAt` or accept that this specific check is deferred to natural expiry | Non-expired synthetic rows survive a maintenance call; only genuinely expired rows are removed | Unexpected removal of non-expired rows → stop and treat as a D1/code defect requiring investigation before any further production maintenance calls |
| Cleanup of test data | Delete the synthetic rows created above once the test is complete | `contact_requests`/`reports` no longer contain the test IDs | — |
| No staging D1 was written | Confirm (by checking which D1 binding/database ID the test actually ran against) that none of the above touched the staging database | Test ran against the production D1 only | If staging was accidentally targeted: no data-loss risk (staging is test data anyway) but it indicates a binding misconfiguration that must be fixed before trusting any other production test result |
