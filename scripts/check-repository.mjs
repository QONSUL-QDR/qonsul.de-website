import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const prohibited=files.filter(file=>/(^|\/)(\.dev\.vars(?:\..*)?|\.env(?:\..*)?|node_modules|\.wrangler|backups)(\/|$)/.test(file)&&file!=='.env.example'
  ||/\.(?:sqlite(?:-wal|-shm)?|db(?:-wal|-shm)?|bundle|key|pem|p12|pfx)$/i.test(file));
assert.deepEqual(prohibited,[],'Private configuration, database files, or backups must not be tracked');
const patterns=[/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{40,}\b/,/\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,/\bre_[A-Za-z0-9]{24,}\b/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
for(const file of files.filter(file=>/\.(?:[cm]?[jt]sx?|json|ya?ml|md|toml|example)$/.test(file))){
  const text=await readFile(file,'utf8');
  assert.ok(!patterns.some(pattern=>pattern.test(text)),`Potential credential in ${file}; inspect locally without printing its value`);
}
const manifest=JSON.parse(await readFile('docs/assets-manifest.json','utf8'));
for(const asset of manifest.assets){
  assert.ok(asset.path.startsWith('public/')&&!asset.path.includes('..'),'Asset path must stay inside public');
  const digest=createHash('sha256').update(await readFile(asset.path)).digest('hex');
  assert.equal(digest,asset.sha256,`Asset changed or missing: ${asset.path}. Review provenance and update its checksum deliberately.`);
}
const publicFiles=files.filter(file=>file.startsWith('public/')).sort();
assert.deepEqual(manifest.assets.map(asset=>asset.path).sort(),publicFiles,'All public assets must be included in the handoff inventory');
console.log(`PASS Repository hygiene and integrity of ${manifest.assets.length} public assets (not a complete security audit)`);
