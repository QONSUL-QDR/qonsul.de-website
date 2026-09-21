import { createHash } from 'node:crypto';

export const RELEASE_TAG_PATTERN = /^website-production-candidate-\d{4}-\d{2}-\d{2}$/;
export const SHA_PATTERN = /^[a-f0-9]{40}$/;
export const TREE_PATTERN = /^[a-f0-9]{40}$/;
export const REQUIRED_TAG_RULES = ['deletion', 'non_fast_forward', 'update'];
export const REQUIRED_CI_WORKFLOW_PATH = '.github/workflows/ci.yml';
export const PRODUCTION_ANALYTICS_ENDPOINT = 'https://cockpit.qonsul.de/api/v1/analytics/events';
export const APPROVED_PRODUCTION_BINDINGS = Object.freeze({
  workerName: 'qonsul-de',
  d1DatabaseId: 'eb2a5897-3116-43f9-88c2-79434ceddc43',
  d1DatabaseName: 'qonsul-website-d1',
  publicSiteUrl: 'https://qonsul.de',
});

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function buildIdFor(commit, tree) {
  if (!SHA_PATTERN.test(commit || '') || !TREE_PATTERN.test(tree || '')) {
    throw new Error('Build ID requires full validated commit and tree SHAs.');
  }
  return `${commit}:${tree}`;
}

export function assertReleaseInputs({ tag, commit, tree, ciRunId }) {
  if (!RELEASE_TAG_PATTERN.test(tag)) throw new Error('Release tag does not match the protected candidate pattern.');
  if (!SHA_PATTERN.test(commit)) throw new Error('Expected commit must be a full lowercase SHA-1.');
  if (!TREE_PATTERN.test(tree)) throw new Error('Expected tree must be a full lowercase SHA-1.');
  if (!/^\d+$/.test(String(ciRunId))) throw new Error('CI run ID must be numeric.');
}

export function parseAnnotatedTag(tagObject) {
  const separator = tagObject.indexOf('\n\n');
  if (separator === -1) throw new Error('Annotated tag has no message separator.');

  const headers = Object.fromEntries(
    tagObject
      .slice(0, separator)
      .split('\n')
      .map((line) => {
        const firstSpace = line.indexOf(' ');
        return firstSpace === -1 ? [line, ''] : [line.slice(0, firstSpace), line.slice(firstSpace + 1)];
      }),
  );

  if (headers.type !== 'commit' || !SHA_PATTERN.test(headers.object || '')) {
    throw new Error('Annotated tag must directly reference a commit.');
  }

  return { object: headers.object, tag: headers.tag || '', message: tagObject.slice(separator + 2) };
}

export function assertTagMessage(message, { commit, tree, ciRunId }) {
  const requiredLines = [
    'Production candidate only — no deployment performed',
    `Commit: ${commit}`,
    `Tree: ${tree}`,
    `CI-Run: ${ciRunId}`,
  ];

  for (const line of requiredLines) {
    if (!message.includes(line)) throw new Error(`Annotated tag message is missing: ${line}`);
  }
}

export function selectReleaseTagRuleset(rulesets) {
  const matches = rulesets.filter((ruleset) => ruleset.target === 'tag' && ruleset.enforcement === 'active');
  if (matches.length !== 1) throw new Error('Exactly one active tag ruleset must be available for release validation.');
  return matches[0].id;
}

export function assertReleaseTagRuleset(ruleset) {
  const includes = ruleset?.conditions?.ref_name?.include || [];
  const types = new Set((ruleset.rules || []).map((rule) => rule.type));
  const matchesPattern = includes.includes('refs/tags/website-production-candidate-*');

  if (ruleset.target !== 'tag' || ruleset.enforcement !== 'active' || !matchesPattern) {
    throw new Error('Active ruleset does not protect the production-candidate tag pattern.');
  }
  for (const rule of REQUIRED_TAG_RULES) {
    if (!types.has(rule)) throw new Error(`Release tag ruleset is missing ${rule} protection.`);
  }
  if (ruleset.current_user_can_bypass !== 'never') {
    throw new Error('Release tag ruleset must not permit the current user to bypass protection.');
  }
}

