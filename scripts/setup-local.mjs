import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const configPath=path.join(root,'.wrangler','local-migrations.json');
await mkdir(path.dirname(configPath),{recursive:true});
const example=await readFile(path.join(root,'.env.example'),'utf8');
const localEnv=example.replace(/^RATE_LIMIT_SALT=.*$/m,`RATE_LIMIT_SALT=${randomBytes(32).toString('hex')}`)
  .replace(/^MAINTENANCE_SECRET=.*$/m,`MAINTENANCE_SECRET=${randomBytes(32).toString('hex')}`);
try{
  await writeFile(path.join(root,'.dev.vars'),localEnv,{flag:'wx',mode:0o600});
  console.log('Created private .dev.vars with local-only random secrets and preview mode.');
}catch(error){
  if(error.code!=='EEXIST')throw error;
  console.log('Existing .dev.vars kept unchanged.');
}
await writeFile(configPath,JSON.stringify({
  name:'qonsul-quality-local',compatibility_date:'2026-05-15',
  d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:'../drizzle'}],
},null,2)+'\n');
// Deliberately local-only: never accept a remote flag, database ID, or reset command.
const result=spawnSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),
  'd1','migrations','apply','DB','--local','--config',configPath,'--persist-to',path.join(root,'.wrangler/state')],
  {cwd:root,stdio:'inherit',env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'}});
if(result.error)throw result.error;
if(result.status!==0){
  console.error('Local migration failed. No reset was attempted. Back up existing data and see docs/OPERATIONS.md before retrying.');
  process.exit(result.status||1);
}
console.log('Local setup is ready. Start with pnpm dev.');
