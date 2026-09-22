import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertArtifactBindings, assertDeploymentInputs, assertEnvironmentProtection, assertEvidenceUrl, assertSealedManifest, assertSmokeResponse, expectedArtifactName, selectGitHubArtifact } from '../lib/production-deployment.mjs';
import { buildReleaseManifest, sha256 } from '../lib/production-artifact.mjs';

const tag = 'website-production-candidate-2026-09-23';
const commit = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const tagObject = 'c'.repeat(40);
const artifactName = expectedArtifactName(tag, commit);
const digest = `sha256:${'d'.repeat(64)}`;
assertDeploymentInputs({ artifactName, tag, commit, tree, digest });
assert.throws(() => assertDeploymentInputs({ artifactName: 'other', tag, commit, tree, digest }));
assert.throws(() => assertDeploymentInputs({ artifactName, tag, commit, tree, digest: 'd'.repeat(64) }));

const artifact = { id: 7, name: artifactName, digest, expired: false, archive_download_url: 'https://example.invalid/artifact.zip' };
assert.equal(selectGitHubArtifact([artifact], { artifactName, digest }).id, 7);
assert.throws(() => selectGitHubArtifact([artifact, { ...artifact, id: 8 }], { artifactName, digest }));
assert.throws(() => selectGitHubArtifact([{ ...artifact, expired: true }], { artifactName, digest }));

const environment = { name: 'production-deployment', protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { login: 'owner' } }] }], deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } };
assertEnvironmentProtection(environment, [{ name: 'main' }]);
assert.throws(() => assertEnvironmentProtection(environment, [{ name: 'main' }, { name: 'release' }]));
assert.throws(() => assertEnvironmentProtection({ ...environment, protection_rules: [] }, [{ name: 'main' }]));
assertEvidenceUrl('https://github.com/QONSUL-QDR/qonsul.de-website/issues/1', 'evidence');
assert.throws(() => assertEvidenceUrl('', 'evidence'));

const artifactFiles = [{ path: 'dist/server/wrangler.json', type: 'file', sha256: '1'.repeat(64), size_bytes: 2 }, { path: 'release-metadata.json', type: 'file', sha256: '2'.repeat(64), size_bytes: 2 }];
const manifest = buildReleaseManifest({ provenance: { tag, tagObject, commit, tree, ciRunId: '42', ciWorkflowId: 1, ciWorkflowPath: '.github/workflows/ci.yml' }, controlCommit: 'e'.repeat(40), workerName: 'qonsul-de', d1DatabaseId: 'eb2a5897-3116-43f9-88c2-79434ceddc43', d1DatabaseName: 'qonsul-website-d1', archiveFile: 'website-production-candidate.tar.gz', archiveSha256: '3'.repeat(64), archiveSize: 4, artifactFiles, tools: { wrangler: '4.127.1' } });
assertSealedManifest(manifest, { tag, tagObject, commit, tree, ciRunId: '42', ciWorkflowId: 1, ciWorkflowPath: '.github/workflows/ci.yml' });
assert.throws(() => assertSealedManifest({ ...manifest, tree: 'f'.repeat(40) }, { tag, tagObject, commit, tree, ciRunId: '42', ciWorkflowId: 1, ciWorkflowPath: '.github/workflows/ci.yml' }));

const fingerprints = { worker_name_sha256: sha256('qonsul-de'), d1_database_id_sha256: sha256('eb2a5897-3116-43f9-88c2-79434ceddc43'), d1_database_name_sha256: sha256('qonsul-website-d1') };
const metadata = { public_site_url: 'https://qonsul.de', binding_fingerprints: fingerprints };
const workerConfig = { name: 'qonsul-de', topLevelName: 'qonsul-de', d1_databases: [{ binding: 'DB', database_id: 'eb2a5897-3116-43f9-88c2-79434ceddc43', database_name: 'qonsul-website-d1' }], migrations: [] };
assertArtifactBindings({ metadata, manifest: { ...manifest, binding_fingerprints: fingerprints }, workerConfig });
assert.throws(() => assertArtifactBindings({ metadata, manifest: { ...manifest, binding_fingerprints: fingerprints }, workerConfig: { ...workerConfig, name: 'other' } }));
assert.throws(() => assertArtifactBindings({ metadata, manifest: { ...manifest, binding_fingerprints: fingerprints }, workerConfig: { ...workerConfig, routes: ['example.com/*'] } }));

