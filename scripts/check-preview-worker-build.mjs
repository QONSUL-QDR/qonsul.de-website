import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worker = JSON.parse(await readFile(new URL('../dist/server/wrangler.json', import.meta.url), 'utf8'));
assert.deepEqual(worker.vars, {}, 'Preview Worker must not contain Production public runtime vars.');
console.log('PASS preview Worker has no Production public runtime vars');
