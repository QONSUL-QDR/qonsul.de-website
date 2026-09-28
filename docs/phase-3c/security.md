# Phase 3c website security

`QONSUL_COCKPIT_INTAKE_SECRET` is a server-side runtime secret and must be at least 32 bytes. `QONSUL_COCKPIT_INTAKE_URL` must be HTTPS except in localhost tests. Neither value is exposed through status responses or client modules. HMAC authenticates exact bytes and Cockpit verifies it timing-safely within five minutes.

The existing same-origin checks, JSON guard, honeypot, D1 rate limiting, client-token idempotency and preview safety remain active. Failed Cockpit delivery leaves the D1 record and stable event ID for a user retry. The UI never reports successful intake when a production consultation transfer is unconfirmed.

Contact privacy acknowledgement, Ishikawa storage/contact opt-in, AI consent and anonymous trend consent remain separate. Diagnostic consent is never sent. No HTTP headers, browser fingerprint, analytics identity or secret is copied into CRM.
