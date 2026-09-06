# Production Environment Matrix

Status: **READY**. No secret values appear below — only variable names, whether a variable is secret, and what changes between environments.

Source of truth for the variable list: `.env.example` on this branch (`release/website-rc1`).

| Variable | Staging value | Production value | Secret? | Build-time / Runtime | Cutover action |
|---|---|---|---|---|---|
| `PUBLIC_SITE_URL` | Worker's `*.workers.dev` staging URL | `https://qonsul.de` | Non-secret | Runtime | **REQUIRED** — must change to the production origin |
| `PRODUCTION_READY` | `false` | `false` until Issue #6 checklist is closed, then `true` | Non-secret | Runtime | **REQUIRED** — flip only after all Issue #6 items are closed, not as part of a DNS/infra cutover |
| `QONSUL_COCKPIT_INTAKE_URL` | `https://cockpit-staging.qonsul.de` | `https://cockpit.qonsul.de` | Non-secret (URL only) | Runtime | **REQUIRED** |
| `QONSUL_COCKPIT_INTAKE_SECRET` | staging HMAC secret | production HMAC secret (different value) | **Secret** | Runtime | **REQUIRED** — must be a distinct value from staging, coordinated with the Cockpit side (cross-repo: the secret must match what Cockpit's production API expects) |
| `NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT` | `https://cockpit-staging.qonsul.de/api/v1/analytics/events` | `https://cockpit.qonsul.de/api/v1/analytics/events` | Non-secret (URL only, but note: `NEXT_PUBLIC_*` is inlined into the client bundle at **build time** — see below) | **Build-time** | **REQUIRED** — a separate production build is needed, not just a runtime env change |
| `OPENAI_API_KEY` | staging key or unset (rules-only fallback applies without it) | production key, if AI-assisted suggestions are wanted live | **Secret** | Runtime | **REQUIRED if enabling AI feature**; optional otherwise |
| `OPENAI_MODEL` | `gpt-4.1-mini` (default) | same, unless deliberately changed | Non-secret | Runtime | Not required |
| `RESEND_API_KEY` | staging/sandbox key | production key with the real sending domain verified | **Secret** | Runtime | **REQUIRED** |
| `CONTACT_FROM_EMAIL` | staging sender address | production sender address (must match the verified Resend sending domain) | Non-secret | Runtime | **REQUIRED** |
| `CONTACT_RETENTION_DAYS` | `90` (default) | same, unless a different retention policy is decided (Issue #6, legal) | Non-secret | Runtime | Not required unless policy changes |
| `RATE_LIMIT_SALT` | staging value | **new, distinct production value** | **Secret** | Runtime | **REQUIRED** — must not be the staging value or a predictable derivative |
| `MAINTENANCE_SECRET` | staging value | **new, distinct production value** | **Secret** | Runtime | **REQUIRED** |
| `PUBLIC_CONTACT_EMAIL` | staging or real address | real published contact address (also appears in Impressum) | Non-secret | Runtime | **REQUIRED** — confirm against Issue #6's legal sign-off |
| `LEGAL_ENTITY_NAME` / `LEGAL_ADDRESS` / `LEGAL_REPRESENTATIVE` / `LEGAL_PHONE` / `LEGAL_REGISTER` / `LEGAL_VAT_ID` / `LEGAL_EDITORIAL_RESPONSIBLE` / `LEGAL_DISPUTE_RESOLUTION` | placeholder/test values | real, legally reviewed values | Non-secret (but legally load-bearing) | Runtime | **REQUIRED, gated on Issue #6 legal sign-off** — do not populate with placeholders in production |

## Cockpit origins (context, not a Website variable to set — informational)

| | Staging | Production |
|---|---|---|
| Cockpit web origin | `https://cockpit-staging.qonsul.de` | `https://cockpit.qonsul.de` |
| Resolves to (verified via public DNS, this session) | `217.160.0.156` | not queried again separately — same IONOS shared host per architecture doc |

## CSP `connect-src` — confirmed environment-aware, no hardcoding

Verified directly in RC1 code (`lib/security-headers.ts`, applied via both `next.config.ts` and `proxy.ts`):

```ts
function analyticsOrigin(): string | undefined {
  const endpoint = process.env.NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT;
  if (!endpoint) return undefined;
  try {
    const origin = new URL(endpoint).origin;
    return origin.startsWith('https://') ? origin : undefined;
  } catch { return undefined; }
}
```

`connect-src` is built as `'self'` plus this derived origin. **No production action is required in the CSP code itself** — building the production Worker with `NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT=https://cockpit.qonsul.de/api/v1/analytics/events` set automatically produces `connect-src 'self' https://cockpit.qonsul.de`. This was independently confirmed against the previous branch (`f1c16e1` + local hardening) by building with the variable unset (→ `connect-src 'self'` only) and is structurally identical in RC1.

## What must NOT differ between staging and production

- CSP directive list itself, HSTS value, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy — these are static in `lib/security-headers.ts`, not environment-branched, and should stay identical.
- D1 binding name (`DB`) — identical binding name in both environments; only the underlying database ID/name differs per `docs/DEPLOYMENT.md`'s `CF_D1_DATABASE_ID`/`CF_D1_DATABASE_NAME` build-time override mechanism.
- Application code — the same build artifact philosophy (build once from a tagged commit, promote, don't rebuild differently per environment) should apply; only the env-var values above should differ, achieved via separate builds with different `.env`/secret values, not code branches.
