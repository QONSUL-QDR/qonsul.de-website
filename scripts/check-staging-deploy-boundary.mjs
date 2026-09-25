import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUCTION_CANDIDATE_PUBLIC_RUNTIME_KEYS, STAGING_WORKER_NAME } from '../lib/staging-runtime.mjs';

const deployScript = await readFile(new URL('./deploy-staging-worker.mjs', import.meta.url), 'utf8');
assert.ok(deployScript.includes('STAGING_WORKER_NAME'), 'Staging deploy must take its Worker name from the staging-only constant.');
assert.ok(!deployScript.includes("'qonsul-de'"), 'Staging deploy must not name the production Worker.');
const workflow = await readFile(new URL('../.github/workflows/deploy-staging-reconciliation.yml', import.meta.url), 'utf8');
assert.ok(workflow.includes('STAGING_CLOUDFLARE_API_TOKEN'), 'Staging deploy must use the staging credential slot.');
assert.ok(!workflow.includes('deploy-sealed-production-artifact'), 'Staging deploy must not invoke the production deployment workflow.');
for (const key of PRODUCTION_CANDIDATE_PUBLIC_RUNTIME_KEYS) {
  assert.ok(!workflow.includes(key), `Staging workflow must not configure production-candidate variable ${key}.`);
}
assert.equal(STAGING_WORKER_NAME, 'qonsul-website-staging-reconciliation');
console.log('PASS staging build and deploy path cannot select the production Worker or production-candidate runtime');