const verificationRoot = await mkdtemp(path.join(tmpdir(), 'qonsul-deployment-verification-'));
try {
  const payload = path.join(verificationRoot, 'payload');
  await mkdir(path.join(payload, 'dist', 'server'), { recursive: true });
  const workerBytes = Buffer.from(JSON.stringify(workerConfig));
  const releaseMetadata = { schema_version: 1, tag_ref: `refs/tags/${tag}`, tag_object: tagObject, commit, tree, ci_run_id: '42', ci_workflow_id: 1, ci_workflow_path: '.github/workflows/ci.yml', control_commit: 'e'.repeat(40), build_id: `${commit}:${tree}`, public_site_url: 'https://qonsul.de', binding_fingerprints: fingerprints, tools: { wrangler: '4.127.1' } };
  const metadataBytes = Buffer.from(JSON.stringify(releaseMetadata));
  await writeFile(path.join(payload, 'dist', 'server', 'wrangler.json'), workerBytes);
  await writeFile(path.join(payload, 'release-metadata.json'), metadataBytes);
  const verifiedFiles = [{ path: 'dist/server/wrangler.json', type: 'file', sha256: sha256(workerBytes), size_bytes: workerBytes.length }, { path: 'release-metadata.json', type: 'file', sha256: sha256(metadataBytes), size_bytes: metadataBytes.length }];
  const archivePath = path.join(verificationRoot, 'website-production-candidate.tar.gz');
  execFileSync('tar', ['-czf', archivePath, '-C', payload, 'dist', 'release-metadata.json']);
  const archiveBytes = await readFile(archivePath);
  const verifiedManifest = buildReleaseManifest({ provenance: { tag, tagObject, commit, tree, ciRunId: '42', ciWorkflowId: 1, ciWorkflowPath: '.github/workflows/ci.yml' }, controlCommit: 'e'.repeat(40), workerName: 'qonsul-de', d1DatabaseId: 'eb2a5897-3116-43f9-88c2-79434ceddc43', d1DatabaseName: 'qonsul-website-d1', archiveFile: 'website-production-candidate.tar.gz', archiveSha256: sha256(archiveBytes), archiveSize: archiveBytes.length, artifactFiles: verifiedFiles, tools: { wrangler: '4.127.1' } });
  const manifestPath = path.join(verificationRoot, 'release-manifest.json');
  await writeFile(manifestPath, JSON.stringify(verifiedManifest));
  const verifier = fileURLToPath(new URL('./verify-sealed-production-artifact.mjs', import.meta.url));
  execFileSync(process.execPath, [verifier, '--archive', archivePath, '--manifest', manifestPath, '--tag', tag, '--tag-object', tagObject, '--commit', commit, '--tree', tree, '--ci-run-id', '42', '--ci-workflow-id', '1', '--ci-workflow-path', '.github/workflows/ci.yml', '--output-dir', path.join(verificationRoot, 'materialized')], { stdio: 'pipe' });
  await writeFile(manifestPath, JSON.stringify({ ...verifiedManifest, artifact: { ...verifiedManifest.artifact, sha256: '0'.repeat(64) } }));
  assert.throws(() => execFileSync(process.execPath, [verifier, '--archive', archivePath, '--manifest', manifestPath, '--tag', tag, '--tag-object', tagObject, '--commit', commit, '--tree', tree, '--ci-run-id', '42', '--ci-workflow-id', '1', '--ci-workflow-path', '.github/workflows/ci.yml'], { stdio: 'pipe' }));
} finally { await rm(verificationRoot, { recursive: true, force: true }); }

const homepage = { status: 200, contentType: 'text/html', body: '<meta name="robots" content="noindex, nofollow"><link rel="canonical" href="https://qonsul.de/">' };
assertSmokeResponse({ homepage, status: { status: 200, json: { candidateIdentity: { commit, buildId: `${commit}:${tree}` } }, commit, tree }, robots: { status: 404, body: '' } });
assert.throws(() => assertSmokeResponse({ homepage: { ...homepage, body: '<html>' }, status: { status: 200, json: { candidateIdentity: { commit, buildId: `${commit}:${tree}` } }, commit, tree }, robots: { status: 404, body: '' } }));

const workflow = await readFile(new URL('../.github/workflows/deploy-sealed-production-artifact.yml', import.meta.url), 'utf8');
assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /^\s*(push|pull_request):/m);
for (const input of ['artifact_name', 'release_tag', 'expected_commit', 'expected_tree', 'artifact_digest']) assert.match(workflow, new RegExp(`^\\s{6}${input}:`, 'm'));
assert.match(workflow, /name:\s*production-deployment/);
assert.match(workflow, /refs\/heads\/main/);
assert.match(workflow, /deployment-branch-policies/);
assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
assert.match(workflow, /wrangler@4\.127\.1/);
assert.match(workflow, /verify-sealed-production-artifact/);
assert.match(workflow, /verify-production-deployment-evidence/);
assert.match(workflow, /verify-production-smoke/);
assert.doesNotMatch(workflow, /d1\s+migrations|wrangler\s+d1|routes:\s*|custom_domains:\s*|cloudflare.*dns/i);

console.log('PASS sealed production deployment workflow boundaries, provenance, bindings, evidence gates, and smoke strategy');
