import { createHash } from 'node:crypto';

export const RELEASE_TAG_PATTERN = /^website-production-candidate-\d{4}-\d{2}-\d{2}$/;
export const SHA_PATTERN = /^[a-f0-9]{40}$/;
export const TREE_PATTERN = /^[a-f0-9]{40}$/;
export const REQUIRED_TAG_RULES = ['deletion', 'non_fast_forward', 'update'];

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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

export function assertProductionEnvironment({ workerName, d1DatabaseId, d1DatabaseName, publicSiteUrl }) {
  if (publicSiteUrl !== 'https://qonsul.de') throw new Error('PUBLIC_SITE_URL must be exactly https://qonsul.de.');
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(workerName || '')) throw new Error('Production Worker name is invalid.');
  if (/staging|preview|workers\.dev|qonsul-quality-engineering/i.test(workerName)) {
    throw new Error('Production Worker name is an obvious non-production target.');
  }
  if (!/^[a-f0-9-]{36}$/i.test(d1DatabaseId || '') || d1DatabaseId === '00000000-0000-4000-8000-000000000000') {
    throw new Error('Production D1 database ID is missing or a placeholder.');
  }
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(d1DatabaseName || '') || /staging|site-creator|qonsul-website-d1/i.test(d1DatabaseName)) {
    throw new Error('Production D1 database name is missing or an obvious non-production target.');
  }
}

export function assertArtifactEntries(entries) {
  if (!entries.includes('release-metadata.json')) throw new Error('Artifact payload is missing release metadata.');
  for (const entry of entries) {
    if (entry.includes('..') || entry.startsWith('/') || entry.includes('\\')) throw new Error(`Unsafe archive entry: ${entry}`);
    if (entry === 'release-metadata.json' || entry === 'dist/' || entry.startsWith('dist/')) continue;
    throw new Error(`Entry is outside the artifact allowlist: ${entry}`);
  }
}

export function buildReleaseManifest({ provenance, controlCommit, workerName, d1DatabaseId, d1DatabaseName, archiveFile, archiveSha256, archiveSize, tools }) {
  return {
    schema_version: 1,
    tag_ref: `refs/tags/${provenance.tag}`,
    tag_object: provenance.tagObject,
    commit: provenance.commit,
    tree: provenance.tree,
    ci_run_id: provenance.ciRunId,
    control_commit: controlCommit,
    build_id: `${provenance.commit}:${provenance.tree}`,
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
    },
  };
}
