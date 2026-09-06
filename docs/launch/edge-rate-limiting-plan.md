# Cloudflare Edge Rate Limiting / Abuse Protection — Recommendation

Status: **READY (recommendation only — no rule activated)**. Everything below is a proposal to configure once Cloudflare access is available; nothing here has been applied.

## Why an edge layer at all

The app already rate-limits itself in `lib/server.ts`'s `rateLimit()`: an hour-scoped, salted-IP-hash key stored in D1, with these call sites verified in the current code:

| Endpoint | App-level limit (verified in code) | Unit |
|---|---|---|
| `/api/analyze` | 20 | requests / rolling hour / IP |
| `/api/contact` | 6 | requests / rolling hour / IP |
| `/api/reports` | 8 | requests / rolling hour / IP |
| `/api/maintenance` | none (bearer-secret gated, not public-facing) | — |
| `/api/status` | none (read-only, no side effects) | — |

The gap: every request — including ones that will be rejected — still reaches the Worker and performs at least one D1 write (`DELETE FROM rate_limits WHERE expires_at < ?` runs unconditionally before the limit check in `rateLimit()`). A flood of requests costs Worker invocations and D1 operations *before* the app-level limiter can say no. An edge-level rule rejects abusive traffic before it reaches the Worker at all — this doesn't replace the app-level limiter (which stays as defense-in-depth and is the only layer that's meaningfully IP-hash-salted rather than raw-IP), it reduces what reaches it.

## Per-endpoint recommendation

### `/api/analyze` — highest cost (calls OpenAI when a key is configured)
- **Abuse potential:** high — each call can trigger a paid third-party API request.
- **Cost impact:** highest of all endpoints.
- **Expected legitimate behavior:** a visitor fills in one problem statement, gets suggestions, iterates a few times. Bursts of >5–10/minute from one IP are not a real user.
- **Recommended rule:** ~10 requests / 1 minute / IP, **block** for 60 minutes on breach (not just throttle) given the direct cost link. Burst tolerance: allow the first 10 immediately (no artificial slow-start), since legitimate rapid iteration is plausible.
- **Bot/monitoring impact:** synthetic uptime checks should not hit this endpoint (it requires a POST body) — no allowlist needed.

### `/api/contact` — abuse-sensitive but not cost-driven per call
- **Abuse potential:** medium (spam submissions, already has its own privacy-consent gate and D1-level idempotency).
- **Cost impact:** low per request (D1 write + optional Resend/CRM call downstream — Resend/HubSpot costs scale with accepted submissions, not attempts, since email/CRM delivery happens after the request is accepted, not from repeated GETs).
- **Expected legitimate behavior:** one submission per visit, rarely more than 1–2/hour from the same network (shared office IPs are a real consideration — don't set this so tight that a small office filing two inquiries in an hour gets blocked).
- **Recommended rule:** ~5 requests / 5 minutes / IP, **log** on first breach tier, **challenge** (Cloudflare Managed Challenge, not a hard block) past a second, more generous threshold (e.g., 15/hour). Avoids CAPTCHA-first UX for a form real customers use.

### `/api/reports` — persisted-report retrieval and save
- **Abuse potential:** medium (token-guessing risk against saved report access — already mitigated in-app: bearer-token access, no enumeration surface visible in the reviewed code).
- **Cost impact:** low (D1 read/write only, no third-party call).
- **Recommended rule:** ~15 requests / 5 minutes / IP, **log** only initially — this endpoint's main risk is token brute-forcing, which is bounded by token entropy, not request volume; an edge rule here is a secondary safety net, not the primary control.

### `/api/maintenance` — internal, secret-gated, scheduled
- **Abuse potential:** low — not linked from the site, requires the bearer secret, called only by the operator's scheduler per `docs/OPERATIONS.md`.
- **Recommended rule:** IP allowlist restricted to the known scheduler source if that source has a stable egress IP; otherwise a generous rate rule (e.g., 30/hour) purely as a backstop, since the real protection is the bearer secret with the new `timingSafeEqual` comparison. **Do not** rely on rate limiting as the primary control here — it already isn't.

### Analytics browser requests (`sendBeacon`/`fetch` to the Cockpit analytics endpoint)
- **This traffic never reaches the Website Worker at all** — `app/analytics-client.tsx` posts directly from the browser to `NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT` (the Cockpit API), bypassing the Website Worker entirely. **No Website-side Cloudflare rule should target this traffic** — any rate limiting for it belongs to Cockpit's own edge/WAF configuration (out of this scope; flag to the Cockpit side if not already covered — `CROSS-REPO CONTRACT CHANGE REQUIRED` only if the Website needs to change *how* it sends analytics, which it doesn't here).
- The one Website-side risk is CSP `connect-src` allowing the analytics origin at all — already reviewed as correctly scoped, not broadened.

## Challenge vs. block vs. log — general policy

- **Block** only where cost or abuse is direct and immediate (`/api/analyze`).
- **Challenge** (Managed Challenge, not a mandatory Turnstile widget) for medium-risk, human-facing forms (`/api/contact`) once a generous secondary threshold is crossed — keeps the common case frictionless.
- **Log-only** rules for endpoints whose main risk is already mitigated in-app (`/api/reports`), to build a signal baseline before tightening.
- **Turnstile:** evaluate only as an escalation if `/api/contact` sees sustained abuse past the challenge tier in practice — do not pre-emptively require it; the task's own instruction against introducing unjustified CAPTCHA friction is followed here.

