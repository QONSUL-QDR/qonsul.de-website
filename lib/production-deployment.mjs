import { sha256, assertArtifactEntries, assertArtifactFileManifest, assertProductionEnvironment, buildIdFor, REQUIRED_CI_WORKFLOW_PATH } from './production-artifact.mjs';
import { assertProductionPublicRuntimeVars } from './production-public-runtime.mjs';

export const DEPLOYMENT_ENVIRONMENT = 'production-deployment';
export const SEALED_ARCHIVE_FILE = 'website-production-candidate.tar.gz';
export const SEALED_MANIFEST_FILE = 'release-manifest.json';
export const APPROVED_WRANGLER_VERSION = '4.127.1';

export function expectedArtifactName(tag, commit) {
  return `production-candidate-${tag}-${commit}`;
}

export function assertDeploymentInputs({ artifactName, tag, commit, tree, digest }) {
  const expected = expectedArtifactName(tag, commit);
  if (artifactName !== expected) throw new Error('Artifact name does not bind the requested candidate tag and commit.');
  if (!/^website-production-candidate-\d{4}-\d{2}-\d{2}$/.test(tag || '')) throw new Error('Deployment tag is not a production-candidate tag.');
  if (!/^[a-f0-9]{40}$/.test(commit || '') || !/^[a-f0-9]{40}$/.test(tree || '')) throw new Error('Deployment commit and tree must be full lowercase SHAs.');
  if (!/^sha256:[a-f0-9]{64}$/.test(digest || '')) throw new Error('GitHub Artifact digest must be sha256-prefixed and complete.');
}

export function assertGitHubArtifact(artifact, { artifactName, digest }) {
  if (!artifact || artifact.name !== artifactName || artifact.digest !== digest || artifact.expired === true || !Number.isSafeInteger(artifact.id)) {
    throw new Error('GitHub Artifact is missing, expired, ambiguous, or does not match its supplied digest.');
  }
}

export function selectGitHubArtifact(artifacts, expected) {
  const matches = (artifacts || []).filter((artifact) => artifact.name === expected.artifactName && artifact.digest === expected.digest && artifact.expired !== true);
  if (matches.length !== 1) throw new Error('Exactly one unexpired GitHub Artifact must match the requested name and digest.');
  assertGitHubArtifact(matches[0], expected);
  return matches[0];
}

export function assertEnvironmentProtection(environment, branchPolicies) {
  const reviewers = environment?.protection_rules?.filter((rule) => rule.type === 'required_reviewers') || [];
  if (environment?.name !== DEPLOYMENT_ENVIRONMENT || reviewers.length !== 1 || !Array.isArray(reviewers[0].reviewers) || reviewers[0].reviewers.length === 0) {
    throw new Error('Production deployment Environment must have at least one required reviewer.');
  }
  const policy = environment?.deployment_branch_policy;
  if (!policy?.custom_branch_policies || policy.protected_branches) throw new Error('Production deployment Environment must use selected-branch policy.');
  if (!Array.isArray(branchPolicies) || branchPolicies.length !== 1 || branchPolicies[0]?.name !== 'main') {
    throw new Error('Production deployment Environment must permit exactly the main branch.');
  }
}

