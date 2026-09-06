# Production Cutover Runbook (master sequence)

Status: **READY as a runbook. NOT executed.** This ties together the individual documents already prepared in `docs/launch/` into one ordered sequence — it does not duplicate their content, it references it. Each phase names its exit criterion: do not proceed to the next phase until the current one's criterion is met.

**Authoritative bases referenced throughout:** Website `f1c16e185f7e286887282fb1f34095ad47879a76` (`release/website-rc1`), Cockpit `687a2b8b88c53dc3ce703232b8bd29fd42656c73`. RC1 itself remains `PENDING` (not yet the jointly-integrated release) — this runbook is the plan for after RC1 is confirmed integration-ready, not a signal that it already is.

## Phase 1 — Preflight

1. Confirm the commit being deployed is exactly the intended, reviewed one (`git status` clean, no local changes) — see Launch Security Checklist's "code/build integrity" section.
2. Confirm CI is green on that exact commit.
3. Confirm Cloudflare Inventory Checklist has been run and returned `PASS` (not `BLOCKED`) — do not proceed on an unknown existing-resource state.
4. Confirm Production HMAC Verification returns `VERIFIED`, not `UNVERIFIED` or `MISCONFIGURED` — see Production HMAC Verification Procedure.
5. Confirm Dependabot #13 status is still `RESOLVED / NON-BLOCKING` (re-check it hasn't regressed to something worse since this was last classified).
6. Confirm Resend/DKIM status is still `RESOLVED / CORRECTLY CONFIGURED` (a quick re-check of the two DNS records, not a full re-derivation).

**Exit criterion:** all six above confirmed. Any failure here stops the cutover before Phase 2 — do not proceed "provisionally."

## Phase 2 — Backup

1. Run the D1 Backup/Restore Acceptance Procedure in full (production D1 → backup → **isolated** restore target → schema/row-count/integrity check → cleanup of the isolated target). This produces the pre-cutover backup baseline referenced in the Rollback Runbook's reference table.
2. Record: backup filename, SHA-256, size, timestamp — in the Rollback Runbook's reference table, replacing its placeholder.

**Exit criterion:** a verified-restorable backup exists and is recorded, dated no earlier than immediately before this cutover attempt.

## Phase 3 — Website Deployment (to a non-public target first)

1. Deploy the exact preflighted commit to the production Worker (`qonsul-de`), per the Production Deployment Boundary already established: technically live, but **not yet publicly routed** — use the Worker's own `*.workers.dev` preview or an equivalent non-public route.
2. Confirm the deployed version ID and record it in the Rollback Runbook's reference table (replacing its placeholder) — this is the version any rollback in Phase 6/7 would target.

**Exit criterion:** the new version is running and reachable at a non-public URL; the previous version (if any existed) remains available as a rollback target.

## Phase 4 — Environment Verification

1. Run through the Production Environment Matrix and Production Secrets & Bindings Matrix against the *actually deployed* Worker (not assumed from documentation) — confirm every `REQUIRED` variable is set to its production value, by name/presence, never by reading secret values.
2. Confirm `PRODUCTION_READY` is deliberately still whatever value is intended for this exact moment — per the Environment Matrix, this gates all Cockpit delivery and should only become `'true'` once Issue #6 is fully closed, which may be after this technical cutover, not necessarily as part of it. Do not flip it prematurely just because deployment is otherwise ready.
3. Run the Cockpit Production Contract Test Plan (Steps 0–4) and the Production Acceptance Test Plan (consent, maintenance, Resend, OpenAI, D1) against this non-public deployment.

**Exit criterion:** every acceptance test in both plans passes against the actually-deployed Worker, at its pre-cutover (non-public) URL.

## Phase 5 — DNS Cutover

1. Re-verify the DNS Protection Matrix's never-touch list one final time, immediately before making any change (DNS can drift between preparation and execution).
2. Follow the DNS Cutover Checklist's order of operations exactly (TTL lowering already done ahead of time per its section 3, then the actual record change).
3. This is the first point in the entire runbook where public traffic is affected — everything before this phase is reversible with zero public visibility; this step is not silently reversible (propagation delay), which is why it comes last, after every other gate has already passed.

**Exit criterion:** DNS resolves to the new target from multiple external resolvers; MX/SPF/DMARC/Resend DKIM records confirmed unchanged (diff against the DNS Protection Matrix's recorded state).

## Phase 6 — Smoke Tests

Run the full Production Smoke Test Matrix (all 25 items) against the now-live public `https://qonsul.de`, in the stated order (availability/headers/CSP first, functional/data paths after).

**Exit criterion:** all 25 pass, or any failure is triaged against its stated rollback trigger before proceeding further.

## Phase 7 — Rollback Gate

This is a decision point, not an automatic pass-through: explicitly decide GO (proceed to Phase 8) or ROLLBACK (execute the relevant Rollback Runbook scenario) based on Phase 6's results. Do not let a partial-pass ambiguity linger — a single failing smoke test with an unclear cause is treated as "not yet GO" until root-caused, not waved through.

## Phase 8 — Post-Cutover Monitoring

Execute the Post-Launch Monitoring Checklist's first-15-minutes, first-hour, and first-day sequences as scheduled.

**Exit criterion for calling the cutover complete:** first-24-hours monitoring shows no open item from the Post-Launch Monitoring Checklist's "known gap" or anomaly categories requiring escalation.

---

**This runbook itself authorizes nothing** — each phase's referenced document carries its own detail and its own explicit non-authorization of public cutover until this point. Executing Phase 5 onward requires the separate, explicit production-cutover approval this project has consistently withheld so far.
