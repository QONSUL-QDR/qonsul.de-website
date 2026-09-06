# DNS Protection Matrix — qonsul.de (hard never-touch list)

Status: **READY.** This is the authoritative, standalone never-touch list for any DNS work on `qonsul.de`, referenced by the DNS Cutover Checklist and the Production Cutover Runbook rather than restated there. Every value below was read via live public DNS resolution this session (not the Cloudflare API, not guessed), most recently re-confirmed while investigating the DKIM/Resend correction.

## Protected — never modify, remove, or overwrite

| Record | Current value | Why protected |
|---|---|---|
| MX (`qonsul.de`) | `qonsul-de.mail.protection.outlook.com`, priority 0 | Primary mailbox routing (Microsoft 365 / Exchange Online). Breaking this stops all inbound mail to `@qonsul.de` immediately. |
| TXT / SPF (`qonsul.de`) | `v=spf1 include:spf.protection.outlook.com ~all` | Mail sender authentication for the primary domain. A new TXT record must be *added* alongside this (SPF only permits one record per domain to be merged, never two competing ones) — never replace it. |
| TXT / Microsoft verification (`qonsul.de`) | `v=verifydomain MS=5014321` | Domain-ownership proof for the Microsoft 365 tenant. Removing it can break the tenant's domain association. |
| TXT (`_dmarc.qonsul.de`) | `v=DMARC1; p=none;` | DMARC policy for the primary domain. Currently monitoring-only (`p=none`) — not a website-cutover concern either way, but out of scope to touch regardless. |
| NS delegation (`qonsul.de`) | `ns1091.ui-dns.org`, `ns1108.ui-dns.de`, `ns1043.ui-dns.com`, `ns1043.ui-dns.biz` | IONOS-managed nameservers. Changing NS delegation affects every record on the domain simultaneously, including all entries in this table — the highest-blast-radius change possible, never done as part of a "website-only" cutover. |
| TXT (`resend._domainkey.qonsul.de`) | DKIM public key present | Resend's sending-domain DKIM signature for the Website's contact-form notification emails. Confirmed correctly configured this session — breaking it degrades outbound contact-form mail deliverability (spam-folder risk), independent of the website itself. |
| SPF + MX (`send.qonsul.de`) | SPF `v=spf1 include:amazonses.com ~all`; MX `feedback-smtp.eu-west-1.amazonses.com` priority 10 | Resend/Amazon SES bounce and return-path subdomain, paired with the DKIM record above as part of the same sending-domain authentication setup. Confirmed correctly configured this session. |
| A (`cockpit.qonsul.de`) | `217.160.0.156` | Cockpit production — a fully separate system on separate infrastructure (IONOS shared host), out of this project's change scope entirely. |
| A (`cockpit-staging.qonsul.de`) | `217.160.0.156` | Cockpit staging — same reasoning. |

## Permitted to change — website-traffic records only

| Record | Current state | Cutover-permitted action |
|---|---|---|
| `qonsul.de` A/AAAA (apex) | Absent (confirmed `ENODATA` — no existing record of either type) | May be **created** to point at the production Worker's Cloudflare target, per the DNS Cutover Checklist. Since nothing exists today, this is strictly an addition, never an overwrite. |
| `www.qonsul.de` | Absent (confirmed NXDOMAIN) | May be **created** as a redirect-serving record per the www strategy (permanent redirect to the apex), per the DNS Cutover Checklist section 7. Also strictly an addition. |
| CAA (`qonsul.de`) | Absent (confirmed `ENODATA`) | Not required for this cutover; optionally add post-launch to restrict certificate issuance — not a blocker either way, and not part of the website cutover's scope by default. |

## Rule for any DNS session touching this domain

Change only the two rows in the second table, in a single-purpose DNS session — do not open a broader "clean up DNS" session that touches multiple record classes at once, since that is exactly the condition under which a protected record gets edited by mistake. If a change to anything in the first table ever appears necessary for a *future* reason unrelated to this website cutover, treat it as a separate, deliberately-scoped task with its own review — never bundle it into a website DNS change.
