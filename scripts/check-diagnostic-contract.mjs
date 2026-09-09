import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {diagnosticEvent,DIAGNOSTIC_PROCESSING_CONSENT_VERSION} from '../lib/diagnostic-contract.ts';
import {deliverDiagnostic,requestDiagnosticConsultation,DiagnosticDeliveryError} from '../lib/diagnostic-intake-client.ts';

const id='11111111-1111-4111-8111-111111111111';
const analysis={problem:'Synthetisches Qualitätsproblem für den getrennten Diagnostic-Contract.',mode:'rules',availableData:['Prüf- & Messdaten'],causes:[
  {id:'cause-1',category:'Prozess',text:'Eigene synthetische Beobachtung',source:'user'},
  {id:'cause-2',category:'Prozess',text:'Systemische Prüfhypothese',source:'rules',check:'Mit synthetischen Daten prüfen.',data:['Prüf- & Messdaten']},
]};
const event=diagnosticEvent(id,analysis,id);
assert.equal(DIAGNOSTIC_PROCESSING_CONSENT_VERSION,'diagnostic-processing-consent-v1.0-2026-09-03');
assert.deepEqual(Object.keys(event).sort(),['analytics_session_id','available_data','categories','consents','hypotheses','problem','source_event_id']);
assert.deepEqual(event.categories,[{code:'process',causes:['Eigene synthetische Beobachtung']}]);
assert.equal(event.hypotheses.length,1);
assert.match(event.hypotheses[0].title,/Prüfhypothese/);
assert.equal(JSON.stringify(event).includes('contact'),false);
assert.equal(JSON.stringify(event).includes('company'),false);

const secret='diagnostic-local-test-secret-with-at-least-32-bytes';let seen=[];
const fetchImpl=async (url,init)=>{seen.push({url:String(url),init});return Response.json({data:{id,reference:'QD-TEST-000001',status:'completed',evidence_score:50}},{status:201});};
const delivered=await deliverDiagnostic(event,{baseUrl:'https://cockpit.example',secret,fetchImpl});
assert.deepEqual(delivered,{id,reference:'QD-TEST-000001',evidenceScore:50,replayed:false});
assert.equal(new URL(seen[0].url).pathname,'/api/v1/intake/diagnostic');
assert.equal(seen[0].init.headers['X-Qonsul-Signature'].startsWith('v1='),true);
assert.equal('credentials' in seen[0].init,false);

const consultation=await requestDiagnosticConsultation({source_event_id:id,diagnostic_id:id,contact:{name:'Fiktiv',email:'fiktiv@example.invalid'},consent:{contact_requested:true,privacy_version:'2026-08-31-v1'}},{baseUrl:'https://cockpit.example',secret,fetchImpl:async()=>Response.json({status:'pending_review',diagnostic_id:id},{status:201})});
assert.deepEqual(consultation,{status:'pending_review',diagnosticId:id});
await assert.rejects(()=>deliverDiagnostic(event,{baseUrl:'https://cockpit.example',secret:'short',fetchImpl}),DiagnosticDeliveryError);
const diagnosticUi=await readFile(new URL('../app/quality-diagnostic-lab.tsx',import.meta.url),'utf8');
for(const marker of ['fish-layout','fish-lines','fish-problem','AUSGANGSPUNKT','+ Eigene Ursache','Ihre Perspektive ergänzen','Was übersehen wir vielleicht?'])assert.match(diagnosticUi,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(diagnosticUi,/cause\.source === 'user' \? 'Eigene Beobachtung' : 'Ergänzende Hypothese/);
assert.match(diagnosticUi,/fetch\('\/api\/diagnostics'/);
assert.doesNotMatch(diagnosticUi,/\/api\/v1\/intake\/ishikawa/);
console.log('PASS 15 Quality Diagnostic contract, HMAC isolation, domain separation, retry and accepted cause-map UI checks.');