export function assertSuccessfulCiRun(run, commit) {
  if (run?.status !== 'completed' || run?.conclusion !== 'success' || run?.head_sha !== commit) {
    throw new Error('Referenced CI run is not a successful run for the release commit.');
  }
}

export function assertSuccessfulRequiredCiRun(run, workflow, commit) {
  assertSuccessfulCiRun(run, commit);
  if (!Number.isSafeInteger(workflow?.id) || workflow.path !== REQUIRED_CI_WORKFLOW_PATH) {
    throw new Error('Required CI workflow identity is invalid.');
  }
  if (run.workflow_id !== workflow.id || run.path !== workflow.path) {
    throw new Error('Referenced run does not belong to the required CI workflow file.');
  }
}

export function assertProductionAnalyticsEndpoint(endpoint) {
  if (endpoint !== PRODUCTION_ANALYTICS_ENDPOINT) {
    throw new Error('Production artifact analytics endpoint is not the explicit approved endpoint.');
  }
}

export function assertProductionEnvironment({ workerName, d1DatabaseId, d1DatabaseName, publicSiteUrl }) {
  const expected = APPROVED_PRODUCTION_BINDINGS;
  if (publicSiteUrl !== expected.publicSiteUrl) throw new Error('PUBLIC_SITE_URL differs from the approved Production binding.');
  if (workerName !== expected.workerName) throw new Error('Production Worker name differs from the approved Production binding.');
  if (d1DatabaseId !== expected.d1DatabaseId) throw new Error('Production D1 database ID differs from the approved Production binding.');
  if (d1DatabaseName !== expected.d1DatabaseName) throw new Error('Production D1 database name differs from the approved Production binding.');
}

export function assertArtifactEntries(entries) {
  if (!entries.includes('release-metadata.json')) throw new Error('Artifact payload is missing release metadata.');
  for (const entry of entries) {
    assertArtifactEntryPath(entry, true);
  }
}

function assertArtifactEntryPath(entry, allowDirectory) {
  if (typeof entry !== 'string' || entry.includes('..') || entry.startsWith('/') || entry.includes('\\')) {
    throw new Error(`Unsafe archive entry: ${entry}`);
  }
  if (entry === 'release-metadata.json' || (allowDirectory && entry === 'dist/') || entry.startsWith('dist/')) return;
  throw new Error(`Entry is outside the artifact allowlist: ${entry}`);
}

export function assertArtifactFileManifest(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('Artifact file manifest is empty.');
  if (!files.some((file) => file.path === 'release-metadata.json')) {
    throw new Error('Artifact file manifest is missing release metadata.');
  }
  for (const file of files) {
    const { path: entry, type, sha256: digest, size_bytes: size } = file;
    assertArtifactEntryPath(entry, false);
    if (type !== 'file') throw new Error(`Artifact entry is not a regular file: ${entry}`);
    if (!/^[a-f0-9]{64}$/.test(digest || '')) throw new Error(`Artifact entry has an invalid SHA-256: ${entry}`);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Artifact entry has an invalid byte size: ${entry}`);
  }
}

export function buildReleaseManifest({ provenance, controlCommit, workerName, d1DatabaseId, d1DatabaseName, archiveFile, archiveSha256, archiveSize, artifactFiles, tools }) {
  assertArtifactFileManifest(artifactFiles);
  return {
    schema_version: 1,
    tag_ref: `refs/tags/${provenance.tag}`,
    tag_object: provenance.tagObject,
    commit: provenance.commit,
    tree: provenance.tree,
    ci_run_id: provenance.ciRunId,
    ci_workflow_id: provenance.ciWorkflowId,
    ci_workflow_path: provenance.ciWorkflowPath,
    control_commit: controlCommit,
    build_id: buildIdFor(provenance.commit, provenance.tree),
    binding_fingerprints: {
      worker_name_sha256: sha256(workerName),
      d1_database_id_sha256: sha256(d1DatabaseId),
      d1_database_name_sha256: sha256(d1DatabaseName),
    },
    tools,
    artifact: {
      file: archiveFile,
      sha256: archiveSha256,
      size_bytes: archiveSize,
      payload_allowlist: ['dist/**', 'release-metadata.json'],
      files: artifactFiles,
    },
  };
}
