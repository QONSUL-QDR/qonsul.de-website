# Phase 4: first-party analytics

The website client is inactive by default. A separately designed website analytics-consent layer must explicitly dispatch `qonsul:analytics-consent` with `{ granted: true }` before it sends data. This is intentionally separate from every diagnostic, report, or contact-processing consent.

When active, the browser creates random session, page-view, and event UUIDs; it sends a bounded first-party event batch to `NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT`. No browser secret, third-party script, form value, DOM text, full URL, raw IP address, or raw user agent is collected by the client.

The only browser event names are `session_start`, `page_view`, `engagement_update`, `scroll_depth`, and explicitly marked CTA clicks. CTA elements require a stable `data-analytics-cta` and `data-analytics-placement`; their displayed text is never used. Active dwell time is accumulated only while the page is visible, and lifecycle events flush it with `sendBeacon` or a `keepalive` fallback.

Cockpit owns persistence, validation, bot/internal classification, first/last UTM touch, daily aggregation, and retention policy decisions. The endpoint rejects unknown fields and no free-text metadata is accepted. The required deployment-time configuration is the allowed analytics origin and endpoint; no consent version or legal classification is embedded in this release.
