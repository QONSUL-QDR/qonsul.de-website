import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {diagnosticEvent,DIAGNOSTIC_PROCESSING_CONSENT_VERSION} from '../lib/diagnostic-contract.ts';
import {deliverDiagnostic,requestDiagnosticConsultation,DiagnosticDeliveryError} from '../lib/diagnostic-intake-client.ts';
import {invalidateDraftSubmissionId,submissionIdForSave,withSavingState} from '../lib/diagnostic-submission-lifecycle.ts';

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

const browserBlindspots={...analysis,causes:[
  analysis.causes[0],
  {id:'blindspot-product',category:'Produkt',text:'Synthetische Produkt-Hypothese',source:'rules'},
  {id:'blindspot-process',category:'Prozess',text:'Synthetische Prozess-Hypothese',source:'rules'},
]};
const browserBlindspotEvent=diagnosticEvent('22222222-2222-4222-8222-222222222222',browserBlindspots);
assert.deepEqual(browserBlindspotEvent.categories,[{code:'product'},{code:'process',causes:['Eigene synthetische Beobachtung']}], 'Browser blind spots must include every hypothesis category so Cockpit accepts its category_code.');

const secret='diagnostic-local-test-secret-with-at-least-32-bytes';let seen=[];
const fetchImpl=async (url,init)=>{seen.push({url:String(url),init});return Response.json({data:{id,reference:'QD-TEST-000001',status:'completed',evidence_score:50}},{status:201});};
const delivered=await deliverDiagnostic(event,{baseUrl:'https://cockpit.example',secret,fetchImpl});
assert.deepEqual(delivered,{id,reference:'QD-TEST-000001',evidenceScore:50,replayed:false});
assert.equal(new URL(seen[0].url).pathname,'/api/v1/intake/diagnostic');
assert.equal(seen[0].init.headers['X-Qonsul-Signature'].startsWith('v1='),true);
assert.equal('credentials' in seen[0].init,false);

await assert.rejects(
  () => deliverDiagnostic(event,{baseUrl:'https://cockpit.example',secret,fetchImpl:async()=>Response.json({errors:{idempotency_key:['conflict']}},{status:422})}),
  error => error instanceof DiagnosticDeliveryError
    && error.httpStatus === 422
    && error.retryWithNewSubmissionId === true
    && JSON.stringify(error.trace) === JSON.stringify({downstreamStatus:422,errorCode:'idempotency_conflict',rejectedFields:['idempotency_key'],validationCodes:['validation_failed']}),
);

let nextSubmission = 0;
const createSubmissionId = () => `11111111-1111-4111-8111-${String(++nextSubmission).padStart(12,'0')}`;
const firstSubmission = submissionIdForSave('', createSubmissionId);
assert.equal(submissionIdForSave(firstSubmission, createSubmissionId), firstSubmission, 'unchanged retries retain their submission ID');
for (const mutation of ['failed retry', 'evidence', 'cause add/remove', 'hypothesis', 'consent', 'new diagnostic']) {
  const stale = submissionIdForSave(firstSubmission, createSubmissionId);
  assert.equal(invalidateDraftSubmissionId(), '', `${mutation} invalidates a stale draft ID`);
  assert.notEqual(submissionIdForSave(invalidateDraftSubmissionId(), createSubmissionId), stale, `${mutation} receives a fresh logical submission ID`);
}

const successStates=[];
assert.equal(await withSavingState(value=>successStates.push(value),async()=>'saved'),'saved');
assert.deepEqual(successStates,[true,false],'successful submit ends saving state');
const failureStates=[];
await assert.rejects(()=>withSavingState(value=>failureStates.push(value),async()=>{throw new Error('rejected');}));
assert.deepEqual(failureStates,[true,false],'failed submit ends saving state');
const timeoutStates=[];
await assert.rejects(()=>withSavingState(value=>timeoutStates.push(value),async()=>await new Promise((_,reject)=>setTimeout(()=>reject(Object.assign(new Error('Timed out'),{name:'TimeoutError'})),5))),error=>error?.name==='TimeoutError');
assert.deepEqual(timeoutStates,[true,false],'timeout ends saving state');

