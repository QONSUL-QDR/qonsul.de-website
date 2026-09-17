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

const [maintenance, config, proxy, server, diagnostics, status, intakeClient, diagnosticIntakeClient, publicAiIntakeClient] = await Promise.all([
  readFile(new URL('../app/api/maintenance/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../next.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../proxy.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/server.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/diagnostics/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/status/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/cockpit-intake-client.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/diagnostic-intake-client.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/public-ai-intake-client.ts', import.meta.url), 'utf8'),
]);

assert.match(maintenance, /await timingSafeEqual\(provided,`Bearer \$\{secret\}`\)/);
assert.doesNotMatch(maintenance, /authorization\)!==/);
assert.match(config, /websiteSecurityHeaders/);
assert.match(proxy, /websiteSecurityHeaders/);
const headers = new Map(websiteSecurityHeaders());
for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Resource-Policy']) assert.ok(headers.has(header));
assert.match(headers.get('Content-Security-Policy'), /connect-src 'self' https:\/\/cockpit-staging\.qonsul\.de/);
assert.equal(headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
assert.equal(headers.get('Cross-Origin-Resource-Policy'), 'same-origin');

assert.match(server, /mediaType!==['"]application\/json['"]/);
assert.match(server, /typeof parsed!==['"]object['"]\|\|Array\.isArray\(parsed\)/);
assert.match(diagnostics, /rateLimit\(request, 'diagnostic-consultation', 8\)/);
assert.doesNotMatch(status, /OPENAI_API_KEY|RESEND_API_KEY|cockpitConfigured|productionReady|contactReady|contactEmail/);
for (const client of [intakeClient, diagnosticIntakeClient, publicAiIntakeClient]) assert.match(client, /redirect:\s*['"]manual['"]/);

console.log('PASS timing-safe maintenance comparison, strict JSON boundary, outbound redirect blocking, rate limit, and security headers');
