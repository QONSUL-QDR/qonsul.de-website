import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertArtifactEntries,
  assertProductionEnvironment,
  buildReleaseManifest,
  sha256,
} from '../lib/production-artifact.mjs';

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
};
const controlCommit = readArgument('--control-commit');
const workerName = process.env.PRODUCTION_WORKER_NAME || '';
const d1DatabaseId = process.env.PRODUCTION_D1_DATABASE_ID || '';
const d1DatabaseName = process.env.PRODUCTION_D1_DATABASE_NAME || '';
const publicSiteUrl = process.env.PUBLIC_SITE_URL || '';

assertProductionEnvironment({ workerName, d1DatabaseId, d1DatabaseName, publicSiteUrl });

const workerConfigPath = path.join(candidateDir, 'dist', 'server', 'wrangler.json');
const workerConfig = JSON.parse(await readFile(workerConfigPath, 'utf8'));
const database = workerConfig.d1_databases?.find((binding) => binding.binding === 'DB');
if (!database || database.database_id !== d1DatabaseId || database.database_name !== d1DatabaseName) {
  throw new Error('Built Worker configuration does not match the approved Production D1 binding.');
}

// The source build keeps its hosting-derived name. The sealed deployment config is
// explicitly rebound to the approved Production Worker name without touching source.
workerConfig.name = workerName;
workerConfig.topLevelName = workerName;
await writeFile(workerConfigPath, `${JSON.stringify(workerConfig)}\n`);

await mkdir(outputDir, { recursive: false });
const payloadDir = path.join(outputDir, 'payload');
await mkdir(payloadDir);
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
  control_commit: controlCommit,
  build_id: `${provenance.commit}:${provenance.tree}`,
  public_site_url: publicSiteUrl,
  binding_fingerprints: {
    worker_name_sha256: sha256(workerName),
    d1_database_id_sha256: sha256(d1DatabaseId),
    d1_database_name_sha256: sha256(d1DatabaseName),
  },
  tools,
};
await writeFile(path.join(payloadDir, 'release-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);

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
  tools,
});
await writeFile(path.join(outputDir, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ archivePath, manifestPath: path.join(outputDir, 'release-manifest.json'), archiveSha256 })}\n`);
