import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PRODUCTION_LEGAL_PREVIEW_FILES = Object.freeze(['impressum.html', 'datenschutz.html']);
const MANIFEST_FILE = 'manifest.json';
const OUTPUT_FILES = Object.freeze([...PRODUCTION_LEGAL_PREVIEW_FILES, MANIFEST_FILE]);
const GIT_OBJECT_ID = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function assertGitObjectId(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string.`);
  assert.match(value, GIT_OBJECT_ID, `${label} must be a lowercase 40-character Git object ID.`);
}

function assertRelativePreviewFileName(file) {
  assert.ok(PRODUCTION_LEGAL_PREVIEW_FILES.includes(file), `Unexpected legal-preview file name: ${file}`);
  assert.equal(path.basename(file), file, `Legal-preview file name must not contain a path: ${file}`);
}

function previewFileRecord(file, content) {
  assertRelativePreviewFileName(file);
  assert.equal(typeof content, 'string', `${file} must be rendered HTML text.`);
  const bytes = Buffer.from(content, 'utf8');
  assert.ok(bytes.length > 0, `${file} must not be empty.`);
  return { path: file, sha256: createHash('sha256').update(bytes).digest('hex'), size_bytes: bytes.length };
}

export function buildProductionLegalPreviewManifest({ headCommit, headTree, generatedAtUtc, renderedPages }) {
  assertGitObjectId(headCommit, 'headCommit');
  assertGitObjectId(headTree, 'headTree');
  assert.equal(typeof generatedAtUtc, 'string', 'generatedAtUtc must be a UTC timestamp string.');
  assert.ok(Number.isFinite(Date.parse(generatedAtUtc)) && generatedAtUtc.endsWith('Z'), 'generatedAtUtc must be a valid UTC timestamp.');
  assert.ok(renderedPages && typeof renderedPages === 'object' && !Array.isArray(renderedPages), 'renderedPages must be an object.');
  assert.deepEqual(Object.keys(renderedPages).sort(), [...PRODUCTION_LEGAL_PREVIEW_FILES].sort(), 'renderedPages must contain exactly the two approved legal pages.');
  return {
    schema_version: 1,
    head_commit: headCommit,
    head_tree: headTree,
    generated_at_utc: generatedAtUtc,
    files: PRODUCTION_LEGAL_PREVIEW_FILES.map((file) => previewFileRecord(file, renderedPages[file])),
  };
}

export async function writeProductionLegalPreview({ outputDir, headCommit, headTree, renderedPages, generatedAtUtc = new Date().toISOString() }) {
  assert.equal(typeof outputDir, 'string', 'An explicit output directory is required.');
  assert.ok(path.isAbsolute(outputDir), 'The legal-preview output directory must be absolute.');
  const manifest = buildProductionLegalPreviewManifest({ headCommit, headTree, generatedAtUtc, renderedPages });
  await mkdir(outputDir, { recursive: false });
  for (const file of PRODUCTION_LEGAL_PREVIEW_FILES) await writeFile(path.join(outputDir, file), renderedPages[file], { encoding: 'utf8', flag: 'wx' });
  await writeFile(path.join(outputDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await assertProductionLegalPreviewOutput(outputDir, { headCommit, headTree });
  return manifest;
}

export async function assertProductionLegalPreviewOutput(outputDir, { headCommit, headTree } = {}) {
  assert.equal(typeof outputDir, 'string', 'An explicit output directory is required.');
  assert.ok(path.isAbsolute(outputDir), 'The legal-preview output directory must be absolute.');
  const outputStat = await lstat(outputDir);
  assert.ok(outputStat.isDirectory() && !outputStat.isSymbolicLink(), 'Legal-preview output must be a real directory.');
  const entries = await readdir(outputDir, { withFileTypes: true });
  assert.deepEqual(entries.map((entry) => entry.name).sort(), [...OUTPUT_FILES].sort(), 'Legal-preview output must contain exactly the two HTML files and manifest.json.');
  for (const entry of entries) assert.ok(entry.isFile() && !entry.isSymbolicLink(), `Legal-preview output entry must be a regular file: ${entry.name}`);

  const manifest = JSON.parse(await readFile(path.join(outputDir, MANIFEST_FILE), 'utf8'));
  assert.deepEqual(Object.keys(manifest).sort(), ['files', 'generated_at_utc', 'head_commit', 'head_tree', 'schema_version'], 'Legal-preview manifest has unexpected fields.');
  assert.equal(manifest.schema_version, 1, 'Legal-preview manifest schema version is invalid.');
  assertGitObjectId(manifest.head_commit, 'manifest.head_commit');
  assertGitObjectId(manifest.head_tree, 'manifest.head_tree');
  if (headCommit !== undefined) assert.equal(manifest.head_commit, headCommit, 'Legal-preview manifest commit does not match the PR head.');
  if (headTree !== undefined) assert.equal(manifest.head_tree, headTree, 'Legal-preview manifest tree does not match the PR head tree.');
  assert.equal(typeof manifest.generated_at_utc, 'string', 'Legal-preview manifest timestamp is invalid.');
  assert.ok(Number.isFinite(Date.parse(manifest.generated_at_utc)) && manifest.generated_at_utc.endsWith('Z'), 'Legal-preview manifest timestamp must be UTC.');
  assert.ok(Array.isArray(manifest.files), 'Legal-preview manifest files must be an array.');
  assert.equal(manifest.files.length, PRODUCTION_LEGAL_PREVIEW_FILES.length, 'Legal-preview manifest must list exactly two HTML files.');

  const records = new Map();
  for (const record of manifest.files) {
    assert.ok(record && typeof record === 'object' && !Array.isArray(record), 'Legal-preview manifest file record is invalid.');
    assert.deepEqual(Object.keys(record).sort(), ['path', 'sha256', 'size_bytes'], 'Legal-preview manifest file record has unexpected fields.');
    assertRelativePreviewFileName(record.path);
    assert.ok(!records.has(record.path), `Legal-preview manifest contains a duplicate file: ${record.path}`);
    assert.match(record.sha256, SHA256, `Legal-preview manifest hash is invalid for ${record.path}.`);
    assert.ok(Number.isSafeInteger(record.size_bytes) && record.size_bytes > 0, `Legal-preview manifest size is invalid for ${record.path}.`);
    records.set(record.path, record);
  }
  assert.deepEqual([...records.keys()].sort(), [...PRODUCTION_LEGAL_PREVIEW_FILES].sort(), 'Legal-preview manifest has incorrect HTML file names.');
  for (const file of PRODUCTION_LEGAL_PREVIEW_FILES) {
    const bytes = await readFile(path.join(outputDir, file));
    assert.equal(bytes.length, records.get(file).size_bytes, `Legal-preview byte size does not match manifest for ${file}.`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), records.get(file).sha256, `Legal-preview SHA-256 does not match manifest for ${file}.`);
  }
  return manifest;
}
