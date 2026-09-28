# Pre-Launch GO / NO-GO Matrix

Status: **READY as a decision matrix.** This is the final gate list referenced by the Production Cutover Runbook's Phase 1 (Preflight) — it does not itself perform any check, it aggregates the result of the other `docs/launch/` documents into one GO/CONDITIONAL GO/NO-GO call per gate, plus one overall verdict. Re-evaluate every row immediately before the actual cutover — this snapshot reflects this session's findings, not necessarily the state at execution time.

## How to read this matrix

- **GO** — verified complete, no open item, safe to proceed on this gate.
- **CONDITIONAL GO** — usable for launch with a named, accepted residual risk or a narrow follow-up that does not block going live (e.g. "log-only for now, tighten post-launch").
- **NO-GO** — blocks cutover until resolved; the specific unblocking action is named.
- Each row states who/what verified it and against which commit/session, per this project's differentiated-reporting convention (`VERIFIED BY CLAUDE` / `REPORTED BY CODEX — NOT IN CLAUDE SCOPE` / `EXECUTION PENDING`).

## Gates

| # | Gate | Status | Basis | Unblocking action if not GO |
|---|---|---|---|---|
| 1 | RC1 staging accepted | **GO** | `VERIFIED BY CLAUDE` — independent differential security review of `release/website-rc1` @ `0e67691690d9f2b0f9729dec2681846538a25bbe` against `f1c16e1`; full local suite (`typecheck`/`test`/`lint`/`test:integration`/`build`) all pass on RC1 | — |
| 2 | CSP browser accepted | **NO-GO** | `EXECUTION PENDING` — headers/CSP shape verified via `wrangler dev` + curl in this session, but no real-browser console check has been run against the actual staging Worker URL (requires a browser, not performed here) | Load the staging Worker URL in a real browser; confirm zero CSP violation lines and zero hydration errors in the console (`launch-security-checklist.md`, "Security headers / CSP" section) |
| 3 | D1 backup passed | **NO-GO** | `EXECUTION PENDING – CLOUDFLARE EGRESS` — tooling ready (`scripts/d1-backup-restore-check.sh`, `d1-backup-restore-runbook.md`), never executed against a real Cloudflare D1 from this session | Run `d1-backup-restore-acceptance-procedure.md` end-to-end once Cloudflare access is available; record backup filename/SHA-256/size/timestamp in the Rollback Runbook's reference table |
| 4 | Isolated restore passed | **NO-GO** | `EXECUTION PENDING – CLOUDFLARE EGRESS` — same run as gate 3 covers this; not yet executed | Same action as gate 3 — the single acceptance-procedure run satisfies both gates 3 and 4 together |
| 5 | Production HMAC verified | **NO-GO** | `EXECUTION PENDING – CLOUDFLARE EGRESS` — current status `PRODUCTION HMAC SYNCHRONIZATION: UNVERIFIED` per `production-hmac-verification-procedure.md`; presence/value never requested or displayed, by design | Run the 4-step verification procedure once Cloudflare access is available and `PRODUCTION_READY=true`; do not regenerate either side's secret |
| 6 | Cloudflare inventory passed | **NO-GO** | `EXECUTION PENDING – CLOUDFLARE EGRESS` — `cloudflare-inventory-checklist.md` fully prepared (12 read-only steps), zero steps executed; session's `api.cloudflare.com` egress is currently blocked at the proxy gateway level (`CLOUDFLARE EXECUTION BLOCKED BY SESSION EGRESS POLICY` / `TOKEN VALIDITY NOT CURRENTLY TESTABLE`) | Re-attempt the connectivity check (checklist step 0) once egress is confirmed open; run steps 1–12 in order, report each independently |
| 7 | Dependabot #13 resolved | **GO** | `REPORTED BY CODEX, CROSS-VERIFIED BY CLAUDE` — `GHSA-67mh-4wv8-2f99`, transitive `esbuild@0.18.20` via `drizzle-kit@0.31.10` → `@esbuild-kit/core-utils@3.3.2`; exact chain confirmed against `pnpm-lock.yaml`; dev-only tooling dependency, no Production Worker runtime path; classified `NON-BLOCKING FOR INITIAL LAUNCH with maintenance follow-up` | — (tracked for a later maintenance pass, not a launch blocker) |
| 8 | Resend/DKIM verified | **GO** | `VERIFIED BY CLAUDE` — live public DNS this session: `resend._domainkey.qonsul.de` TXT present (DKIM key), `send.qonsul.de` SPF+MX present (Amazon SES bounce/sending infrastructure), MX/SPF/DMARC for primary mail (Microsoft 365, `p=none`) all present and untouched | — |
| 9 | Edge abuse protection disposition | **CONDITIONAL GO** | `VERIFIED BY CLAUDE` as a *plan* — `edge-rate-limiting-plan.md` fully specified (categories A/B/C, four ready-to-paste rules, Turnstile explicitly `NOT REQUIRED FOR INITIAL LAUNCH`); **no rule has been applied in Cloudflare** | Accepted for launch on the condition that Rules 1–4 are applied in Cloudflare (staging first, Controlled Edge Test run, then production) as part of Cutover Runbook Phase 1/3 — do not launch with zero edge rate limiting if `/api/analyze` would otherwise be openly exposed to cost-driving abuse |
| 10 | Rollback tested/prepared | **CONDITIONAL GO** | `VERIFIED BY CLAUDE` as *prepared* — `rollback-runbook.md` covers all 9 scenario classes with a concrete reference table; the rollback path itself has **not been exercised** (no dry-run version rollback performed in staging) | Accepted for launch on the condition that the reference table's version-ID row is populated with a real prior deployment before go-live (satisfied automatically once gate 6, checklist step 12, runs) — a dry-run exercise is recommended but not strictly required if the previous-version pointer is confirmed valid |
| 11 | Production DNS plan reviewed | **GO** | `VERIFIED BY CLAUDE` — `dns-protection-matrix.md` and `dns-cutover-checklist.md` both finalized: never-touch list (MX/SPF/DMARC/NS/DKIM/`send.qonsul.de`/Cockpit hosts) explicit; permitted-to-change list (apex A/AAAA, `www`, currently absent) explicit; cutover mechanics documented | — |