const consultation=await requestDiagnosticConsultation({source_event_id:id,diagnostic_id:id,contact:{name:'Fiktiv',email:'fiktiv@example.invalid'},consent:{contact_requested:true,privacy_version:'2026-08-31-v1'}},{baseUrl:'https://cockpit.example',secret,fetchImpl:async()=>Response.json({status:'pending_review',diagnostic_id:id},{status:201})});
assert.deepEqual(consultation,{status:'pending_review',diagnosticId:id});
await assert.rejects(()=>deliverDiagnostic(event,{baseUrl:'https://cockpit.example',secret:'short',fetchImpl}),DiagnosticDeliveryError);
const diagnosticUi=await readFile(new URL('../app/quality-diagnostic-lab.tsx',import.meta.url),'utf8');
for(const marker of ['fish-layout','fish-lines','fish-problem','AUSGANGSPUNKT','+ Eigene Ursache','Ihre Perspektive ergänzen','Was übersehen wir vielleicht?'])assert.match(diagnosticUi,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(diagnosticUi,/cause\.source === 'user' \? 'Eigene Beobachtung' : 'Ergänzende Hypothese/);
assert.match(diagnosticUi,/fetch\('\/api\/diagnostics'/);
assert.match(diagnosticUi,/function invalidateDraftSubmission\(\) \{ submissionId\.current = invalidateDraftSubmissionId\(\); \}/);
assert.match(diagnosticUi,/document\.getElementById\('analyse'\)\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/,'Hero launch navigates to the Quality Diagnostic cause map');
assert.match(diagnosticUi,/submissionIdForSave\(submissionId\.current, \(\) => crypto\.randomUUID\(\)\)/,'Browser UUID generation remains bound through a callback wrapper');
assert.doesNotMatch(diagnosticUi,/submissionIdForSave\(submissionId\.current, crypto\.randomUUID\)/,'Browser crypto.randomUUID must not be passed unbound');
for(const marker of ['invalidateDraftSubmission(); step(\'causes\'', 'invalidateDraftSubmission(); const next = suggestRules', 'invalidateDraftSubmission(); setCauses', 'invalidateDraftSubmission(); setAvailableData', 'name="diagnosticConsent" type="checkbox" required onChange={invalidateDraftSubmission}', 'name="demoConfirmed" type="checkbox" required onChange={invalidateDraftSubmission}'])assert.match(diagnosticUi,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(diagnosticUi,/\/api\/v1\/intake\/ishikawa/);
assert.match(diagnosticUi,/lead-content diagnostic-result/);
assert.match(diagnosticUi,/lead-form diagnostic-content-wrap/);
assert.match(diagnosticUi,/lead-content diagnostic-result diagnostic-content-wrap/);
assert.match(diagnosticUi,/await withSavingState\(setBusy/);
assert.match(diagnosticUi,/catch \{ setError\(diagnosticSaveError\); \}/);
assert.match(diagnosticUi,/Ihre Beratungsanfrage wurde übermittelt\./);
assert.match(diagnosticUi,/Die Beratungsanfrage konnte nicht übermittelt werden\. Bitte versuchen Sie es erneut\./);
const diagnosticCss=await readFile(new URL('../app/globals.css',import.meta.url),'utf8');
assert.match(diagnosticCss,/\.diagnostic-content-wrap\{margin:0 30px 25px;padding:25px\}/);
assert.match(diagnosticCss,/\.capture,\.diagnostic-content-wrap\{margin:0 17px 20px;padding:20px 15px\}/);
assert.match(diagnosticCss,/\.diagnostic-content-wrap input:not\(\[type=checkbox\]\),\.diagnostic-content-wrap select\{padding:14px\}/);
assert.match(diagnosticCss,/\.diagnostic-content-wrap \.button\{padding:14px 22px\}/);
console.log('PASS 30 Quality Diagnostic contract, HMAC isolation, immutable submission lifecycle, settled save state, spacing, domain separation, retry and accepted cause-map UI checks.');
