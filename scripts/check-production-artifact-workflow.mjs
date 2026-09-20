import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertArtifactEntries,
  assertProductionEnvironment,
  assertReleaseInputs,
  assertReleaseTagRuleset,
  assertTagMessage,
  buildReleaseManifest,
  parseAnnotatedTag,
  selectReleaseTagRuleset,
} from '../lib/production-artifact.mjs';

const commit = 'cef82619f109424df2f18028272b6619fad121fc';
const tree = '9a8c2488b7da5f4e447ce930973b076671576e36';
const tag = 'website-production-candidate-2026-09-20';
const ciRunId = '35520678135';

assertReleaseInputs({ tag, commit, tree, ciRunId });
assert.throws(() => assertReleaseInputs({ tag: 'main', commit, tree, ciRunId }));

const parsed = parseAnnotatedTag(`object ${commit}\ntype commit\ntag ${tag}\ntagger Test <test@example.invalid> 0 +0000\n\nProduction candidate only — no deployment performed\n\nCommit: ${commit}\n\nTree: ${tree}\n\nCI-Run: ${ciRunId}\n`);
assert.equal(parsed.object, commit);
assertTagMessage(parsed.message, { commit, tree, ciRunId });
assert.throws(() => assertTagMessage('Commit: wrong', { commit, tree, ciRunId }));

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
  workerName: 'qonsul-production',
  d1DatabaseId: '11111111-2222-4333-8444-555555555555',
  d1DatabaseName: 'qonsul-production-d1',
  publicSiteUrl: 'https://qonsul.de',
});
assert.throws(() => assertProductionEnvironment({ workerName: 'qonsul-quality-engineering', d1DatabaseId: '11111111-2222-4333-8444-555555555555', d1DatabaseName: 'qonsul-production-d1', publicSiteUrl: 'https://qonsul.de' }));
assertArtifactEntries(['dist/', 'dist/server/wrangler.json', 'release-metadata.json']);
assert.throws(() => assertArtifactEntries(['.env', 'release-metadata.json']));

const manifest = buildReleaseManifest({
  provenance: { tag, tagObject: 'a'.repeat(40), commit, tree, ciRunId },
  controlCommit: 'b'.repeat(40),
  workerName: 'qonsul-production',
  d1DatabaseId: '11111111-2222-4333-8444-555555555555',
  d1DatabaseName: 'qonsul-production-d1',
  archiveFile: 'candidate.tar.gz',
  archiveSha256: 'c'.repeat(64),
  archiveSize: 42,
  tools: { node: 'v24.0.0', pnpm: '11.19.0', wrangler: '4.0.0' },
});
assert.equal(manifest.commit, commit);
assert.equal(manifest.artifact.payload_allowlist[0], 'dist/**');

const workflow = await readFile(new URL('../.github/workflows/build-production-candidate.yml', import.meta.url), 'utf8');
assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /^\s*(push|pull_request):/m);
assert.match(workflow, /path:\s*control/);
assert.match(workflow, /path:\s*candidate/);
assert.match(workflow, /validate-production-artifact-inputs\.mjs[\s\S]*git -C control fetch/);
assert.match(workflow, /SOURCE_COMMIT_SHA/);
assert.match(workflow, /deploy --dry-run/);
assert.doesNotMatch(workflow, /wrangler\s+deploy(?!\s+--dry-run)/);
for (const forbidden of ['CLOUDFLARE_API_TOKEN', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'QONSUL_COCKPIT_INTAKE_SECRET']) {
  assert.doesNotMatch(workflow, new RegExp(forbidden));
}

console.log('PASS production candidate validation, environment guards, manifest allowlist, and workflow boundaries');
