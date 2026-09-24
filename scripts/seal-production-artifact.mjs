import { execFileSync } from 'node:child_process';
import { cp, lstat, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertArtifactEntries,
  assertArtifactFileManifest,
  assertProductionEnvironment,
  buildReleaseManifest,
  buildIdFor,
  sha256,
} from '../lib/production-artifact.mjs';
import { assertProductionPublicRuntimeVars } from '../lib/production-public-runtime.mjs';

function readArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing ${name}.`);
  return process.argv[index + 1];
}

const candidateDir = path.resolve(readArgument('--candidate-dir'));
const outputDir = path.resolve(readArgument('--output-dir'));
const provenance = {
  tag: readArgument('--tag'),
  tagObject: readArgument('--tag-object'),
  commit: readArgument('--commit'),
  tree: readArgument('--tree'),
  ciRunId: readArgument('--ci-run-id'),
  ciWorkflowId: Number(readArgument('--ci-workflow-id')),
  ciWorkflowPath: readArgument('--ci-workflow-path'),
};
const controlCommit = readArgument('--control-commit');
const workerName = process.env.PRODUCTION_WORKER_NAME || '';
const d1DatabaseId = process.env.PRODUCTION_D1_DATABASE_ID || '';
const d1DatabaseName = process.env.PRODUCTION_D1_DATABASE_NAME || '';
const publicSiteUrl = process.env.PUBLIC_SITE_URL || '';

assertProductionEnvironment({ workerName, d1DatabaseId, d1DatabaseName, publicSiteUrl });
buildIdFor(provenance.commit, provenance.tree);

const workerConfigPath = path.join(candidateDir, 'dist', 'server', 'wrangler.json');
const workerConfig = JSON.parse(await readFile(workerConfigPath, 'utf8'));
assertProductionPublicRuntimeVars(workerConfig.vars);
const database = workerConfig.d1_databases?.find((binding) => binding.binding === 'DB');
if (!database || database.database_id !== d1DatabaseId || database.database_name !== d1DatabaseName) {
  throw new Error('Built Worker configuration does not match the approved Production D1 binding.');
}

// The source build keeps its hosting-derived name. The sealed deployment config is
// explicitly rebound to the approved Production Worker name without touching source.
workerConfig.name = workerName;
workerConfig.topLevelName = workerName;
await writeFile(workerConfigPath, `${JSON.stringify(workerConfig)}\n`);

function assertSafeArtifactPath(relativePath) {
  if (!relativePath || relativePath.includes('..') || path.isAbsolute(relativePath) || relativePath.includes('\\')) {
    throw new Error(`Unsafe artifact payload path: ${relativePath}`);
  }
}

async function collectRegularFiles(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryRelative = path.posix.join(relative.replaceAll('\\', '/'), entry.name);
    assertSafeArtifactPath(entryRelative);
    const entryPath = path.join(root, entryRelative);
    const entryStat = await lstat(entryPath);
    if (entryStat.isSymbolicLink()) throw new Error(`Symbolic links are forbidden in artifact payloads: ${entryRelative}`);
    if (entryStat.isDirectory()) {
      files.push(...await collectRegularFiles(root, entryRelative));
    } else if (entryStat.isFile()) {
      const bytes = await readFile(entryPath);
      files.push({ path: entryRelative, type: 'file', sha256: sha256(bytes), size_bytes: bytes.length });
    } else {
      throw new Error(`Artifact payload entry is not a regular file: ${entryRelative}`);
    }
  }
  return files;
}

await mkdir(outputDir, { recursive: false });
const payloadDir = path.join(outputDir, 'payload');
await mkdir(payloadDir);
// Reject links and special files in the candidate output before any copy or archive operation.
await collectRegularFiles(path.join(candidateDir, 'dist'));
await cp(path.join(candidateDir, 'dist'), path.join(payloadDir, 'dist'), { recursive: true, force: false });

const tools = {
  node: process.version,
  pnpm: process.env.ARTIFACT_PNPM_VERSION || 'unknown',
  wrangler: process.env.ARTIFACT_WRANGLER_VERSION || 'unknown',
};
const metadata = {
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
  public_site_url: publicSiteUrl,
  binding_fingerprints: {
    worker_name_sha256: sha256(workerName),
    d1_database_id_sha256: sha256(d1DatabaseId),
    d1_database_name_sha256: sha256(d1DatabaseName),
  },
  tools,
};
await writeFile(path.join(payloadDir, 'release-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);

const artifactFiles = (await collectRegularFiles(payloadDir)).sort((left, right) => left.path.localeCompare(right.path));
assertArtifactFileManifest(artifactFiles);

const archiveFile = 'website-production-candidate.tar.gz';
const archivePath = path.join(outputDir, archiveFile);
const tarArguments = process.platform === 'win32'
  ? ['-czf', archivePath, '-C', payloadDir, 'dist', 'release-metadata.json']
  : ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '-czf', archivePath, '-C', payloadDir, 'dist', 'release-metadata.json'];
execFileSync('tar', tarArguments, { stdio: 'inherit' });
const archiveSha256 = sha256(await readFile(archivePath));
const archiveSize = (await stat(archivePath)).size;
const entries = execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
assertArtifactEntries(entries);

const manifest = buildReleaseManifest({
  provenance,
  controlCommit,
  workerName,
  d1DatabaseId,
  d1DatabaseName,
  archiveFile,
  archiveSha256,
  archiveSize,
  artifactFiles,
  tools,
});
await writeFile(path.join(outputDir, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ archivePath, manifestPath: path.join(outputDir, 'release-manifest.json'), archiveSha256 })}\n`);
