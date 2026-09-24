import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertProductionLegalPreviewOutput, buildProductionLegalPreviewManifest, writeProductionLegalPreview } from '../lib/production-legal-preview.mjs';

const commit = 'cef82619f109424df2f18028272b6619fad121fc';
const tree = '9a8c2488b7da5f4e447ce930973b076671576e36';
const renderedPages = { 'impressum.html': '<!doctype html><title>Impressum</title>', 'datenschutz.html': '<!doctype html><title>Datenschutz</title>' };
const args = process.argv.slice(2);
const verifyIndex = args.indexOf('--verify-output');
if (verifyIndex !== -1 && (args.length !== 2 || !args[verifyIndex + 1])) throw new Error('Usage: node scripts/check-production-legal-preview.mjs [--verify-output <absolute-output-dir>]');
if (verifyIndex === -1 && args.length) throw new Error('Usage: node scripts/check-production-legal-preview.mjs [--verify-output <absolute-output-dir>]');

const manifest = buildProductionLegalPreviewManifest({ headCommit: commit, headTree: tree, generatedAtUtc: '2026-09-24T12:00:00.000Z', renderedPages });
assert.deepEqual(manifest.files.map((record) => record.path), ['impressum.html', 'datenschutz.html']);
assert.equal(manifest.files[0].size_bytes, Buffer.byteLength(renderedPages['impressum.html']));
assert.equal(manifest.files[1].size_bytes, Buffer.byteLength(renderedPages['datenschutz.html']));
assert.match(manifest.files[0].sha256, /^[0-9a-f]{64}$/);
assert.match(manifest.files[1].sha256, /^[0-9a-f]{64}$/);

const testRoot = await mkdtemp(path.join(tmpdir(), 'qonsul-production-legal-preview-'));
try {
  const outputDir = path.join(testRoot, 'output');
  await writeProductionLegalPreview({ outputDir, headCommit: commit, headTree: tree, generatedAtUtc: '2026-09-24T12:00:00.000Z', renderedPages });
  await assertProductionLegalPreviewOutput(outputDir, { headCommit: commit, headTree: tree });

  await unlink(path.join(outputDir, 'datenschutz.html'));
  await assert.rejects(assertProductionLegalPreviewOutput(outputDir), /exactly the two HTML files/);

  const tamperedDir = path.join(testRoot, 'tampered');
  await writeProductionLegalPreview({ outputDir: tamperedDir, headCommit: commit, headTree: tree, generatedAtUtc: '2026-09-24T12:00:00.000Z', renderedPages });
  await writeFile(path.join(tamperedDir, 'impressum.html'), '<!doctype html><title>Manipuliert</title>');
  await assert.rejects(assertProductionLegalPreviewOutput(tamperedDir), /SHA-256|byte size/);

  const manifestDir = path.join(testRoot, 'bad-manifest');
  await writeProductionLegalPreview({ outputDir: manifestDir, headCommit: commit, headTree: tree, generatedAtUtc: '2026-09-24T12:00:00.000Z', renderedPages });
  const badManifest = JSON.parse(await readFile(path.join(manifestDir, 'manifest.json'), 'utf8'));
  badManifest.files[0].path = 'unexpected.html';
  await writeFile(path.join(manifestDir, 'manifest.json'), JSON.stringify(badManifest));
  await assert.rejects(assertProductionLegalPreviewOutput(manifestDir), /Unexpected legal-preview file name/);
} finally {
  await rm(testRoot, { recursive: true, force: true });
}

if (verifyIndex !== -1) {
  const outputDir = path.resolve(args[verifyIndex + 1]);
  await assertProductionLegalPreviewOutput(outputDir);
}

console.log('PASS production legal-preview manifest names, hashes, sizes, and fail-closed output validation');
