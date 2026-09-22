import { gunzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sha256 } from '../lib/production-artifact.mjs';
import { assertArchiveEntries, assertArtifactBindings, assertSealedManifest } from '../lib/production-deployment.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing ${name}.`);
  return process.argv[index + 1];
}

function field(bytes, offset, length) {
  return Buffer.from(bytes.subarray(offset, offset + length)).toString('utf8').replace(/\0.*$/, '');
}

function octal(bytes, offset, length) {
  const raw = field(bytes, offset, length).trim();
  if (!/^[0-7]*$/.test(raw)) throw new Error('Artifact TAR has an invalid size field.');
  return raw ? Number.parseInt(raw, 8) : 0;
}

function safePath(value) {
  if (!value || value.includes('..') || value.startsWith('/') || value.includes('\\')) throw new Error(`Unsafe TAR entry: ${value}`);
}

function parseTar(compressed) {
  const bytes = gunzipSync(compressed);
  const entries = [];
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = field(header, 0, 100);
    const prefix = field(header, 345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    safePath(path);
    const typeFlag = String.fromCharCode(header[156]);
    const type = typeFlag === '5' ? 'directory' : (typeFlag === '\0' || typeFlag === '0' ? 'file' : 'forbidden');
    const size = octal(header, 124, 12);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) throw new Error(`Artifact TAR is truncated at ${path}.`);
    entries.push({ path, type, bytes: bytes.subarray(dataStart, dataEnd) });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  if (!entries.length) throw new Error('Artifact TAR is empty.');
  return entries;
}

const archivePath = argument('--archive');
const manifestPath = argument('--manifest');
const expected = {
  tag: argument('--tag'),
  tagObject: argument('--tag-object'),
  commit: argument('--commit'),
  tree: argument('--tree'),
  ciRunId: argument('--ci-run-id'),
  ciWorkflowId: Number(argument('--ci-workflow-id')),
  ciWorkflowPath: argument('--ci-workflow-path'),
};
const outputIndex = process.argv.indexOf('--output-dir');
const outputDirectory = outputIndex === -1 ? '' : process.argv[outputIndex + 1];
if (outputIndex !== -1 && !outputDirectory) throw new Error('Missing --output-dir value.');
const archive = await readFile(archivePath);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
assertSealedManifest(manifest, expected);
if (manifest.artifact.sha256 !== sha256(archive) || manifest.artifact.size_bytes !== archive.length) throw new Error('Sealed archive hash or byte size does not match release manifest.');

const entries = parseTar(archive);
assertArchiveEntries(entries);
const files = new Map(entries.filter((entry) => entry.type === 'file').map((entry) => [entry.path, entry]));
if (files.size !== manifest.artifact.files.length) throw new Error('Artifact TAR file count does not match release manifest.');
for (const file of manifest.artifact.files) {
  const entry = files.get(file.path);
  if (!entry || entry.bytes.length !== file.size_bytes || sha256(entry.bytes) !== file.sha256) throw new Error(`Artifact file hash does not match release manifest: ${file.path}`);
}

const metadataEntry = files.get('release-metadata.json');
const configEntry = files.get('dist/server/wrangler.json');
if (!metadataEntry || !configEntry) throw new Error('Artifact is missing release metadata or Worker configuration.');
const metadata = JSON.parse(metadataEntry.bytes.toString('utf8'));
const workerConfig = JSON.parse(configEntry.bytes.toString('utf8'));
for (const field of ['tag_ref', 'tag_object', 'commit', 'tree', 'ci_run_id', 'ci_workflow_id', 'ci_workflow_path', 'build_id']) {
  if (metadata[field] !== manifest[field]) throw new Error(`Release metadata does not match release manifest: ${field}`);
}
assertArtifactBindings({ metadata, manifest, workerConfig });
if (outputDirectory) {
  await mkdir(outputDirectory, { recursive: false });
  for (const entry of entries) {
    const destination = path.resolve(outputDirectory, entry.path);
    if (!destination.startsWith(`${path.resolve(outputDirectory)}${path.sep}`)) throw new Error(`Unsafe materialization target: ${entry.path}`);
    if (entry.type === 'directory') await mkdir(destination, { recursive: false });
    else {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, entry.bytes, { flag: 'wx' });
    }
  }
}
process.stdout.write(`${JSON.stringify({ ciRunId: manifest.ci_run_id, ciWorkflowId: manifest.ci_workflow_id, ciWorkflowPath: manifest.ci_workflow_path, buildId: manifest.build_id })}\n`);
