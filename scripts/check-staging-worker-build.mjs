import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import {
  PRODUCTION_CANDIDATE_PUBLIC_RUNTIME_KEYS,
  STAGING_ANALYTICS_ENDPOINT,
  STAGING_PUBLIC_RUNTIME_V1,
  STAGING_SOURCE,
  STAGING_WORKER_NAME,
} from '../lib/staging-runtime.mjs';

const worker = JSON.parse(await readFile(new URL('../dist/server/wrangler.json', import.meta.url), 'utf8'));
assert.deepEqual(worker.vars, STAGING_PUBLIC_RUNTIME_V1, 'Staging Worker must contain only its allowlisted public runtime values.');
assert.equal(worker.d1_databases?.length, 1, 'Staging Worker must have exactly one isolated D1 binding.');
assert.notEqual(worker.d1_databases[0].database_id, 'eb2a5897-3116-43f9-88c2-79434ceddc43', 'Staging Worker must not use the production D1 database.');
assert.notEqual(worker.d1_databases[0].database_name, 'qonsul-website-d1', 'Staging Worker must not use the production D1 database name.');
for (const key of PRODUCTION_CANDIDATE_PUBLIC_RUNTIME_KEYS) {
  assert.ok(!(key in worker.vars), `Staging Worker must not contain production-candidate variable ${key}.`);
}
const serverRoot = new URL('../dist/server/', import.meta.url);
const files = await readdir(serverRoot, { recursive: true });
const bundle = (await Promise.all(files.filter((file) => file.endsWith('.js')).map((file) => readFile(new URL(file.replaceAll('\\', '/'), serverRoot), 'utf8')))).join('\n');
assert.ok(bundle.includes(STAGING_SOURCE.commit), 'Staging Worker must contain the approved source commit.');
assert.ok(bundle.includes(STAGING_SOURCE.tree), 'Staging Worker must contain the approved source tree.');
assert.ok(bundle.includes(STAGING_ANALYTICS_ENDPOINT), 'Staging Worker must contain only the Cockpit staging analytics endpoint.');
assert.ok(!bundle.includes('https://cockpit.qonsul.de/api/v1/analytics/events'), 'Staging Worker must not contain the production analytics endpoint.');
assert.equal(STAGING_WORKER_NAME, 'qonsul-website-staging-reconciliation');
console.log('PASS Staging Worker build has isolated bindings, source identity, and Cockpit staging analytics only');
