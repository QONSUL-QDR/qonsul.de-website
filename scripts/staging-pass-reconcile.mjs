import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, cp, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PASS = Object.freeze({
  commit: '70464ab0210b43c2e6d71bf980d08a3a01121e33',
  tree: '9cb9e824a5e3c4082d595194dd59d4f083753bff',
  previousCommit: 'af93ddeae19330d8aa091096133e265217bc208a',
  previousTree: 'd946b8c8cd7e5ef33963fb8e81bd021d8141c66f',
  worker: 'qonsul-website-staging-reconciliation',
  site: 'https://qonsul-website-staging-reconciliation.qonsul.workers.dev',
  cockpit: 'https://cockpit-staging.qonsul.de',
  secretName: 'QONSUL_COCKPIT_INTAKE_SECRET',
});

const SOURCE = path.resolve('source');
const ARTIFACT = path.resolve('staging-pass-artifact');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const buildId = `${PASS.commit}:${PASS.tree}`;
const deployId = (runId) => `staging-gh-${runId}`;

export function assertInputs(env = process.env) {
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'Only a manual dispatch may deploy.');
  assert.equal(env.GITHUB_REF, 'refs/heads/main', 'The dispatch must target main.');
  assert.equal(env.QONSUL_COCKPIT_INTAKE_URL, PASS.cockpit, 'Staging intake URL differs from the pinned URL.');
  assert.match(env.STAGING_D1_DATABASE_ID || '', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.equal(env.STAGING_D1_DATABASE_NAME, 'qonsul-website-d1-staging-reconciliation', 'Staging D1 database name differs from the pinned name.');
  assert.match(env.GITHUB_RUN_ID || '', /^[1-9][0-9]*$/);
  assert.match(env.GITHUB_SHA || '', /^[0-9a-f]{40}$/);
  assert.equal(env.GITHUB_RUN_ATTEMPT, '1', 'A rerun cannot deploy this one-off release.');
}

function git(source, ...args) {
  return execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
}

export function assertSource(source = SOURCE) {
  assert.equal(git(source, 'cat-file', '-t', PASS.commit), 'commit');
  assert.equal(git(source, 'rev-parse', 'HEAD'), PASS.commit);
  assert.equal(git(source, 'show', '-s', '--format=%T', 'HEAD'), PASS.tree);
  assert.equal(git(source, 'rev-parse', '--abbrev-ref', 'HEAD'), 'HEAD');
  assert.equal(git(source, 'status', '--porcelain=v1', '--untracked-files=no'), '');
}

const runtimeVars = Object.freeze({
  QONSUL_COCKPIT_INTAKE_URL: PASS.cockpit,
  PUBLIC_SITE_URL: PASS.site,
  PRODUCTION_READY: 'false',
  NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT: `${PASS.cockpit}/api/v1/analytics/events`,
});

export function assertWorkerConfig(config, env = process.env) {
  assert.equal(config.name, PASS.worker);
  assert.equal(config.workers_dev, true);
  assert.ok(!config.route && !config.routes && !config.domain && !config.domains);
  assert.ok(!config.env && !config.dispatch_namespaces?.length);
  assert.ok(!config.triggers || Object.keys(config.triggers).length === 0);
  assert.deepEqual(config.vars, runtimeVars);
  assert.deepEqual(config.secrets, { required: [PASS.secretName] });
  assert.equal(config.main, 'index.js');
  assert.ok(config.assets?.directory);
  assert.equal(config.d1_databases?.length, 1);
  assert.equal(config.d1_databases[0].binding, 'DB');
  assert.equal(config.d1_databases[0].database_id, env.STAGING_D1_DATABASE_ID);
  assert.equal(config.d1_databases[0].database_name, env.STAGING_D1_DATABASE_NAME);
}