export function assertEvidenceUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} is missing or not an HTTPS evidence URL.`); }
  if (url.protocol !== 'https:' || !url.hostname) throw new Error(`${label} is missing or not an HTTPS evidence URL.`);
}

export function assertSealedManifest(manifest, expected) {
  if (manifest?.schema_version !== 1 || manifest.tag_ref !== `refs/tags/${expected.tag}` || manifest.tag_object !== expected.tagObject || manifest.commit !== expected.commit || manifest.tree !== expected.tree) {
    throw new Error('Release manifest provenance does not match the revalidated candidate tag.');
  }
  if (manifest.build_id !== buildIdFor(expected.commit, expected.tree) || manifest.ci_run_id !== expected.ciRunId || manifest.ci_workflow_id !== expected.ciWorkflowId || manifest.ci_workflow_path !== REQUIRED_CI_WORKFLOW_PATH || manifest.ci_workflow_path !== expected.ciWorkflowPath || !/^[a-f0-9]{40}$/.test(manifest.control_commit || '')) {
    throw new Error('Release manifest build or CI provenance is invalid.');
  }
  if (manifest.artifact?.file !== SEALED_ARCHIVE_FILE || !/^[a-f0-9]{64}$/.test(manifest.artifact?.sha256 || '') || !Number.isSafeInteger(manifest.artifact?.size_bytes)) {
    throw new Error('Release manifest archive metadata is invalid.');
  }
  assertArtifactFileManifest(manifest.artifact.files);
}

export function assertArtifactBindings({ metadata, manifest, workerConfig }) {
  assertProductionPublicRuntimeVars(workerConfig?.vars);
  const expected = { workerName: 'qonsul-de', d1DatabaseId: 'eb2a5897-3116-43f9-88c2-79434ceddc43', d1DatabaseName: 'qonsul-website-d1', publicSiteUrl: 'https://qonsul.de' };
  assertProductionEnvironment(expected);
  const fingerprints = {
    worker_name_sha256: sha256(expected.workerName),
    d1_database_id_sha256: sha256(expected.d1DatabaseId),
    d1_database_name_sha256: sha256(expected.d1DatabaseName),
  };
  for (const source of [metadata, manifest]) {
    if (!source?.binding_fingerprints || Object.entries(fingerprints).some(([name, value]) => source.binding_fingerprints[name] !== value)) {
      throw new Error('Artifact binding fingerprints do not match the approved Production bindings.');
    }
  }
  if (metadata?.public_site_url !== expected.publicSiteUrl) throw new Error('Artifact public site URL is not the approved Production URL.');
  if (workerConfig?.name !== expected.workerName || workerConfig?.topLevelName !== expected.workerName) throw new Error('Artifact is not explicitly sealed for the approved Production Worker.');
  const database = workerConfig?.d1_databases?.find((binding) => binding.binding === 'DB');
  if (!database || database.database_id !== expected.d1DatabaseId || database.database_name !== expected.d1DatabaseName) {
    throw new Error('Artifact DB binding is not the approved Production D1 database.');
  }
  for (const field of ['route', 'routes', 'custom_domain', 'custom_domains', 'migrations', 'd1_migrations']) {
    if (Object.hasOwn(workerConfig, field) && (Array.isArray(workerConfig[field]) ? workerConfig[field].length > 0 : workerConfig[field])) {
      throw new Error(`Deployment artifact contains forbidden infrastructure configuration: ${field}.`);
    }
  }
}

export function assertArchiveEntries(entries) {
  assertArtifactEntries(entries.map((entry) => entry.path));
  for (const entry of entries) {
    if (!['file', 'directory'].includes(entry.type)) throw new Error(`Artifact archive contains a forbidden entry type: ${entry.path}`);
  }
}

export function assertSmokeResponse({ homepage, status, robots }) {
  if (homepage.status !== 200 || !/text\/html/i.test(homepage.contentType || '')) throw new Error('Homepage smoke test did not return HTML with HTTP 200.');
  if (!/name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*nofollow/i.test(homepage.body) && !/content=["'][^"']*noindex[^"']*nofollow[^"']*["'][^>]*name=["']robots/i.test(homepage.body)) {
    throw new Error('Homepage noindex/nofollow robots strategy is missing.');
  }
  const canonical = homepage.body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
  if (canonical && canonical !== 'https://qonsul.de/') throw new Error('Homepage canonical URL is not the approved Production URL.');
  if (status.status !== 200 || status.json?.candidateIdentity?.commit !== status.commit || status.json?.candidateIdentity?.buildId !== `${status.commit}:${status.tree}`) {
    throw new Error('/api/status does not expose the deployed candidate identity.');
  }
  if (![200, 404].includes(robots.status)) throw new Error('Robots smoke endpoint returned an unexpected status.');
  if (robots.status === 200 && !/User-agent:\s*\*/i.test(robots.body)) throw new Error('robots.txt has no general user-agent policy.');
}
