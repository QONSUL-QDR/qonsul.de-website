# Production DNS Cutover Checklist — qonsul.de

Status: **READY as a checklist. No DNS change has been made.** Current-state values below were read via live public DNS resolution in this session (not the Cloudflare API, not guessed) on 2026-09-06. Re-verify immediately before actually cutting over — DNS can change between now and then.

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

**VERIFY BEFORE CUTOVER** (not checked in this session, no tooling access):
- Exact current TTL of each record type above beyond the SOA's own timers (SOA refresh 28800s/retry 7200s/expire 604800s/minttl 600s were read, but per-record TTLs for MX/TXT/NS were not individually queried).
- Whether any DKIM selector TXT records exist (Microsoft 365 DKIM typically lives at `selector1._domainkey.qonsul.de` / `selector2._domainkey.qonsul.de` — not queried in this session; check the M365 admin center or query directly before cutover, since DKIM selectors are equally untouchable).
- Whether any other subdomains (beyond `cockpit`/`cockpit-staging`) currently resolve and would be affected by a broad wildcard change (none should be touched by this cutover regardless).

## 2. Target state (proposed)

Depends on the hosting decision from `docs/DEPLOYMENT.md` (Sites-managed vs. standalone Cloudflare Worker). In both cases, only **website-serving records** are added/changed:

- `qonsul.de` (apex): new record pointing at the chosen host's documented target (Cloudflare Worker custom domain, or the Sites-managed CNAME target, depending on which hosting path is chosen — get the exact target value from that platform at cutover time, do not hardcode a guess here).
- `www.qonsul.de`: either create as a redirect to the apex, or leave absent if `www` is not intended to be supported — decide explicitly rather than leaving it ambiguous, since it currently doesn't exist either way.
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