async function filesUnder(root) {
  const entries = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      assert.ok(relative.split('/').every((part) => !part.startsWith('.')), `Hidden artifact entry: ${relative}`);
      const stat = await lstat(absolute);
      if (stat.isDirectory()) await walk(absolute);
      else {
        assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Unsafe artifact entry: ${relative}`);
        const bytes = await readFile(absolute);
        entries.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
      }
    }
  }
  await walk(root);
  entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  assert.ok(entries.length > 0);
  return entries;
}

export async function sealPayload(sourceDist, artifactRoot, env = process.env) {
  assertInputs(env);
  await mkdir(artifactRoot);
  await cp(sourceDist, path.join(artifactRoot, 'dist'), {
    recursive: true, force: false, errorOnExist: true,
    // upload-artifact excludes hidden paths by default; copy only that uploadable payload.
    filter: (entry) => {
      const relative = path.relative(sourceDist, entry);
      return relative === '' || relative.split(path.sep).every((part) => !part.startsWith('.'));
    },
  });
  const files = await filesUnder(path.join(artifactRoot, 'dist'));
  const digest = sha256(JSON.stringify(files));
  const manifest = {
    schemaVersion: 1,
    source: { repository: 'QONSUL-QDR/qonsul.de-website', commit: PASS.commit, tree: PASS.tree },
    artifact: { name: `website-staging-pass-${env.GITHUB_RUN_ID}`, sha256: digest, files },
    workflow: { runId: env.GITHUB_RUN_ID, controlCommit: env.GITHUB_SHA },
    deployment: { id: deployId(env.GITHUB_RUN_ID), worker: PASS.worker, site: PASS.site, cockpitUrl: PASS.cockpit },
  };
  await writeFile(path.join(artifactRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `payload_sha256=${digest}\n`);
  console.log(`PASS artifact ${manifest.artifact.name} sha256:${digest} deploy_id=${manifest.deployment.id}`);
  return manifest;
}

async function prepare() {
  assertInputs();
  assertSource();
  const configPath = path.join(SOURCE, 'dist/server/wrangler.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  assert.deepEqual(config.vars, {}, 'Historical build unexpectedly includes runtime vars.');
  assert.ok(!config.route && !config.routes && !config.domain && !config.domains);
  assert.equal(config.d1_databases?.length, 1);
  assert.equal(config.d1_databases[0].binding, 'DB');
  assert.equal(config.d1_databases[0].database_id, process.env.STAGING_D1_DATABASE_ID);
  assert.equal(config.d1_databases[0].database_name, process.env.STAGING_D1_DATABASE_NAME);
  config.name = PASS.worker;
  config.workers_dev = true;
  config.vars = runtimeVars;
  config.secrets = { required: [PASS.secretName] };
  assertWorkerConfig(config);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  await sealPayload(path.join(SOURCE, 'dist'), ARTIFACT);
}

export async function verifyPayload(artifactRoot = ARTIFACT, env = process.env) {
  assertInputs(env);
  assert.deepEqual((await readdir(artifactRoot)).sort(), ['dist', 'manifest.json']);
  assert.ok((await lstat(path.join(artifactRoot, 'dist'))).isDirectory());
  assert.ok((await lstat(path.join(artifactRoot, 'manifest.json'))).isFile());
  const manifest = JSON.parse(await readFile(path.join(artifactRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.source, { repository: 'QONSUL-QDR/qonsul.de-website', commit: PASS.commit, tree: PASS.tree });
  assert.equal(manifest.artifact.name, `website-staging-pass-${env.GITHUB_RUN_ID}`);
  assert.deepEqual(manifest.workflow, { runId: env.GITHUB_RUN_ID, controlCommit: env.GITHUB_SHA });
  assert.deepEqual(manifest.deployment, { id: deployId(env.GITHUB_RUN_ID), worker: PASS.worker, site: PASS.site, cockpitUrl: PASS.cockpit });
  const files = await filesUnder(path.join(artifactRoot, 'dist'));
  assert.deepEqual(files, manifest.artifact.files);
  assert.equal(sha256(JSON.stringify(files)), manifest.artifact.sha256);
  if (env.EXPECTED_PAYLOAD_SHA256) assert.equal(manifest.artifact.sha256, env.EXPECTED_PAYLOAD_SHA256);
  const config = JSON.parse(await readFile(path.join(artifactRoot, 'dist/server/wrangler.json'), 'utf8'));
  assertWorkerConfig(config, env);
  console.log(`PASS artifact sha256:${manifest.artifact.sha256} source=${PASS.commit} tree=${PASS.tree}`);
}

async function cloudflare(pathSuffix) {
  assert.match(process.env.STAGING_CLOUDFLARE_ACCOUNT_ID || '', /^[0-9a-f]{32}$/i);
  assert.ok(process.env.CLOUDFLARE_API_TOKEN, 'Staging Cloudflare token is unavailable.');
  const base = `https://api.cloudflare.com/client/v4/accounts/${process.env.STAGING_CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${PASS.worker}`;
  const response = await fetch(`${base}${pathSuffix}`, {
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
    redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, 'Staging Worker metadata is unavailable.');
  const payload = await response.json();
  assert.equal(payload.success, true, 'Staging Worker metadata was rejected.');
  return payload.result;
}

async function readStatus() {
  const response = await fetch(`${PASS.site}/api/status`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, 'Staging status did not return HTTP 200.');
  return response.json();
}

async function remotePreflight() {
  assertInputs();
  const status = await readStatus();
  assert.equal(status.application, 'qonsul-website');
  assert.equal(status.environment, 'staging');
  assert.equal(status.commit, PASS.previousCommit, 'Staging Worker is no longer at the expected predecessor.');
  assert.equal(status.tree, PASS.previousTree, 'Staging Worker tree has changed.');
  const settings = await cloudflare('/settings');
  const bindings = settings.bindings;
  assert.ok(Array.isArray(bindings));
  const url = bindings.filter((binding) => binding.name === 'QONSUL_COCKPIT_INTAKE_URL');
  assert.equal(url.length, 1);
  assert.equal(url[0].type, 'plain_text');
  assert.equal(url[0].text, PASS.cockpit, 'Staging Worker intake binding is not the pinned URL.');
  const d1 = bindings.filter((binding) => binding.name === 'DB');
  assert.equal(d1.length, 1);
  assert.equal(d1[0].type, 'd1');
  assert.equal(d1[0].database_id, process.env.STAGING_D1_DATABASE_ID);
  const secret = await cloudflare(`/secrets/${PASS.secretName}`);
  assert.equal(secret?.name, PASS.secretName);
  assert.equal(secret?.type, 'secret_text');
  assert.ok(!Object.hasOwn(secret, 'text'), 'Secret metadata unexpectedly contained a value.');
  console.log(`PASS existing staging binding ${PASS.cockpit}; ${PASS.secretName}=present; D1=matched`);
}

async function postDeployStatus() {
  assertInputs();
  const status = await readStatus();
  assert.equal(status.candidateIdentity?.commit, PASS.commit);
  assert.equal(status.candidateIdentity?.buildId, buildId);
  assert.equal(status.ai, true);
  assert.equal(status.diagnosticReady, true);
  console.log(`PASS staging status commit=${PASS.commit} tree=${PASS.tree} deploy_id=${deployId(process.env.GITHUB_RUN_ID)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commands = { inputs: () => assertInputs(), source: () => assertSource(), prepare, verify: verifyPayload, remote: remotePreflight, status: postDeployStatus };
  const command = commands[process.argv[2]];
  if (!command) throw new Error('Expected a fixed staging reconciliation command.');
  await command();
}
