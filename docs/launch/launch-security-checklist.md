# Launch Security Checklist (Final Pre-Production Pass)

Status: **READY as a checklist template.** Items already verified in this review are marked so explicitly, with the branch/commit they were verified against — re-run every item against the actual commit being deployed to production immediately before cutover, since this list was built against `release/website-rc1` @ `0e67691690d9f2b0f9729dec2681846538a25bbe`, not necessarily what production ends up shipping.

Legend: ✅ already verified this review · ⬜ to verify immediately before production deploy · N/A not applicable to this project.

## Code / build integrity
- ⬜ Deploying exactly the intended, reviewed commit (no uncommitted local changes on top)
- ⬜ `git status` clean on the exact commit being built for production
- ⬜ CI green on that commit (GitHub Actions "Build and integration")
- ✅ `pnpm typecheck` — verified on RC1
- ✅ `pnpm test` (repository hygiene, analysis, Ishikawa PDF, Cockpit intake, security hardening) — verified on RC1, all pass
- ✅ `pnpm test:integration` (48/48) — verified on RC1
- ✅ `pnpm lint` — verified on RC1, 0 errors, 8 pre-existing warnings (unchanged from before the security work)
- ✅ `pnpm build` — verified on RC1
- ⬜ Secret scan of the exact production build output/repo state (no scanning tool was run in this pass beyond the existing `check-repository.mjs` hygiene check — confirm whether a dedicated secret-scanner is part of the standard release process)
- ⬜ Sensitive-file check (no `.dev.vars`, no real customer data, no backup files bundled into the deploy artifact)

## Security headers / CSP
- ✅ Security headers present live on `/` (root) — verified via `wrangler dev` against the actual built worker, not just static config
- ✅ Security headers present live on static pages (`/datenschutz` tested) and API routes (`/api/status` tested)
- ✅ No duplicate headers (explicitly counted: exactly 1 occurrence each of CSP/HSTS/X-Frame-Options across every route tested)
- ✅ CSP directive list reviewed (default-src/script-src/style-src/img-src/font-src/object-src/base-uri/frame-ancestors/form-action/manifest-src/connect-src) — sound, `unsafe-inline` justified by Vinext hydration + inline styles
- ⬜ **No CSP console errors in a real browser** against the actual staging Worker URL — this specifically requires a browser, not curl; not performed in this review (Cloudflare egress blocked from this session). This is the one CSP item still genuinely open.
- ✅ HSTS present live: `max-age=63072000; includeSubDomains; preload`
- ✅ Root-route header gap (vinext `:path*` matcher) confirmed resolved via `proxy.ts` middleware layer

## Maintenance auth
- ✅ Correct secret → 200 `{"purged":true}`
- ✅ Wrong secret → 401
- ✅ Missing Authorization header → 401
- ✅ Empty Bearer value → 401
- ✅ One-character-different secret (near-miss, exercises the timing-safe comparison path specifically) → 401
- ✅ Malformed format (secret sent without the `Bearer ` prefix) → 401
- ✅ `timingSafeEqual` implementation reviewed: SHA-256 digest comparison, branchless XOR over fixed length, explicit empty-input handling, correctly hedged as "not mathematically guaranteed constant-time" rather than over-claiming

## Contact / Ishikawa / HMAC (Phase 3c)
- ✅ `lib/cockpit-intake-client.ts` reviewed: HMAC-SHA256 signing, HTTPS-only base URL enforcement (except localhost), bounded retries (max 3) distinguishing transient vs. non-transient failures, request timeout enforced (500ms–10s clamp)
- ✅ Website-side unit coverage: 12/12 Cockpit-intake checks pass (`check-cockpit-intake.mjs`)
- ⬜ **Live end-to-end** contact/Ishikawa submission reaching real Cockpit staging/production intake — Cockpit-side confirmation is `REPORTED BY CODEX – NOT IN CLAUDE SCOPE`; re-confirm on the exact commit going to production, not assumed carried over from an earlier Codex report on a different commit

## Analytics (Phase 4) — Website side only; Cockpit ingestion is REPORTED BY CODEX
- ✅ `app/analytics-client.tsx` reviewed: consent-gated (`qonsul:analytics-consent` event), `sendBeacon`/`fetch` with `credentials: 'omit'`, silently no-ops without consent or without `NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT` set
- ⬜ Consent OFF → verify zero analytics network activity in a real browser (code inspection supports this; not independently re-run live)
- ⬜ Consent ON → session_start + page_view fire
- ⬜ Page view / CTA / scroll (25/50/75/100) / conversion / UTM attribution — all implemented in code per review; live functional confirmation is Cockpit-linked and `REPORTED BY CODEX`
- ⬜ Idempotency of analytics event delivery under retry — Website side sends once per triggering action; end-to-end idempotency at ingestion is Cockpit-side, `REPORTED BY CODEX`

## D1
- ✅ Backup/restore tooling ready (`docs/launch/d1-backup-restore-runbook.md`, `scripts/d1-backup-restore-check.sh`)
- ⬜ **A real restore has been proven** against the actual staging/production D1 — `EXECUTION PENDING – CLOUDFLARE EGRESS` in this session; must be run for real before this item can be checked off

## Edge protection
- ⬜ Cloudflare edge/WAF rate limiting actually configured per `docs/launch/edge-rate-limiting-plan.md` — plan is ready, nothing has been applied in Cloudflare yet

## Environment
- ⬜ Production environment values set per `docs/launch/production-environment-matrix.md` — matrix ready, values not yet set (this review does not have access to set them, nor should it)
- ✅ CSP analytics-origin confirmed environment-aware in code (no hardcoded staging URL) — verified directly in RC1's `lib/security-headers.ts`

## DNS / mail
- ⬜ Mail DNS (MX/SPF/DMARC) verified untouched **after** any DNS cutover step — cannot be checked before a cutover happens; current pre-cutover state is captured in `docs/launch/dns-cutover-checklist.md` section 1 as the baseline to diff against

## Rollback
- ✅ Rollback path documented and known (`docs/launch/rollback-runbook.md`) for all nine scenario classes
- ⬜ Rollback path **exercised** at least once in staging (a dry-run version rollback) before relying on it in a real incident — not performed in this review
