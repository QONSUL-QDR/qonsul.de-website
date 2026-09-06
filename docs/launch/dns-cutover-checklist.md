# Production DNS Cutover Checklist — qonsul.de

Status: **READY as a checklist. No DNS change has been made.** Current-state values below were read via live public DNS resolution in this session (not the Cloudflare API, not guessed), re-verified twice on 2026-09-06 with identical results both times. Re-verify again immediately before actually cutting over — DNS can change between now and then.

## 0. Non-negotiable constraint

**Never touch:** MX, the existing SPF TXT record, DMARC TXT record, or the domain's NS delegation. The cutover only adds/changes records needed to point website traffic (apex and/or `www`) at the new hosting target.

## 1. Current state (verified this session, live public DNS)

| Record | Value found | Notes |
|---|---|---|
| NS | `ns1091.ui-dns.org`, `ns1108.ui-dns.de`, `ns1043.ui-dns.com`, `ns1043.ui-dns.biz` | IONOS-managed nameservers (`ui-dns.*` is IONOS/1&1's own DNS infrastructure). SOA hostmaster `hostmaster.1und1.com` confirms this. **Do not change NS delegation as part of a website-only cutover.** |
| MX | `qonsul-de.mail.protection.outlook.com` (priority 0) | Microsoft 365 / Exchange Online. **Do not touch.** |
| TXT (SPF) | `v=spf1 include:spf.protection.outlook.com ~all` | **Do not touch or replace** — any new TXT record must be *added*, never overwrite this one. |
| TXT (other) | `v=verifydomain MS=5014321` | Microsoft domain-verification TXT. **Do not touch.** |
| `_dmarc.qonsul.de` TXT | `v=DMARC1; p=none;` | Monitoring-only DMARC policy. Out of scope to change for a website cutover; note it is currently `p=none` (not enforcing) as background context only. |
| `qonsul.de` A | none (ENODATA) | The apex currently has **no A record at all** — nothing is being overwritten here, a new record is being *added*. |
| `qonsul.de` AAAA | none (ENODATA) | Same — no existing IPv6 record to preserve or lose. |
| `www.qonsul.de` | NXDOMAIN (does not exist) | No existing `www` record of any kind. |
| CAA | none (ENODATA) | No Certificate Authority restriction currently in place; any CA can issue for this domain today. Not a blocker; optionally revisit post-launch. |
| `cockpit.qonsul.de` A | `217.160.0.156` | Existing Cockpit production host (IONOS shared hosting, matches architecture doc). **Not part of this cutover.** |
| `cockpit-staging.qonsul.de` A | `217.160.0.156` | Same host, different vhost. **Not part of this cutover.** |

**Checked this session — DKIM finding:** `selector1._domainkey.qonsul.de` and `selector2._domainkey.qonsul.de` (the standard Microsoft 365 DKIM selector convention) both return **NXDOMAIN — the records do not exist**, not merely empty. Combined with the `p=none` DMARC policy already noted, this domain currently has **no DKIM signing configured** as far as public DNS shows. This is an existing mail-authentication gap, unrelated to and unaffected by the website cutover — noted here for completeness, not something this cutover should or can fix (no DKIM record to protect, and none should be added as a side effect of a website-only change either).

**VERIFY BEFORE CUTOVER** (not checked in this session, no tooling access):
- Exact current TTL of each record type above beyond the SOA's own timers (SOA refresh 28800s/retry 7200s/expire 604800s/minttl 600s were read, but per-record TTLs for MX/TXT/NS were not individually queried).
- Whether Microsoft 365 uses a non-default DKIM selector name for this tenant (rare, but possible) before concluding DKIM is entirely absent rather than just non-default.
- Whether any other subdomains (beyond `cockpit`/`cockpit-staging`) currently resolve and would be affected by a broad wildcard change (none should be touched by this cutover regardless).

## 2. Target state (confirmed platform decision: Cloudflare Worker `qonsul-de`)

The hosting target is Cloudflare Workers, Worker name `qonsul-de`, not the OpenAI-Sites-managed path. Only **website-serving records** are added/changed:

- `qonsul.de` (apex): a Cloudflare Custom Domain / Worker Route attached to `qonsul-de`. Cloudflare's own onboarding flow, once the domain's nameservers or a partial CNAME setup is in place, provides the exact target value (typically a Cloudflare-proxied A/AAAA pair or a CNAME to the Workers routing layer) — **read that value from Cloudflare at cutover time, do not hardcode a guess here.** Note this domain's nameservers are currently IONOS's own (`ui-dns.*`), not Cloudflare's — whether the plan is a full nameserver migration to Cloudflare or a partial/CNAME setup at IONOS is a decision to confirm explicitly before cutover, since it changes which records this checklist's "order of operations" actually touches.
- `www.qonsul.de`: per section 7 (`www` strategy) below, a **permanent redirect to `https://qonsul.de`** is the recommended target — implemented as a Cloudflare redirect rule or a second Worker route, not as a separate content-serving target.
- No change to any other record class.

## 3. TTL strategy

- **Before cutover:** lower the TTL of the record(s) about to be created/changed (or of any placeholder that predates them) to a short value (e.g. 300s) at least one full TTL cycle ahead of the actual cutover, so a rollback later takes effect quickly. Since apex A/AAAA/`www` currently don't exist, this mainly matters for whatever placeholder or interim record gets created first.
- **After cutover is confirmed stable:** raise TTL back to a normal production value (e.g. 3600s+) to reduce resolver load, once no rollback is anticipated.

## 4. Order of operations

1. Re-verify section 1's current-state table immediately before starting (DNS can drift; do not trust this document's timestamp for the actual cutover).
2. Lower TTL on the target record(s) per section 3, wait at least one old-TTL cycle.
3. Confirm the production Website build/deploy is live and independently reachable at its pre-cutover hostname (Worker's own `*.workers.dev` URL or equivalent) with all Launch Security Checklist items green, **before** pointing `qonsul.de` at it.
4. Create/change the apex (and `www`, if in scope) record(s) to the target value.
5. Do not touch MX/SPF/DMARC/NS/other subdomains in the same change — a DNS provider UI session touching multiple record types increases the risk of an accidental edit; treat this as a single-purpose change.

## 5. Validation after change

- Resolve `qonsul.de` and `www.qonsul.de` (if changed) from multiple external resolvers/locations and confirm the new target, not cached old data.
- Confirm `qonsul-de.mail.protection.outlook.com` MX, the SPF TXT, and `_dmarc` TXT are **unchanged** — re-run the exact same lookups as section 1 and diff.
- Load `https://qonsul.de` and confirm TLS certificate is valid for the correct host, security headers are present (see Launch Security Checklist), and the homepage renders.
- Send a real test email to a mailbox at `qonsul.de` and confirm delivery still works (proves MX/mail routing wasn't disturbed) — do this explicitly, don't assume "we didn't touch MX" is sufficient proof.

## 6. Rollback

- Revert the apex/`www` record(s) to their pre-cutover state (i.e., absent, per section 1) or to the last-known-good value if this is a subsequent cutover rather than the first one.
- Because TTL was lowered ahead of time (section 3), rollback propagates quickly.
- Mail-related records were never touched, so there is nothing to roll back there by construction — confirm this remains true by re-running section 1's lookups after rollback too.
- See the Rollback Runbook (`docs/launch/rollback-runbook.md`) scenario I for the fuller decision tree if the DNS change itself is the suspected cause of an incident.

## 7. `www.qonsul.de` strategy (concrete recommendation)

**Recommendation: `https://qonsul.de` is the canonical production domain. `www.qonsul.de` permanently redirects (HTTP 301) to it.**

Reasoning:
- `www.qonsul.de` does not exist today (confirmed NXDOMAIN, this session) — there is no existing traffic, bookmark base, or SEO history at `www` to preserve by making it the canonical host instead.
- All architecture references throughout this project (`.env.example`'s `PUBLIC_SITE_URL`, the CSP/security-header work, the Cockpit `Production Browser Origin: https://qonsul.de`) already assume the bare apex as canonical — making `www` canonical instead would require touching all of those, for no benefit.
- A single canonical host avoids duplicate-content SEO ambiguity and keeps the CSP/CORS/cookie-domain surface (none of which currently vary by host) simple.

**Implementation, once Cloudflare access exists:** a Cloudflare redirect rule (or bulk redirect) matching `www.qonsul.de/*` → `https://qonsul.de/$1`, HTTP 301, applied at the edge — this does not require the Website Worker itself to handle the `www` host at all. This is the recommended mechanism specifically because it keeps the redirect independent of the Worker's own deploy lifecycle (a Worker rollback per the Rollback Runbook doesn't affect this redirect, and vice versa).

**Not decided here:** whether `www.qonsul.de` gets its own DNS record pointed at Cloudflare (proxied, so the redirect rule can match it) as part of this cutover, or whether it's deliberately left absent until there's a concrete reason to register it. Either is compatible with the recommendation above; register it now only if the redirect is wanted from day one of the cutover — leaving it absent for now and adding it in a later, equally low-risk change is also acceptable, since nothing currently depends on `www` resolving.
