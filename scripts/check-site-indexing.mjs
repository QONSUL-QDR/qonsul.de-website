import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PRODUCTION_SITE_ORIGIN,
  isIndexableSiteRequest,
  isPublicIndexablePath,
  resolveMetadataOrigin,
  shouldSendNoIndexHeader,
} from '../lib/site-indexing.ts';

assert.equal(PRODUCTION_SITE_ORIGIN, 'https://qonsul.de');
assert.equal(isIndexableSiteRequest('https://qonsul.de', 'qonsul.de'), true);
assert.equal(isIndexableSiteRequest('https://qonsul.de/', 'QONSUL.DE'), true);

for (const host of [
  'www.qonsul.de',
  'staging.qonsul.de',
  'qonsul-quality-engineering.workers.dev',
  'preview-123.pages.dev',
  'localhost:3000',
  'qonsul.de.evil.example',
  'qonsul.de,evil.example',
]) {
  assert.equal(isIndexableSiteRequest('https://qonsul.de', host), false, `${host} must not be indexable`);
}

for (const configuredSiteUrl of [
  '',
  'http://qonsul.de',
  'https://www.qonsul.de',
  'https://qonsul.de:8443',
  'https://qonsul.de/preview',
  'https://user@example.invalid@qonsul.de',
  'not-a-url',
]) {
  assert.equal(
    isIndexableSiteRequest(configuredSiteUrl, 'qonsul.de'),
    false,
    `${configuredSiteUrl || '<empty>'} must fail closed`,
  );
}

assert.equal(shouldSendNoIndexHeader('https://qonsul.de', 'https://qonsul.de/'), false);
assert.equal(shouldSendNoIndexHeader('https://qonsul.de', 'http://qonsul.de/'), true);
assert.equal(shouldSendNoIndexHeader('https://qonsul.de', 'https://preview.example/'), true);
assert.equal(shouldSendNoIndexHeader('https://qonsul.de', 'https://qonsul.de/api/status'), true);
assert.equal(shouldSendNoIndexHeader('https://qonsul.de', 'https://qonsul.de/report'), true);
assert.equal(shouldSendNoIndexHeader('https://qonsul.de', 'https://qonsul.de/anfrage-verwalten/token'), true);
assert.equal(isPublicIndexablePath('/impressum'), true);
assert.equal(resolveMetadataOrigin('https://staging.qonsul.de/path'), 'https://staging.qonsul.de');
assert.equal(resolveMetadataOrigin('not-a-url'), 'http://localhost:3000');

const [layout, robots, sitemap, proxy] = await Promise.all([
  readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/robots.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/sitemap.ts', import.meta.url), 'utf8'),
  readFile(new URL('../proxy.ts', import.meta.url), 'utf8'),
]);

assert.match(layout, /robots:\s*indexable\s*\?/);
assert.match(robots, /disallow:\s*['"]\/['"]/);
assert.match(robots, /sitemap:\s*`\$\{PRODUCTION_SITE_ORIGIN\}\/sitemap\.xml`/);
assert.match(sitemap, /if \(!isIndexableSiteRequest[\s\S]+return \[\]/);
assert.match(proxy, /X-Robots-Tag['"],\s*['"]noindex, nofollow/);

console.log('PASS production-host indexing and fail-closed staging, preview, workers.dev, and private-route policies');
