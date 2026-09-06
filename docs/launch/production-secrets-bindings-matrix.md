# Production Secrets & Bindings Matrix

**Names and status only — no values, anywhere in this document.** Status for every entry is **UNKNOWN** for anything that requires Cloudflare access to check, because this session currently has none (credential/permission blocker, not a network blocker — `api.cloudflare.com` is reachable). This is not asserted as "not set" — it is genuinely unverified.

Variable list derived by grepping every `setting('...')` call site in `app/` and `lib/` on RC1 — cross-checked against `.env.example` and found to match exactly (no undocumented variable in code, nothing in `.env.example` that the code doesn't actually read).

## Bindings

| Binding | Type | Name | Status |
|---|---|---|---|
| `DB` | D1 Database | (production database name/ID — see D1 Backup/Restore Runbook and item below) | UNKNOWN — cannot list existing Workers/D1 databases without Cloudflare access |

## Secrets (via `wrangler secret put`, never in `.env`/repo)

| Secret name | Required for | Status |
|---|---|---|
| `QONSUL_COCKPIT_INTAKE_SECRET` | Phase 3c contact/Ishikawa intake HMAC signing (`lib/crm.ts`) | UNKNOWN — per the standing instruction, this must NOT be regenerated if it already exists from the Cockpit production cutover; must be checked for presence (name only, via `wrangler secret list` once access exists) and validated functionally (signed contract test), never read as a value |
| `MAINTENANCE_SECRET` | Bearer auth for `/api/maintenance` | UNKNOWN — **must be a new value distinct from staging** if this Worker doesn't already have one |
| `RATE_LIMIT_SALT` | App-level rate-limit key hashing (`lib/server.ts`) | UNKNOWN — **must be a new value distinct from staging** |
| `RESEND_API_KEY` | Contact-form email delivery | UNKNOWN |
| `OPENAI_API_KEY` | AI-assisted analysis suggestions (optional feature — app falls back to rules-only if absent, verified in `lib/analysis.ts`'s existing design) | UNKNOWN — only required if the AI feature is wanted live at launch |

## Non-secret runtime variables (`wrangler` vars / plain env)

| Variable | Required value for production | Status |
|---|---|---|
| `PRODUCTION_READY` | `'true'` (exact string) — **gates all Cockpit intake delivery**, see Production Environment Matrix | UNKNOWN — must be set only after Issue #6 sign-off, not as a side effect of infra setup |
| `PUBLIC_SITE_URL` | `https://qonsul.de` | UNKNOWN |
| `QONSUL_COCKPIT_INTAKE_URL` | `https://cockpit.qonsul.de` | UNKNOWN |
| `CONTACT_FROM_EMAIL` | production sender address (must match Resend's verified sending domain) | UNKNOWN |
| `CONTACT_RETENTION_DAYS` | `90` unless a different policy is decided | UNKNOWN |
| `PUBLIC_CONTACT_EMAIL` | real published contact address | UNKNOWN |
| `OPENAI_MODEL` | `gpt-4.1-mini` unless deliberately changed | UNKNOWN |
| `LEGAL_ENTITY_NAME`, `LEGAL_ADDRESS`, `LEGAL_REPRESENTATIVE`, `LEGAL_PHONE`, `LEGAL_REGISTER`, `LEGAL_VAT_ID`, `LEGAL_EDITORIAL_RESPONSIBLE`, `LEGAL_DISPUTE_RESOLUTION` | real, legally-reviewed values (Issue #6) | UNKNOWN |

## Build-time-only variable (not a runtime secret/binding — set at build, not deploy)

| Variable | Required value | Status |
|---|---|---|
| `NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT` | `https://cockpit.qonsul.de/api/v1/analytics/events` | **Confirmed working in a real production-shaped build this session** (see Production Environment Matrix) — but that was a local dry-run build, not the actual artifact that would be deployed; the real production Worker's build must be produced the same way, with this exact value, not assumed to carry over automatically from any other build. |

## First action once Cloudflare access exists (read-only, per the standing inventory instruction)

1. `wrangler whoami` — confirm account.
2. List existing Workers — confirm whether `qonsul-de` already exists (do not create a duplicate if it does).
3. `wrangler d1 list` — confirm whether a production-intended D1 database already exists (do not create a duplicate).
4. `wrangler secret list` (against whichever Worker is the production target, once identified) — confirm which of the secrets above are already present **by name only**.
5. Only after 1–4: decide what actually still needs creating/setting, rather than assuming a blank slate.