## UX and bot/monitoring considerations

- Keep all thresholds IP-based, not global, to avoid one abusive actor degrading service for everyone else.
- Any external uptime/monitoring check against `/api/status` or `/` should stay well under the proposed thresholds by construction (infrequent polling); no explicit allowlist is expected to be necessary, but confirm the actual monitoring interval before launch (see Post-Launch Monitoring Checklist) and only add allowlisting if it turns out to collide.
- None of these thresholds are final production values — they are a starting recommendation to configure and then observe against real traffic in the first days after launch (see Post-Launch Monitoring Checklist), adjusting up or down from log-only signal before any threshold becomes a hard block.

## Ready-to-apply Cloudflare Rate Limiting rule definitions

Written in Cloudflare's rule-expression syntax so they can be pasted directly into a Rate Limiting Rule's "Edit expression" field the moment sufficient permissions exist. Host value shown for production (`qonsul.de`); use the staging Worker's hostname for a staging-first rollout of the same rules.

**Rule 1 — `/api/analyze` (block)**
```
Expression: (http.host eq "qonsul.de" and http.request.uri.path eq "/api/analyze" and http.request.method eq "POST")
Characteristics: IP
Period: 1 minute
Requests: 10
Action: Block
Mitigation timeout: 60 minutes
```

**Rule 2 — `/api/contact` (log tier, then challenge tier — two separate rules)**
```
Rule 2a (log-only signal):
Expression: (http.host eq "qonsul.de" and http.request.uri.path eq "/api/contact" and http.request.method eq "POST")
Characteristics: IP
Period: 5 minutes
Requests: 5
Action: Log

Rule 2b (challenge past a more generous threshold):
Expression: (http.host eq "qonsul.de" and http.request.uri.path eq "/api/contact" and http.request.method eq "POST")
Characteristics: IP
Period: 60 minutes
Requests: 15
Action: Managed Challenge
```

**Rule 3 — `/api/reports` (log-only initially)**
```
Expression: (http.host eq "qonsul.de" and http.request.uri.path eq "/api/reports")
Characteristics: IP
Period: 5 minutes
Requests: 15
Action: Log
```

**Rule 4 — `/api/maintenance` (backstop only; bearer secret remains primary control)**
```
Expression: (http.host eq "qonsul.de" and http.request.uri.path eq "/api/maintenance" and http.request.method eq "POST")
Characteristics: IP
Period: 60 minutes
Requests: 30
Action: Block
```

**Explicit exclusion — do not create any rule matching:**
```
http.host eq "cockpit.qonsul.de"
```
The analytics beacon posts directly to that host, never through the Website Worker/zone — a Website-side rule cannot and should not attempt to govern it.

Apply in staging first (swap `qonsul.de` for the staging Worker's hostname), run the Controlled Edge Test below, then promote the same four rules to production with the host swapped back.

## Controlled Edge Test (run after applying the rules above, staging first)

Non-destructive, no sustained load — a handful of requests per check, not a load test:

| Check | Method | Expected |
|---|---|---|
| Normal request | 1 request to each of `/api/analyze`, `/api/contact`, `/api/reports` | 200/normal application response — **PASS** |
| Legitimate burst | 5 requests to `/api/analyze` within 10 seconds | All 5 succeed (under the 10/minute threshold) — **PASS** |
| Controlled overage | 12 requests to `/api/analyze` within 10 seconds | Requests 11–12 receive the rate-limit response (429 or Cloudflare's block page) — **RATE LIMITED**, confirms the rule fires |
| Analytics unaffected | Trigger `page_view`/`scroll`/`cta_click` events (multiple per session) against the analytics endpoint during the above | All analytics events succeed throughout — **UNAFFECTED** (proves rule scoping by `http.host`/path is correct and doesn't collide with Cockpit's separate host) |
| Contact still functional | One real contact-form submission after the burst test has cooled down (past the rate-limit window) | Submission succeeds — **FUNCTIONAL** |
| Analyze still functional | One real `/api/analyze` request after the burst test has cooled down | Request succeeds — **FUNCTIONAL** |
| Reports still functional | One real report save/retrieve after the burst test | Succeeds — **FUNCTIONAL** |

If a Managed Challenge rule is in play (Rule 2b), additionally load `/` in an actual browser once shortly after triggering it and confirm the challenge (if presented at all, since it only fires past 15/hour) doesn't degrade the page for a normal visitor who never approached that threshold.

## Turnstile decision

**`TURNSTILE: NOT REQUIRED FOR INITIAL LAUNCH`** — the four rate-limiting rules above (particularly `/api/contact`'s log→challenge escalation) are judged sufficient as a starting posture. Revisit only if real post-launch signal (see Post-Launch Monitoring Checklist) shows sustained automated abuse past the Managed Challenge tier specifically — at that point Turnstile becomes `RECOMMENDED AS SECONDARY CONTROL`, not before. No CAPTCHA-style friction is introduced pre-emptively.

No rule has been created in Cloudflare. This document is the configuration plan for whoever has Cloudflare access to apply, per environment (staging first, then production with the equivalent origin).
