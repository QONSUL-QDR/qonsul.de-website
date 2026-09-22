import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertArtifactEntries,
  assertArtifactFileManifest,
  assertProductionAnalyticsEndpoint,
  assertProductionEnvironment,
  assertReleaseInputs,
  assertReleaseTagRuleset,
  assertTagMessage,
  assertSuccessfulRequiredCiRun,
  buildIdFor,
  buildReleaseManifest,
  parseAnnotatedTag,
  selectReleaseTagRuleset,
} from '../lib/production-artifact.mjs';

const commit = 'cef82619f109424df2f18028272b6619fad121fc';
const tree = '9a8c2488b7da5f4e447ce930973b076671576e36';
const tag = 'website-production-candidate-2026-09-20';
const ciRunId = '35520678135';
const ciWorkflow = { id: 42, path: '.github/workflows/ci.yml' };

assertReleaseInputs({ tag, commit, tree, ciRunId });
assert.throws(() => assertReleaseInputs({ tag: 'main', commit, tree, ciRunId }));

const parsed = parseAnnotatedTag(`object ${commit}\ntype commit\ntag ${tag}\ntagger Test <test@example.invalid> 0 +0000\n\nProduction candidate only — no deployment performed\n\nCommit: ${commit}\n\nTree: ${tree}\n\nCI-Run: ${ciRunId}\n`);
assert.equal(parsed.object, commit);
assertTagMessage(parsed.message, { commit, tree, ciRunId });
assert.throws(() => assertTagMessage('Commit: wrong', { commit, tree, ciRunId }));
assertSuccessfulRequiredCiRun({ status: 'completed', conclusion: 'success', head_sha: commit, workflow_id: 42, path: '.github/workflows/ci.yml' }, ciWorkflow, commit);
assert.throws(() => assertSuccessfulRequiredCiRun({ status: 'completed', conclusion: 'success', head_sha: commit, workflow_id: 99, path: '.github/workflows/other.yml' }, ciWorkflow, commit));
assert.equal(buildIdFor(commit, tree), `${commit}:${tree}`);

const ruleset = {
  id: 1,
  target: 'tag',
  enforcement: 'active',
  conditions: { ref_name: { include: ['refs/tags/website-production-candidate-*'] } },
  rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }, { type: 'update' }],
  current_user_can_bypass: 'never',
};
assert.equal(selectReleaseTagRuleset([ruleset]), 1);
assertReleaseTagRuleset(ruleset);
assert.throws(() => assertReleaseTagRuleset({ ...ruleset, current_user_can_bypass: 'always' }));

assertProductionEnvironment({
  workerName: 'qonsul-de',
  d1DatabaseId: 'eb2a5897-3116-43f9-88c2-79434ceddc43',
  d1DatabaseName: 'qonsul-website-d1',
  publicSiteUrl: 'https://qonsul.de',
});
assert.throws(() => assertProductionEnvironment({ workerName: 'qonsul-quality-engineering', d1DatabaseId: 'eb2a5897-3116-43f9-88c2-79434ceddc43', d1DatabaseName: 'qonsul-website-d1', publicSiteUrl: 'https://qonsul.de' }));
assert.throws(() => assertProductionEnvironment({ workerName: 'qonsul-de', d1DatabaseId: '11111111-2222-4333-8444-555555555555', d1DatabaseName: 'qonsul-website-d1', publicSiteUrl: 'https://qonsul.de' }));
assert.throws(() => assertProductionEnvironment({ workerName: 'qonsul-de', d1DatabaseId: 'eb2a5897-3116-43f9-88c2-79434ceddc43', d1DatabaseName: 'qonsul-website-d1-staging', publicSiteUrl: 'https://qonsul.de' }));
assertArtifactEntries(['dist/', 'dist/server/wrangler.json', 'release-metadata.json']);
assert.throws(() => assertArtifactEntries(['.env', 'release-metadata.json']));
const artifactFiles = [
  { path: 'dist/server/index.js', type: 'file', sha256: 'd'.repeat(64), size_bytes: 12 },
  { path: 'release-metadata.json', type: 'file', sha256: 'e'.repeat(64), size_bytes: 4 },
];
assertArtifactFileManifest(artifactFiles);
assert.throws(() => assertArtifactFileManifest([{ ...artifactFiles[0], type: 'symlink' }, artifactFiles[1]]));
assert.throws(() => assertArtifactFileManifest([{ ...artifactFiles[0], path: '../outside' }, artifactFiles[1]]));
assert.throws(() => assertArtifactFileManifest([{ ...artifactFiles[0], path: '/outside' }, artifactFiles[1]]));
assertProductionAnalyticsEndpoint('https://cockpit.qonsul.de/api/v1/analytics/events');
assert.throws(() => assertProductionAnalyticsEndpoint('https://staging.qonsul.de/api/v1/analytics/events'));

const manifest = buildReleaseManifest({
  provenance: { tag, tagObject: 'a'.repeat(40), commit, tree, ciRunId, ciWorkflowId: 42, ciWorkflowPath: '.github/workflows/ci.yml' },
  controlCommit: 'b'.repeat(40),
  workerName: 'qonsul-de',
  d1DatabaseId: 'eb2a5897-3116-43f9-88c2-79434ceddc43',
  d1DatabaseName: 'qonsul-website-d1',
  archiveFile: 'candidate.tar.gz',
  archiveSha256: 'c'.repeat(64),
  archiveSize: 42,
  artifactFiles,
  tools: { node: 'v24.0.0', pnpm: '11.19.0', wrangler: '4.0.0' },
});
assert.equal(manifest.commit, commit);
assert.equal(manifest.artifact.payload_allowlist[0], 'dist/**');
assert.equal(manifest.ci_workflow_path, '.github/workflows/ci.yml');
assert.equal(manifest.artifact.files.length, 2);

