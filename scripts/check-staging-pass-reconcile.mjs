import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PASS, assertInputs, assertRemoteStagingConfig, assertWorkerConfig, sealPayload, stageWorkerConfig, verifyPayload } from './staging-pass-reconcile.mjs';

assert.equal(PASS.commit, '70464ab0210b43c2e6d71bf980d08a3a01121e33');
assert.equal(PASS.tree, '9cb9e824a5e3c4082d595194dd59d4f083753bff');
assert.equal(PASS.worker, 'qonsul-website-staging-reconciliation');
assert.equal(PASS.cockpit, 'https://cockpit-staging.qonsul.de');

const workflow = readFileSync(new URL('../.github/workflows/deploy-oneoff-pass-staging.yml', import.meta.url), 'utf8');
assert.match(workflow, /^  workflow_dispatch:\s*$/m);
assert.doesNotMatch(workflow, /^\s+inputs:\s*$/m);
assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/m);
assert.match(workflow, /test "\$\{GITHUB_EVENT_NAME\}" = 'workflow_dispatch'/);
assert.match(workflow, /test "\$\{GITHUB_REF\}" = 'refs\/heads\/main'/);
assert.match(workflow, /concurrency:[\s\S]*qonsul-website-staging-reconciliation/);
assert.match(workflow, new RegExp(`fetch --no-tags --depth=1 origin ${PASS.commit}`));
assert.match(workflow, /staging-pass-reconcile\.mjs source[\s\S]*corepack pnpm build/);
assert.match(workflow, /staging-pass-reconcile\.mjs remote[\s\S]*wrangler deploy/);
assert.match(workflow, /--keep-vars --strict --tag staging-gh-/);
assert.match(workflow, new RegExp(`--name ${PASS.worker}`));
assert.match(workflow, /node scripts\/staging-pass-reconcile\.mjs status/);

const good = {
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  QONSUL_COCKPIT_INTAKE_URL: PASS.cockpit,
  STAGING_D1_DATABASE_ID: '11111111-2222-4333-8444-555555555555',
  STAGING_D1_DATABASE_NAME: 'qonsul-website-d1-staging-reconciliation',
  GITHUB_RUN_ID: '12345',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_SHA: 'a'.repeat(40),
};
assertInputs(good);
assert.throws(() => assertInputs({ ...good, GITHUB_EVENT_NAME: 'push' }));
assert.throws(() => assertInputs({ ...good, GITHUB_REF: 'refs/heads/other' }));
assert.throws(() => assertInputs({ ...good, STAGING_D1_DATABASE_NAME: 'qonsul-website-d1-staging' }));
assert.throws(() => assertInputs({ ...good, QONSUL_COCKPIT_INTAKE_URL: 'https://other.example.invalid' }));
assert.throws(() => assertInputs({ ...good, GITHUB_RUN_ATTEMPT: '2' }));

const config = {
  name: PASS.worker,
  workers_dev: true,
  main: 'index.js',
  assets: { directory: '../client' },
  vars: {
    DEPLOYMENT_ENVIRONMENT: 'staging',
    QONSUL_COCKPIT_INTAKE_URL: PASS.cockpit,
    PUBLIC_SITE_URL: PASS.site,
    PRODUCTION_READY: 'false',
    NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT: `${PASS.cockpit}/api/v1/analytics/events`,
  },
  observability: { enabled: true, redact_query_string: false },
  secrets: { required: [PASS.secretName] },
  d1_databases: [{ binding: 'DB', database_id: good.STAGING_D1_DATABASE_ID, database_name: good.STAGING_D1_DATABASE_NAME }],
};
assertWorkerConfig(config, good);
assert.throws(() => assertWorkerConfig({ ...config, name: 'wrong-worker' }, good));
assert.throws(() => assertWorkerConfig({ ...config, routes: ['unapproved.example.invalid/*'] }, good));
assert.throws(() => assertWorkerConfig({ ...config, vars: { ...config.vars, QONSUL_COCKPIT_INTAKE_URL: 'https://other.example.invalid' } }, good));
assert.throws(() => assertWorkerConfig({ ...config, vars: { ...config.vars, DEPLOYMENT_ENVIRONMENT: 'other' } }, good));
assert.throws(() => assertWorkerConfig({ ...config, observability: { enabled: true } }, good));
assert.throws(() => assertWorkerConfig({ ...config, secrets: { required: [] } }, good));