## Overall verdict

**OVERALL: NO-GO**

Scope of this verdict: it reflects gates 2, 3, 4, 5, and 6 only — every one of them is currently `EXECUTION PENDING` for the same underlying reason, this session's blocked Cloudflare/browser execution access, not a defect found in the website code, RC1 security posture, or the Phase 3c/Phase 4 contracts. This verdict does **not** mean Phase 3c or Phase 4 have lost their `STAGING ACCEPTED` status — those remain accepted per the RC1 differential security review (gate 1) and are unaffected by anything in this matrix.

Once Cloudflare access is confirmed stable in a session with browser access available:
1. Run gate 2 (real-browser CSP/hydration check) — independent of Cloudflare, blocked only by lack of a browser in this session.
2. Run gate 6 (Cloudflare inventory checklist) first, since gates 3, 4, and 5 depend on facts it establishes (which D1 is production, whether `qonsul-de` Worker/secrets exist).
3. Run gates 3+4 together (D1 backup/restore acceptance procedure).
4. Run gate 5 (HMAC verification), only after `PRODUCTION_READY=true` is set per the Production Environment Matrix.
5. Apply the edge rules from gate 9's plan and re-mark it `GO` once applied and the Controlled Edge Test passes.
6. Re-run this matrix in full immediately before the actual cutover — do not carry forward stale results from this session if meaningful time has passed or the deployed commit has changed.

A gate moving from NO-GO to GO does not require re-litigating the gates already at GO (1, 7, 8, 11) unless the underlying commit or DNS state has changed since this snapshot.
