import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from '../lib/timing-safe-equal.ts';

process.env.NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT = 'https://cockpit-staging.qonsul.de/api/v1/analytics/events';
const { websiteSecurityHeaders } = await import('../lib/security-headers.ts');

assert.equal(await timingSafeEqual('Bearer valid-token', 'Bearer valid-token'), true);
assert.equal(await timingSafeEqual('Bearer invalid-token', 'Bearer valid-token'), false);
assert.equal(await timingSafeEqual('', 'Bearer valid-token'), false);
assert.equal(await timingSafeEqual('Bearer valid-token', ''), false);
assert.equal(await timingSafeEqual('kurz', 'deutlich-laenger'), false);
assert.equal(await timingSafeEqual('Grüße', 'Grüße'), true);

const [maintenance, config, proxy] = await Promise.all([
  readFile(new URL('../app/api/maintenance/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../next.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../proxy.ts', import.meta.url), 'utf8'),
]);

assert.match(maintenance, /await timingSafeEqual\(provided,`Bearer \$\{secret\}`\)/);
assert.doesNotMatch(maintenance, /authorization\)!==/);
assert.match(config, /websiteSecurityHeaders/);
assert.match(proxy, /websiteSecurityHeaders/);
const headers = new Map(websiteSecurityHeaders());
for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) assert.ok(headers.has(header));
assert.match(headers.get('Content-Security-Policy'), /connect-src 'self' https:\/\/cockpit-staging\.qonsul\.de/);

console.log('PASS timing-safe maintenance comparison and environment-aware CSP baseline');
