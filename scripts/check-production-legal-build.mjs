import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, open, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PRODUCTION_PUBLIC_RUNTIME_V1, assertProductionPublicRuntimeVars } from '../lib/production-public-runtime.mjs';
import { writeProductionLegalPreview } from '../lib/production-legal-preview.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
function requiredOption(name) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) throw new Error(`Missing required ${name} option.`);
  return args[index + 1];
}
if (args.length !== 6) throw new Error('Usage: pnpm test:production-legal -- --output-dir <absolute-dir> --head-commit <sha> --head-tree <tree>');
const outputDir = requiredOption('--output-dir');
const headCommit = requiredOption('--head-commit');
const headTree = requiredOption('--head-tree');
if (!path.isAbsolute(outputDir)) throw new Error('The legal-preview output directory must be absolute.');
const config = JSON.parse(await readFile(path.join(root, 'dist/server/wrangler.json'), 'utf8'));
assertProductionPublicRuntimeVars(config.vars);
assert.equal(Object.keys(config.vars).length, 10);

const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', resolve);
});
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
await mkdir(path.join(root, '.wrangler'), { recursive: true });
const log = await open(path.join(root, '.wrangler/production-legal-test.log'), 'w');
const server = spawn(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--local', '--config', 'dist/server/wrangler.json', '--ip', '127.0.0.1', '--port', String(port), '--show-interactive-dev-session=false'], {
  cwd: root,
  stdio: ['ignore', log.fd, log.fd],
  detached: process.platform !== 'win32',
  windowsHide: true,
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false' },
});
let spawnError;
server.on('error', (error) => { spawnError = error; });

try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (spawnError) throw spawnError;
    if (server.exitCode !== null) throw new Error('Local production Worker exited. See .wrangler/production-legal-test.log.');
    try {
      const response = await fetch(`${base}/api/status`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) { ready = true; break; }
    } catch { /* Worker startup is still in progress. */ }
    await delay(1000);
  }
  if (!ready) throw new Error('Local production Worker did not become ready. See .wrangler/production-legal-test.log.');

  const status = await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.productionReady, true);
  assert.equal(status.contactEmail, PRODUCTION_PUBLIC_RUNTIME_V1.PUBLIC_CONTACT_EMAIL);

  const renderedPages = {};
  for (const [route, file, expectedKeys] of [
    ['/impressum', 'impressum.html', ['LEGAL_ENTITY_NAME', 'LEGAL_ADDRESS', 'LEGAL_REPRESENTATIVE', 'LEGAL_PHONE', 'LEGAL_REGISTER', 'LEGAL_VAT_ID', 'LEGAL_EDITORIAL_RESPONSIBLE', 'LEGAL_DISPUTE_RESOLUTION', 'PUBLIC_CONTACT_EMAIL']],
    ['/datenschutz', 'datenschutz.html', ['LEGAL_ENTITY_NAME', 'LEGAL_ADDRESS', 'PUBLIC_CONTACT_EMAIL']],
  ]) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, `${route} must render successfully`);
    const html = await response.text();
    for (const key of expectedKeys) assert.ok(html.includes(PRODUCTION_PUBLIC_RUNTIME_V1[key]), `${route} must render ${key}`);
    assert.doesNotMatch(html, /class="preview-note"|Entwurf vor dem öffentlichen Launch|noch zu ergänzen|vor Freigabe zu hinterlegen|vor Veröffentlichung zu bestätigen|noch zu bestätigen|abhängig von Mitarbeiterzahl/, `${route} must not render draft text or placeholders`);
    renderedPages[file] = html;
  }
  const manifest = await writeProductionLegalPreview({ outputDir, headCommit, headTree, renderedPages });
  console.log(`PASS built Production Worker has exactly ten approved vars, renders both legal pages without draft text or placeholders, and writes verified legal preview evidence for ${manifest.head_commit}`);
} finally {
  try {
    if (server.pid && server.exitCode === null) {
      if (process.platform === 'win32') {
        const stopped = spawnSync('taskkill.exe', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10000, windowsHide: true });
        if (stopped.status !== 0 && server.exitCode === null) throw new Error('Could not stop the local production Worker process tree.');
      } else {
        try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    }
  } finally { await log.close(); }
}
