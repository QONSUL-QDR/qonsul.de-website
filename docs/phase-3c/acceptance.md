# Phase 3c website acceptance

Before cutover, run repository checks, contract/HMAC/retry tests, D1 route integration, TypeScript, ESLint and production build. Confirm both fixture files are semantically identical to the Cockpit copies. Secret scan must find no configured secret or environment file.

Local acceptance result on the integration branch: all repository/analysis/PDF suites pass, including 12 explicit Cockpit contract/HMAC/retry checks and 48 D1 API/route checks. TypeScript, ESLint 9.39.5 and the Vinext production build pass. The two contract fixtures are semantically identical to the Cockpit copies; their working-tree byte hashes differ only because of CRLF/LF line endings.

Production setup requires only server-side `QONSUL_COCKPIT_INTAKE_URL=https://cockpit.qonsul.de` and the matching secret. Deploy Cockpit first. Synthetic contact and opted-in Ishikawa requests must be accepted exactly once; an unavailable Cockpit must show generic retry UX while preserving the website record.

Disable the website integration before Cockpit rollback. Do not backfill historical website records automatically.