const artifactTestRoot = await mkdtemp(path.join(tmpdir(), 'qonsul-artifact-test-'));
try {
  const candidateDir = path.join(artifactTestRoot, 'candidate');
  const serverDir = path.join(candidateDir, 'dist', 'server');
  await mkdir(serverDir, { recursive: true });
  await writeFile(path.join(serverDir, 'wrangler.json'), JSON.stringify({ d1_databases: [{ binding: 'DB', database_id: 'eb2a5897-3116-43f9-88c2-79434ceddc43', database_name: 'qonsul-website-d1' }] }));
  await writeFile(path.join(serverDir, 'index.js'), 'export default {};\n');
  try {
    await symlink('index.js', path.join(serverDir, 'forbidden-link.js'), 'file');
  } catch (error) {
    if (error?.code !== 'EPERM') throw error;
    await symlink(serverDir, path.join(candidateDir, 'dist', 'forbidden-link'), 'junction');
  }
  let symlinkError;
  try {
    execFileSync(process.execPath, [fileURLToPath(new URL('./seal-production-artifact.mjs', import.meta.url)), '--candidate-dir', candidateDir, '--output-dir', path.join(artifactTestRoot, 'output'), '--tag', tag, '--tag-object', 'a'.repeat(40), '--commit', commit, '--tree', tree, '--ci-run-id', ciRunId, '--ci-workflow-id', '42', '--ci-workflow-path', '.github/workflows/ci.yml', '--control-commit', 'b'.repeat(40)], { env: { ...process.env, PRODUCTION_WORKER_NAME: 'qonsul-de', PRODUCTION_D1_DATABASE_ID: 'eb2a5897-3116-43f9-88c2-79434ceddc43', PRODUCTION_D1_DATABASE_NAME: 'qonsul-website-d1', PUBLIC_SITE_URL: 'https://qonsul.de' }, stdio: 'pipe' });
  } catch (error) {
    symlinkError = error;
  }
  assert.ok(symlinkError, 'Artifact sealing must reject a payload symlink.');
  assert.match(String(symlinkError.stderr), /Symbolic links are forbidden/);
} finally {
  await rm(artifactTestRoot, { recursive: true, force: true });
}

const workflow = await readFile(new URL('../.github/workflows/build-production-candidate.yml', import.meta.url), 'utf8');
const ciWorkflowFile = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const viteConfig = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
const corepackBootstrapMatch = workflow.match(/- name: Enable the versioned pnpm with Corepack\r?\n\s+working-directory: candidate\r?\n\s+run: \|\r?\n((?: {10}.+\r?\n)+) {6}- name: Install candidate dependencies reproducibly/);
assert.ok(corepackBootstrapMatch, 'The Corepack bootstrap step must be present before candidate dependency installation.');
const corepackBootstrap = corepackBootstrapMatch[1].replace(/^ {10}/gm, '');
assert.match(corepackBootstrap, /node -p 'require\("\.\/package\.json"\)\.packageManager\.replace\(\/\^pnpm@\/, ""\)'/);
assert.doesNotMatch(corepackBootstrap, /\\"require\(/);
if (process.platform === 'linux') {
  execFileSync('bash', ['-e', '-u', '-o', 'pipefail', '-c', corepackBootstrap], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    stdio: 'pipe',
  });
}
assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /^\s*(push|pull_request):/m);
assert.match(workflow, /path:\s*control/);
assert.match(workflow, /path:\s*candidate/);
assert.match(workflow, /validate-production-artifact-inputs\.mjs[\s\S]*git -C control fetch/);
assert.match(workflow, /SOURCE_COMMIT_SHA/);
assert.match(workflow, /SOURCE_BUILD_ID/);
assert.match(workflow, /ci\.yml/);
assert.match(workflow, /PRODUCTION_ARTIFACT_BUILD/);
assert.match(workflow, /PRODUCTION_ANALYTICS_ENDPOINT/);
assert.match(workflow, /name:\s*Enable the versioned pnpm with Corepack[\s\S]*working-directory:\s*candidate[\s\S]*corepack enable[\s\S]*packageManager\.replace\(\/\^pnpm@\/,[\s\S]*corepack pnpm --version/);
assert.match(workflow, /Enable the versioned pnpm with Corepack[\s\S]*corepack pnpm install --frozen-lockfile --ignore-scripts/);
for (const command of ['install --frozen-lockfile --ignore-scripts', 'setup:local', 'typecheck', 'test', 'test:integration', 'lint', 'build', 'exec wrangler deploy --dry-run', 'exec wrangler --version']) {
  assert.match(workflow, new RegExp(`corepack pnpm ${command.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`));
}
assert.match(workflow, /deploy --dry-run/);
assert.doesNotMatch(workflow, /wrangler\s+deploy(?!\s+--dry-run)/);
assert.match(ciWorkflowFile, /- run: pnpm test:integration\r?\n\s+- run: pnpm lint\r?\n\s+- run: pnpm build/);
assert.match(viteConfig, /assertProductionAnalyticsEndpoint/);
assert.match(viteConfig, /isProductionArtifactBuild \? \[\] : \[sites\(\)\]/);
assert.match(viteConfig, /__QONSUL_SOURCE_COMMIT_SHA__/);
for (const forbidden of ['CLOUDFLARE_API_TOKEN', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'QONSUL_COCKPIT_INTAKE_SECRET']) {
  assert.doesNotMatch(workflow, new RegExp(forbidden));
}

console.log('PASS production candidate validation, environment guards, manifest allowlist, and workflow boundaries');
