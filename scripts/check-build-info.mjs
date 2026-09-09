import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Deployment-drift identifier contract: the exact commit that produced a
// build must stay wired from vite.config.ts's inlined define, through
// lib/build-info.ts, to the public GET /api/status response. This is a
// static wiring check; the live value against a real `vinext dev` build is
// exercised end-to-end by scripts/check-api.mjs.

const [viteConfig, buildInfo, statusRoute] = await Promise.all([
  readFile(new URL('../vite.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/build-info.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/status/route.ts', import.meta.url), 'utf8'),
]);

assert.match(viteConfig, /__QONSUL_BUILD_COMMIT_SHA__/, 'vite.config.ts inlines the build commit SHA');
assert.match(buildInfo, /export const BUILD_COMMIT_SHA/, 'lib/build-info.ts exports the commit identifier');
assert.match(statusRoute, /commit\s*:\s*BUILD_COMMIT_SHA/, 'GET /api/status exposes the commit identifier');

const { BUILD_COMMIT_SHA } = await import('../lib/build-info.ts');
assert.equal(typeof BUILD_COMMIT_SHA, 'string', 'BUILD_COMMIT_SHA is always a string, even outside a Vite build');
assert.ok(BUILD_COMMIT_SHA.length > 0, 'BUILD_COMMIT_SHA is never empty');

console.log('PASS deployment-drift identifier is wired from build to GET /api/status');
