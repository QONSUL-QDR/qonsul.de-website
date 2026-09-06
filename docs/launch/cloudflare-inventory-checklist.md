# Cloudflare Read-Only Inventory Checklist

Status: **READY to execute the moment `api.cloudflare.com` is reachable and a valid token is available.** Purely read-only — nothing in this checklist creates, modifies, or deletes anything. Run this in full, in order, before any create/configure action from any other document in `docs/launch/`. Never print secret values — presence/absence and names only.

## 0. Connectivity/auth check (do this first, single attempt)

```sh
wrangler whoami
```
- Success (account details returned) → proceed.
- `fetch failed` / network error → check the proxy status endpoint's `recentRelayFailures` for a `connect_rejected` entry on `api.cloudflare.com`. If present: report `EXECUTION PENDING – CLOUDFLARE EGRESS` and stop — do not retry in a loop.
- Clean "not authenticated" response (network reachable, token rejected) → report the token itself as invalid/expired — this is a different, more specific status than the network-level block above; do not conflate the two.

## 1. Account / Zone

```sh
wrangler whoami
```
Record: account name/ID is valid and matches the expected QONSUL account (no need to display the ID verbatim in any report — confirm match only).

## 2. Worker production deployment

```sh
# List method depends on wrangler version/API — use whichever the account's plan exposes:
wrangler deployments list --name qonsul-de   # if the worker already exists
```
- If `qonsul-de` does not exist yet: record `PRODUCTION WORKER: NOT YET CREATED` — this is an expected, valid state, not an error. Do not create it during this inventory pass.
- If it exists: record the current deployment's version ID (needed for the Rollback Runbook's reference table) and whether it's the RC1 build or something else.

## 3. Worker routes / custom domains

```sh
wrangler deployments list --name qonsul-de   # routes are typically shown alongside, or check the dashboard's Triggers tab
```
Record whether any route/custom domain is already attached to `qonsul-de` (expected: none yet, since public DNS confirms `qonsul.de` has no A/AAAA record pointing anywhere). If a route already exists pointing at the public domain, **stop and report this as an unexpected finding** before proceeding with anything else in this project — it would mean public traffic is already routed somewhere unaccounted for.

## 4. D1 bindings

```sh
wrangler d1 list
```
- Record every D1 database name/ID visible on the account. Cross-check against the Production Secrets & Bindings Matrix's expectation: a production-intended D1 should be **distinct** from `qonsul-website-d1` if that name is the existing staging database.
- If a database that looks production-intended already exists, do not create a duplicate — use it (subject to schema verification per the D1 Backup/Restore Acceptance Procedure).
- If none exists, record `PRODUCTION D1: NOT YET CREATED`.

## 5. Environment variables / secrets — existence only

```sh
wrangler secret list --name qonsul-de   # only meaningful once the Worker exists
```
For each name in the Production Secrets & Bindings Matrix, record present/absent only:
`QONSUL_COCKPIT_INTAKE_SECRET`, `MAINTENANCE_SECRET`, `RATE_LIMIT_SALT`, `RESEND_API_KEY`, `OPENAI_API_KEY`, plus the non-secret vars (`PRODUCTION_READY`, `PUBLIC_SITE_URL`, `QONSUL_COCKPIT_INTAKE_URL`, `CONTACT_FROM_EMAIL`, `CONTACT_RETENTION_DAYS`, `PUBLIC_CONTACT_EMAIL`, `OPENAI_MODEL`, the eight `LEGAL_*` variables) via whatever the account's vars-listing shows (non-secret vars are often visible directly, unlike secrets). **Never** request or display a secret's value via any means.

## 6. Production Analytics/Cockpit endpoint configuration

Since `NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT` is build-time-inlined, it cannot be checked via `wrangler secret list` — instead:
```sh
curl -s https://<the qonsul-de preview/production URL>/ | grep -o 'cockpit[a-z.-]*qonsul\.de' 
```
or inspect the deployed client bundle directly for the analytics endpoint string, confirming it reads `cockpit.qonsul.de` (production) and never `cockpit-staging.qonsul.de`. This is a build-content check, not a secret check — safe to do and already proven possible in this project's own local verification method (`grep -r` over `dist/client/`).

## 7. HMAC secret presence/synchronization status

Per the standing instruction: check only whether `QONSUL_COCKPIT_INTAKE_SECRET` is **present by name** (step 5). Do not read its value. Actual synchronization with Cockpit's `QONSUL_WEBSITE_INTAKE_SECRET` can only be confirmed functionally, via the Production HMAC Verification Procedure's signed contract test — record this inventory step's result as `PRESENT` / `ABSENT`, not as `VERIFIED` (that comes later, from the separate procedure).

## 8. Cron triggers

```sh
wrangler triggers list --name qonsul-de   # or check the dashboard's Triggers tab
```
Note: this project's maintenance path (`docs/OPERATIONS.md`) describes an **external scheduler calling the `/api/maintenance` HTTP endpoint daily**, not necessarily a native Cloudflare Cron Trigger bound to the Worker (`app/api/maintenance/route.ts` exports only a `POST` handler, no `scheduled()` Worker export was found in this codebase). Expect this to show **no Cron Trigger configured** as the correct, unsurprising state — record it as such rather than treating "none found" as a gap, unless the operational intent has since changed to use a native trigger instead of an external scheduler.

## 9. WAF / Rate Limiting

```sh
# Ruleset API or dashboard: Security > WAF, and Security > Rate Limiting Rules, at the zone level for qonsul.de
```
Record: whether any rule already exists (expect none, per the Edge Security Plan's "nothing applied yet" status), and — critically, per the standing instruction from the prior session — whether this token actually has permission to view/manage WAF and Rate Limiting rulesets at all. If the API returns a permission-denied response specifically for this category (as opposed to a network/auth failure), report `EDGE SECURITY BLOCKED – CLOUDFLARE PERMISSION REQUIRED` for that category specifically, while other inventory items may still have succeeded.

## 10. DNS website records

```sh
# Zone DNS listing for qonsul.de, if the zone itself is managed in this Cloudflare account
```
Cross-check against the DNS Protection Matrix's "current state" table (obtained via public DNS in this session) — confirm the Cloudflare-side view matches what public DNS already showed (it should, since public DNS reflects whatever is authoritative regardless of where it's managed). If the zone isn't in this Cloudflare account at all (DNS still fully at IONOS), record that explicitly — it changes how the DNS Cutover Checklist's "target state" section needs to be executed (nameserver delegation to Cloudflare vs. a partial/CNAME setup at IONOS, a decision already flagged as open in that document).

## 11. Security headers / CSP (on whatever is currently deployed, if anything)

If `qonsul-de` already has a deployment (step 2), curl its preview URL and confirm the same six headers and CSP shape already verified locally in this project (Production Environment Matrix) — this is a live-parity check between "what we verified locally" and "what's actually deployed," not a new investigation.

## 12. Rollback-capable previous Worker version

```sh
wrangler deployments list --name qonsul-de
```
Confirm at least one prior version is retained and selectable for rollback (Cloudflare typically retains deployment history automatically) — record the version ID of whatever is live *before* deploying anything new, per the Production Cutover Runbook's Phase 3.

## Reporting this checklist's results

Report each of items 1–12 individually as done/not-applicable/blocked — a single blocked item (e.g. WAF permissions) does not invalidate the others; report each on its own merits, consistent with the differentiated-reporting approach already established in this project.
