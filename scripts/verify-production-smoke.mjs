import { assertEvidenceUrl, assertSmokeResponse } from '../lib/production-deployment.mjs';

const [commit, tree] = process.argv.slice(2);
if (!/^[a-f0-9]{40}$/.test(commit || '') || !/^[a-f0-9]{40}$/.test(tree || '')) throw new Error('Smoke test needs validated commit and tree SHAs.');
const base = 'https://qonsul.de';
const get = async (path) => {
  const response = await fetch(`${base}${path}`, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  return { status: response.status, contentType: response.headers.get('content-type') || '', body: await response.text(), response };
};
const homepage = await get('/');
const statusResponse = await get('/api/status');
let statusJson;
try { statusJson = JSON.parse(statusResponse.body); } catch { throw new Error('/api/status did not return JSON.'); }
const robots = await get('/robots.txt');
assertSmokeResponse({ homepage, status: { status: statusResponse.status, json: statusJson, commit, tree }, robots });
assertEvidenceUrl(process.env.PRODUCTION_ROLLBACK_EVIDENCE_URL || '', 'Rollback evidence');
process.stdout.write('PASS production homepage, status identity, robots/canonical strategy, and rollback evidence.\n');
