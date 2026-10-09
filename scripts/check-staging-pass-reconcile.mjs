import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PASS, assertInputs, assertWorkerConfig } from './staging-pass-reconcile.mjs';

const workflow = readFileSync(new URL('../.github/workflows/deploy-oneoff-pass-staging.yml', import.meta.url), 'utf8');
assert.match(workflow, /^  workflow_dispatch:\s*$/m);
assert.doesNotMatch(workflow, /^\s+inputs:\s*$/m);
assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/m);
assert.match(workflow, /concurrency:[\s\S]*qonsul-website-staging-reconciliation/);
assert.match(workflow, new RegExp(`fetch --no-tags --depth=1 origin ${PASS.commit}`));
assert.match(workflow, /staging-pass-reconcile\.mjs source[\s\S]*corepack pnpm build/);
assert.match(workflow, /staging-pass-reconcile\.mjs remote[\s\S]*wrangler deploy/);
assert.match(workflow, /--keep-vars --strict --tag staging-gh-/);
assert.match(workflow, new RegExp(`--name ${PASS.worker}`));
assert.match(workflow, /node scripts\/staging-pass-reconcile\.mjs status/);

const good = {
  QONSUL_COCKPIT_INTAKE_URL: PASS.cockpit,
  STAGING_D1_DATABASE_ID: '11111111-2222-4333-8444-555555555555',
  STAGING_D1_DATABASE_NAME: 'qonsul-website-d1-staging',
  GITHUB_RUN_ID: '12345',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_SHA: 'a'.repeat(40),
};
assertInputs(good);
assert.throws(() => assertInputs({ ...good, QONSUL_COCKPIT_INTAKE_URL: 'https://other.example.invalid' }));
assert.throws(() => assertInputs({ ...good, GITHUB_RUN_ATTEMPT: '2' }));

const config = {
  name: PASS.worker,
  workers_dev: true,
  main: 'index.js',
  assets: { directory: '../client' },
  vars: {
    QONSUL_COCKPIT_INTAKE_URL: PASS.cockpit,
    PUBLIC_SITE_URL: PASS.site,
    PRODUCTION_READY: 'false',
    NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT: `${PASS.cockpit}/api/v1/analytics/events`,
  },
  secrets: { required: [PASS.secretName] },
  d1_databases: [{ binding: 'DB', database_id: good.STAGING_D1_DATABASE_ID, database_name: good.STAGING_D1_DATABASE_NAME }],
};
assertWorkerConfig(config, good);
assert.throws(() => assertWorkerConfig({ ...config, name: 'wrong-worker' }, good));
assert.throws(() => assertWorkerConfig({ ...config, routes: ['unapproved.example.invalid/*'] }, good));
assert.throws(() => assertWorkerConfig({ ...config, vars: { ...config.vars, QONSUL_COCKPIT_INTAKE_URL: 'https://other.example.invalid' } }, good));
assert.throws(() => assertWorkerConfig({ ...config, secrets: { required: [] } }, good));

console.log('PASS one-off Staging workflow pins source, target, runtime URL, secret name, and single dispatch');
