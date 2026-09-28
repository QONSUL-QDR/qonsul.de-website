# Phase 3c API contract

Canonical fixtures are `tests/contracts/phase3c/contact.json` and `ishikawa.json`, copied byte-for-byte from the Cockpit contract suite. The server client posts them to `/api/v1/intake/contact` and `/api/v1/intake/ishikawa` with JSON, UUID request ID, Unix timestamp and `v1` HMAC-SHA256 signature.

The signed text is `POST`, path, timestamp, lowercase source event UUID and exact-body SHA-256, newline separated. Only transient `5xx`, `429` and transport timeouts are retried, for at most three total attempts. Event ID, request ID and body stay stable. Other `4xx` responses are permanent.

Cockpit success is `200/201` with only `status=accepted` and an opaque source reference. The public website response likewise excludes CRM entity IDs, score, review candidates and delivery internals. Website route input limits remain 24 KB; Cockpit independently enforces 16 KiB contact and 64 KiB Ishikawa limits.
