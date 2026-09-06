import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from '../lib/timing-safe-equal.ts';

assert.equal(await timingSafeEqual('Bearer valid-token', 'Bearer valid-token'), true);
assert.equal(await timingSafeEqual('Bearer invalid-token', 'Bearer valid-token'), false);
assert.equal(await timingSafeEqual('', 'Bearer valid-token'), false);
assert.equal(await timingSafeEqual('Bearer valid-token', ''), false);
assert.equal(await timingSafeEqual('kurz', 'deutlich-laenger'), false);
assert.equal(await timingSafeEqual('Grüße', 'Grüße'), true);

const [maintenance, config] = await Promise.all([
  readFile(new URL('../app/api/maintenance/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../next.config.ts', import.meta.url), 'utf8'),
]);

assert.match(maintenance, /await timingSafeEqual\(provided,`Bearer \$\{secret\}`\)/);
assert.doesNotMatch(maintenance, /authorization\)!==/);
for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) assert.match(config, new RegExp(header));
assert.match(config, /NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT/);
assert.match(config, /connect-src \$\{connectSources\}/);

console.log('PASS timing-safe maintenance comparison and environment-aware CSP baseline');
