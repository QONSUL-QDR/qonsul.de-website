# Phase 3c website architecture

This Next.js 16 / React 19 application runs through Vinext on Cloudflare Workers with D1. Browser forms call same-origin website routes. Those routes persist the existing D1 business record and, only in production, send an HMAC-authenticated event to the independent QONSUL Cockpit API. There is no shared database, model package or browser secret.

The integration is based on GitHub `main` commit `c57001a77e71060847bec0694d6d8a51ca314c58`; `QONSUL-QDR/qonsul.de-website` remains the source of truth. The logical D1 binding remains `DB`. The standalone Worker `qonsul-quality-engineering` is the current test/staging target. The production hosting target for `qonsul.de` is not yet defined; neither the existing Sites project nor any Worker is declared as production by this change.

`POST /api/contact` maps the existing name, email, optional phone/company, message and privacy acknowledgement to `contact_form`. `POST /api/reports` maps the real Ishikawa problem, mode, available-data list and structured causes to `ishikawa` only when the existing consultation opt-in is true. The D1 record UUID is the stable source event ID across retries.

No FMEA or user-registration feature exists. Their Phase-3b source enum values are documented extension points only; a future website account must remain separate from CRM contact identity.

Non-persisted browser events named `qonsul:analytics-hook` expose the requested Phase-4 lifecycle extension points without introducing analytics storage or identifiers.
