import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const probe=createServer();
await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'localhost',resolve);});
const port=probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const base=`http://localhost:${port}`;
const pkg=JSON.parse(await readFile(path.join(root,'node_modules/vinext/package.json'),'utf8'));
await mkdir(path.join(root,'.wrangler'),{recursive:true});
const log=await open(path.join(root,'.wrangler/integration-server.log'),'w');
const server=spawn(process.execPath,[path.join(root,'node_modules/vinext',pkg.bin.vinext),'dev','--port',String(port)],
  {cwd:root,stdio:['ignore',log.fd,log.fd],detached:process.platform!=='win32',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
let spawnError;
server.on('error',error=>{spawnError=error;});
async function stop(){
  if(server.pid&&server.exitCode===null){
    if(process.platform==='win32')spawnSync('taskkill',['/pid',String(server.pid),'/T','/F'],{stdio:'ignore'});
    else try{process.kill(-server.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
  }
  await log.close();
}
try{
  let ready=false;
  for(let attempt=0;attempt<120;attempt++){
    if(spawnError)throw spawnError;
    if(server.exitCode!==null)throw new Error('Local server exited. See .wrangler/integration-server.log.');
    try{
      const response=await fetch(base+'/api/status',{signal:AbortSignal.timeout(1500)});
      if(response.ok){ready=true;break;}
    }catch{/* Compilation may still be in progress. */}
    await delay(1000);
  }
  if(!ready)throw new Error('Local server did not become ready. See .wrangler/integration-server.log.');
  const test=spawn(process.execPath,[path.join(root,'scripts/check-api.mjs')],{cwd:root,stdio:'inherit',env:{...process.env,TEST_BASE_URL:base}});
  const code=await new Promise((resolve,reject)=>{test.once('error',reject);test.once('exit',resolve);});
  if(code!==0)process.exitCode=1;
}finally{await stop();}
