# Post-Launch Monitoring Checklist

Status: **READY as a checklist.** Uses only Cloudflare's existing dashboard/observability (already available once the Worker is deployed — the `wrangler dev` sessions in this review showed a built-in "Local Explorer"/observability query surface, and the equivalent exists in the real Cloudflare dashboard for a deployed Worker) and the application's own existing signals (D1 tables, Worker logs). **No new monitoring platform is introduced.** Where a real gap exists, it's documented as a gap rather than papered over with a tool nobody asked for.

## First 15 minutes

- [ ] Homepage (`/`) returns 200 with all six security headers present (curl or browser)
- [ ] `/api/status` returns 200
- [ ] Submit one real (or fictional-per-existing-test-data-convention) contact form entry end-to-end; confirm a new row in D1 `contact_requests`
- [ ] Trigger one Ishikawa intake path; confirm Cockpit-side receipt (`REPORTED BY CODEX` for the Cockpit-side confirmation step)
- [ ] Confirm D1 writes are succeeding generally (no `Datenspeicher ist nicht erreichbar` errors in Worker logs — that's `lib/server.ts`'s `rawDb()` failure message, a clear, greppable signal if the D1 binding itself is broken)
- [ ] Watch Worker error rate in the Cloudflare dashboard for any spike immediately after cutover
- [ ] Open the browser console on the live production URL and confirm no CSP violation messages (this is also the one Launch Security Checklist item that specifically requires a live browser — do it now if not already done pre-launch)

## First hour

- [ ] Analytics: confirm consent-gated events are reaching Cockpit for real visitors (not just the smoke test above) — `REPORTED BY CODEX` for the Cockpit-side ingestion count, but confirm from the Website side that `qonsul:analytics-consent` is actually firing for real consent interactions
- [ ] Rate-limit anomalies: check D1 `rate_limits` table for any single key hitting the app-level ceiling repeatedly (20/hour on `/api/analyze`, 6/hour on `/api/contact`, 8/hour on `/api/reports`) — an early sign either of real abuse or of the edge rate-limiting plan needing faster rollout than planned
- [ ] Resend delivery: check `contact_requests.emailStatus` isn't accumulating `pending`/`failed` entries
- [ ] Unexpected bot traffic: watch Cloudflare's bot-score/traffic analytics (once available) for anomalous request patterns, particularly against `/api/analyze` given its cost profile

## First day

- [ ] D1 `rate_limits` table growth is bounded (the table self-prunes expired entries on `rateLimit()`/`purgeExpired()` calls — confirm it isn't growing unbounded, which would indicate the pruning path itself has an issue)
- [ ] No sustained CSP violations reported by real visitors' browsers (if a reporting endpoint is later added — none exists today, see gap below)
- [ ] Confirm the daily maintenance scheduler call (`/api/maintenance`, per `docs/OPERATIONS.md`) ran successfully at least once and purged expired reports/contact requests/rate-limit rows as expected
- [ ] Spot-check a handful of real (not test) `reports`/`contact_requests` rows for correct `expiresAt` values matching the configured retention policy
- [ ] Re-run the D1 Backup/Restore Runbook for real (if not already proven pre-launch) — first day of real traffic is exactly when a first real-data backup/restore proof matters most

## Known monitoring gap (documented, not filled with a new platform)

- **No CSP `report-to`/`report-uri` is currently configured** — CSP violations are only visible by manually opening a browser console, not aggregated automatically. Adding a report endpoint is a reasonable post-launch improvement but is explicitly **not** being introduced as part of this launch prep (would require a new ingestion endpoint and a decision about where reports are stored/reviewed — out of scope for "use existing capability only"). Flag this gap to whoever owns ongoing operations rather than silently leaving it unmentioned.
- **No dedicated uptime/synthetic monitoring tool identified** beyond whatever Cloudflare's own dashboard provides passively. If none exists, this is a genuine gap to raise with the operator — not something to fill by introducing a third-party service unilaterally.