const historicalConfig = { ...config, name: 'historical-build', vars: {}, observability: { enabled: true }, secrets: undefined };
assert.deepEqual(stageWorkerConfig(historicalConfig, good), config);
const remoteBindings = [
  ...Object.entries(config.vars).map(([name, text]) => ({ name, type: 'plain_text', text })),
  { name: 'DB', type: 'd1', database_id: good.STAGING_D1_DATABASE_ID },
];
const remoteScriptSettings = { observability: { enabled: true, redact_query_string: false } };
assertRemoteStagingConfig(config, remoteBindings, remoteScriptSettings, good);
assert.throws(() => assertRemoteStagingConfig(config, remoteBindings.filter((binding) => binding.name !== 'DEPLOYMENT_ENVIRONMENT'), remoteScriptSettings, good));
assert.throws(() => assertRemoteStagingConfig(config, [...remoteBindings, { name: 'UNEXPECTED_REMOTE_VAR', type: 'plain_text', text: 'unexpected' }], remoteScriptSettings, good));
assert.throws(() => assertRemoteStagingConfig(config, remoteBindings.map((binding) => binding.name === 'PUBLIC_SITE_URL' ? { ...binding, text: 'https://other.example.invalid' } : binding), remoteScriptSettings, good));
assert.throws(() => assertRemoteStagingConfig(config, remoteBindings, { observability: { enabled: true, redact_query_string: true } }, good));
assert.throws(() => assertRemoteStagingConfig(config, remoteBindings.map((binding) => binding.name === 'DB' ? { ...binding, database_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' } : binding), remoteScriptSettings, good));

const fixture = await mkdtemp(path.join(tmpdir(), 'qonsul-staging-payload-'));
const sourceDist = path.join(fixture, 'source', 'dist');
const artifactRoot = path.join(fixture, 'upload');
const downloadedRoot = path.join(fixture, 'download');
await mkdir(path.join(sourceDist, '.openai', 'drizzle'), { recursive: true });
await mkdir(path.join(sourceDist, 'client'), { recursive: true });
await mkdir(path.join(sourceDist, 'server'), { recursive: true });
await writeFile(path.join(sourceDist, '.openai', 'drizzle', 'snapshot.sql'), 'synthetic source-only file');
await writeFile(path.join(sourceDist, 'client', 'index.html'), '<p>synthetic staging payload</p>');
await writeFile(path.join(sourceDist, 'server', 'index.js'), 'export default {};');
await writeFile(path.join(sourceDist, 'server', 'wrangler.json'), JSON.stringify(config));

const manifest = await sealPayload(sourceDist, artifactRoot, good);
assert.deepEqual(manifest.artifact.files.map((file) => file.path), ['client/index.html', 'server/index.js', 'server/wrangler.json']);
const archive = path.join(fixture, 'payload.tar');
execFileSync('tar', ['-cf', archive, '-C', artifactRoot, '.']);
await mkdir(downloadedRoot);
execFileSync('tar', ['-xf', archive, '-C', downloadedRoot]);
await verifyPayload(downloadedRoot, { ...good, EXPECTED_PAYLOAD_SHA256: manifest.artifact.sha256 });

await writeFile(path.join(downloadedRoot, 'dist', 'client', 'index.html'), 'tampered payload');
await assert.rejects(() => verifyPayload(downloadedRoot, good));
const extraRoot = path.join(fixture, 'download-extra');
await mkdir(extraRoot);
execFileSync('tar', ['-xf', archive, '-C', extraRoot]);
await writeFile(path.join(extraRoot, 'dist', 'client', 'extra.txt'), 'unexpected payload file');
await assert.rejects(() => verifyPayload(extraRoot, good));

console.log('PASS one-off Staging pins, strict remote settings, and artifact archive roundtrip');
