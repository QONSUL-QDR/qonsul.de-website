import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deliverIntake,IntakeDeliveryError,signature} from '../lib/cockpit-intake-client.ts';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),secret='phase3c-local-test-secret-with-at-least-32-bytes';
const fixture=async name=>JSON.parse(await readFile(path.join(root,'tests/contracts/phase3c',`${name}.json`),'utf8'));
const contact=await fixture('contact'),ishikawa=await fixture('ishikawa');
assert.deepEqual(Object.keys(contact).sort(),['company','consent','contact','payload','payload_schema_version','source_event_id','submitted_at'].sort());
assert.deepEqual(Object.keys(ishikawa.payload).sort(),['available_data','causes','mode','problem'].sort());
assert.equal(ishikawa.payload.causes.length,1);

let attempts=0;const seen=[];
const mock=async(url,init)=>{attempts++;const body=String(init.body),event=JSON.parse(body),pathName=new URL(url).pathname,timestamp=Number(init.headers['X-Qonsul-Timestamp']);seen.push({event,requestId:init.headers['X-Request-ID']});assert.equal(init.headers['X-Qonsul-Signature'],`v1=${await signature(secret,'POST',pathName,timestamp,event.source_event_id,body)}`);return attempts===1?Response.json({message:'temporary'},{status:503}):Response.json({status:'accepted',reference:'internal-reference'});};
const accepted=await deliverIntake('contact',contact,{baseUrl:'http://localhost:9999',secret,fetchImpl:mock,timeoutMs:1000});
assert.deepEqual(accepted,{status:'accepted',reference:'internal-reference'});
assert.equal(attempts,2);assert.equal(seen[0].event.source_event_id,seen[1].event.source_event_id);assert.equal(seen[0].requestId,seen[1].requestId);

let rejectedCalls=0;
await assert.rejects(()=>deliverIntake('ishikawa',ishikawa,{baseUrl:'http://localhost:9999',secret,fetchImpl:async()=>{rejectedCalls++;return Response.json({message:'invalid'},{status:422});}}),error=>error instanceof IntakeDeliveryError&&!error.transient);
assert.equal(rejectedCalls,1);
await assert.rejects(()=>deliverIntake('contact',contact,{baseUrl:'http://localhost:9999',secret:'short',fetchImpl:mock}),IntakeDeliveryError);

const timestamp=Math.floor(Date.now()/1000),body=JSON.stringify(contact),valid=await signature(secret,'POST','/api/v1/intake/contact',timestamp,contact.source_event_id,body),tampered=JSON.stringify({...contact,payload:{message:'tampered'}}),invalid=await signature(secret,'POST','/api/v1/intake/contact',timestamp,contact.source_event_id,tampered);
assert.notEqual(valid,invalid);
console.log('PASS 12 Cockpit intake contract, HMAC, isolation and retry checks.');
