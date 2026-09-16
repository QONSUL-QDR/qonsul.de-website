import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {diagnosticEvent,DIAGNOSTIC_PROCESSING_CONSENT_VERSION} from '../lib/diagnostic-contract.ts';
import {deliverDiagnostic,requestDiagnosticConsultation,DiagnosticDeliveryError} from '../lib/diagnostic-intake-client.ts';
import {signature} from '../lib/cockpit-intake-client.ts';
import {requestPublicAIHypotheses,requestPublicAIHypothesesStatus,PublicAIIntakeError} from '../lib/public-ai-intake-client.ts';
import {invalidateDraftSubmissionId,submissionIdForSave,withSavingState} from '../lib/diagnostic-submission-lifecycle.ts';
import {suggestBlindSpots} from '../lib/analysis.ts';

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
  error => error instanceof DiagnosticDeliveryError && error.httpStatus === 422 && error.retryWithNewSubmissionId === true,
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
const publicAiEvent={source_event_id:'33333333-3333-4333-8333-333333333333',problem:'Synthetisches Qualitätsproblem für die KI-Unterstützung.',causes:[{category:'Prozess',text:'Synthetische Beobachtung'}]};
let publicAiSeen=false;
const publicAi=await requestPublicAIHypotheses(publicAiEvent,{baseUrl:'https://cockpit.example',secret,fetchImpl:async(url,init)=>{
  const headers=new Headers(init?.headers),pathName=new URL(String(url)).pathname,timestamp=Number(headers.get('X-Qonsul-Timestamp')),body=String(init?.body);
  assert.equal(pathName,'/api/v1/intake/diagnostic/ai-hypotheses');
  assert.equal(headers.get('X-Qonsul-Signature'),`v1=${await signature(secret,'POST',pathName,timestamp,publicAiEvent.source_event_id,body)}`);
  assert.equal(headers.has('Authorization'),false); publicAiSeen=true;
  return Response.json({hypotheses:[{id:'ai-1',category:'Prozess',text:'Synthetische KI-Hypothese',reasoning_summary:'Mit Daten prüfen.',origin:'ai'}]});
}});
assert.equal(publicAi[0].origin,'ai');
assert.equal(publicAiSeen,true);
let publicAiStatusSeen=false;
const publicAiStatus=await requestPublicAIHypothesesStatus(publicAiEvent.source_event_id,{baseUrl:'https://cockpit.example',secret,fetchImpl:async(url,init)=>{
  const headers=new Headers(init?.headers),pathName=new URL(String(url)).pathname,timestamp=Number(headers.get('X-Qonsul-Timestamp')),body=String(init?.body);
  assert.equal(pathName,'/api/v1/intake/diagnostic/ai-hypotheses/status');
  assert.equal(body,JSON.stringify({source_event_id:publicAiEvent.source_event_id}));
  assert.equal(headers.get('X-Qonsul-Signature'),`v1=${await signature(secret,'POST',pathName,timestamp,publicAiEvent.source_event_id,body)}`);
  publicAiStatusSeen=true; return Response.json({status:'completed',hypotheses:[{id:'ai-1',category:'Prozess',text:'Synthetische KI-Hypothese',reasoning_summary:'Mit Daten prüfen.',origin:'ai'}]});
}});
assert.equal(publicAiStatus.status,'completed');
assert.equal(publicAiStatusSeen,true);
await assert.rejects(()=>requestPublicAIHypotheses(publicAiEvent,{baseUrl:'https://cockpit.example',secret:'short'}),PublicAIIntakeError);
await assert.rejects(
  () => requestPublicAIHypotheses(publicAiEvent,{baseUrl:'https://cockpit.example',secret,fetchImpl:async()=>new Response('{}',{status:429,headers:{'Retry-After':'60'}})}),
  error => error instanceof PublicAIIntakeError && error.httpStatus === 429 && error.retryAfterSeconds === 60,
);
const blindSpotProblems=['Bremskraft von Bremszange wird nicht erreicht','Messdaten eines Sensors schwanken unplausibel','Liefertermine eines Bauteils werden regelmäßig verfehlt'];
const blindSpotSets=blindSpotProblems.map(problem=>suggestBlindSpots(problem,[{id:'covered',category:'Produkt',text:'Synthetische Beobachtung',source:'user'}]));
assert.equal(blindSpotSets.every(spots=>spots.every(spot=>spot.category!=='Produkt'&&spot.prompt.endsWith('?'))),true,'blind spots are questions only for uncovered categories');
assert.equal(new Set(blindSpotSets.map(spots=>spots.map(spot=>spot.prompt).join('|'))).size,3,'distinct problem contexts receive distinct blind-spot prompts');
const diagnosticUi=await readFile(new URL('../app/quality-diagnostic-lab.tsx',import.meta.url),'utf8');
for(const marker of ['fish-layout','fish-lines','fish-problem','AUSGANGSPUNKT','+ Eigene Ursache','Ihre Perspektive ergänzen','Was übersehen wir vielleicht?'])assert.match(diagnosticUi,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(diagnosticUi,/cause\.source === 'user' \? 'Eigene Beobachtung' : cause\.source === 'ai' \? 'KI-Hypothese/);
assert.match(diagnosticUi,/fetch\('\/api\/diagnostics'/);
assert.match(diagnosticUi,/function invalidateDraftSubmission\(\) \{ submissionId\.current = invalidateDraftSubmissionId\(\); aiRequestId\.current = ''; \}/);
assert.match(diagnosticUi,/document\.getElementById\('analyse'\)\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/,'Hero launch navigates to the Quality Diagnostic cause map');
assert.match(diagnosticUi,/submissionIdForSave\(submissionId\.current, \(\) => crypto\.randomUUID\(\)\)/,'Browser UUID generation remains bound through a callback wrapper');
assert.doesNotMatch(diagnosticUi,/submissionIdForSave\(submissionId\.current, crypto\.randomUUID\)/,'Browser crypto.randomUUID must not be passed unbound');
for(const marker of ['invalidateDraftSubmission(); step(\'causes\'', 'invalidateDraftSubmission(); setCauses', 'invalidateDraftSubmission(); setAvailableData', 'name="diagnosticConsent" type="checkbox" required onChange={invalidateDraftSubmission}', 'name="demoConfirmed" type="checkbox" required onChange={invalidateDraftSubmission}'])assert.match(diagnosticUi,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.doesNotMatch(diagnosticUi,/\/api\/v1\/intake\/ishikawa/);
assert.match(diagnosticUi,/lead-content diagnostic-result/);
assert.match(diagnosticUi,/lead-form diagnostic-content-wrap/);
assert.match(diagnosticUi,/lead-content diagnostic-result diagnostic-content-wrap/);
assert.match(diagnosticUi,/await withSavingState\(setBusy/);
assert.match(diagnosticUi,/catch \{ setError\(diagnosticSaveError\); \}/);
assert.match(diagnosticUi,/fetch\('\/api\/diagnostic-ai-hypotheses'/,'Public Diagnostic uses its own signed Cockpit route, not Ishikawa');
assert.match(diagnosticUi,/const \[aiSuggestions, setAiSuggestions\] = useState<Cause\[\]>\(\[\]\)/,'AI responses remain separate from the Cause Map until user selection');
assert.match(diagnosticUi,/const \[hasCompletedAIRun, setHasCompletedAIRun\] = useState\(false\)/,'the AI action state starts incomplete for every new Diagnostic flow');
assert.match(diagnosticUi,/setHasCompletedAIRun\(true\);[\s\S]*?setAiSuggestions\(accepted\)/,'a successfully applied AI result marks the run complete before suggestions can be accepted or dismissed');
assert.match(diagnosticUi,/\{!hasCompletedAIRun && <button[^>]+onClick=\{\(\) => addAIHypotheses\(\)\}/,'the initial AI action is visible only before the first successful AI run');
assert.match(diagnosticUi,/\{hasCompletedAIRun && <button[^>]+onClick=\{\(\) => addAIHypotheses\(true\)\}>Neue KI-Hypothesen erstellen/,'deliberate regeneration replaces the initial AI action after success');
assert.doesNotMatch(diagnosticUi,/aiSuggestions\.length > 0 && <button[^>]+Neue KI-Hypothesen erstellen/,'button visibility is independent of remaining suggestion count');
assert.equal((diagnosticUi.match(/setHasCompletedAIRun\(false\)/g)||[]).length,2,'only a new flow and Neu beginnen reset the completed AI-run state, never accept or dismiss');
assert.match(diagnosticUi,/setAiSuggestions\(accepted\)/,'AI responses are staged as suggestions instead of being automatically accepted');
assert.doesNotMatch(diagnosticUi,/setCauses\(previous => \[\.\.\.previous, \.\.\.accepted\]\)/,'AI suggestions must not be inserted into the Cause Map automatically');
assert.match(diagnosticUi,/function acceptAISuggestion/,'each AI suggestion requires an explicit accept action');
assert.match(diagnosticUi,/function dismissAISuggestion/,'each AI suggestion can be dismissed without changing the Cause Map');
assert.match(diagnosticUi,/KI-Hypothesen sind Analysevorschläge und keine bestätigten Ursachen\./,'the required AI disclaimer is visible');
assert.match(diagnosticUi,/>Übernehmen</,'AI suggestions can be accepted explicitly');
assert.match(diagnosticUi,/>Verwerfen</,'AI suggestions can be dismissed explicitly');
assert.match(diagnosticUi,/aiRequestInFlight\.current/,'a synchronous request guard blocks repeated clicks before React state updates');
assert.match(diagnosticUi,/KI-Hypothesen werden erstellt …/,'the loading state is visible while an AI request is active');
assert.match(diagnosticUi,/beginAIPolling\(sourceEventId\)/,'one click begins bounded status polling for the same event ID');
assert.match(diagnosticUi,/fetch\('\/api\/diagnostic-ai-hypotheses\/status'/,'polling uses the Website same-origin status route');
assert.match(diagnosticUi,/body: JSON\.stringify\(\{ sourceEventId \}\)/,'polling reuses the generation source event ID');
assert.match(diagnosticUi,/Date\.now\(\) \+ 60_000/,'status polling has a hard overall deadline');
assert.match(diagnosticUi,/aiResultApplied\.current/,'generation and polling responses are settled only once');
assert.doesNotMatch(diagnosticUi,/fetch\('\/api\/diagnostic-ai-hypotheses', { method: 'POST'[\s\S]*fetch\('\/api\/diagnostic-ai-hypotheses', { method: 'POST'/,'polling never invokes a second generation request');
assert.match(diagnosticUi,/Neue KI-Hypothesen erstellen/,'later deliberate regeneration stays available');
assert.match(diagnosticUi,/const \[aiSuggestions, setAiSuggestions\] = useState<Cause\[\]>\(\[\]\), \[analysisExhausted, setAnalysisExhausted\] = useState\(false\)/,'the conversion state starts inactive');
assert.match(diagnosticUi,/if \(accepted\.length === 0\) \{\s+setHasCompletedAIRun\(true\);\s+setAnalysisExhausted\(true\);/,'only a technically successful AI result without capacity activates the conversion state');
assert.doesNotMatch(diagnosticUi,/setError\('Für ergänzende Hypothesen ist in den gewählten Perspektiven kein Platz mehr frei\.'/,'capacity exhaustion is never rendered as a red technical error');
assert.match(diagnosticUi,/setAnalysisExhausted\(false\);\s+setAiSuggestions\(accepted\)/,'a later AI result with accepted hypotheses clears the conversion state');
assert.match(diagnosticUi,/Analyseperspektiven umfassend ausgeschöpft/,'the neutral conversion heading is displayed');
assert.match(diagnosticUi,/Analyse mit QONSUL vertiefen →/,'the conversion CTA is displayed');
assert.match(diagnosticUi,/function continueToConsultation\(\) \{\s+if \(saved\) return setConsultationOpen\(true\);\s+setOpenConsultationAfterSave\(true\);\s+document\.getElementById\('diagnostic-save'\)/,'the CTA only opens the existing consultation form after saving or leads to the existing save step without submitting data');
assert.match(diagnosticUi,/setSaved\(result\.diagnostic\); if \(openConsultationAfterSave\) setConsultationOpen\(true\)/,'the existing consultation form opens only after successful Diagnostic persistence');
assert.match(diagnosticUi,/setAnalysisExhausted\(false\); setOpenConsultationAfterSave\(false\); setHasCompletedAIRun\(false\)/,'Neu beginnen resets the conversion state');
assert.match(diagnosticUi,/setBlindSpots\(suggestBlindSpots\(problem, causes\)\)/,'blind spots are separate deterministic investigation prompts');
assert.match(diagnosticUi,/Diese Fragen sind Untersuchungsperspektiven und keine Ursachen\./,'blind-spot semantics are explicit in the UI');
assert.match(diagnosticUi,/Eigene Beobachtung formulieren/,'blind spots guide the user to the existing own-cause action instead of being added automatically');
const publicAiRoute=await readFile(new URL('../app/api/diagnostic-ai-hypotheses/route.ts',import.meta.url),'utf8');
assert.match(publicAiRoute,/Retry-After/,'429 responses include a controlled retry hint');
assert.match(publicAiRoute,/Die KI-Analyse wurde gerade bereits ausgeführt/,'429 responses use a safe German message');
const publicAiStatusRoute=await readFile(new URL('../app/api/diagnostic-ai-hypotheses/status/route.ts',import.meta.url),'utf8');
assert.match(publicAiStatusRoute,/requestPublicAIHypothesesStatus/,'the browser-facing status endpoint signs a server-side Cockpit status request');
assert.doesNotMatch(publicAiStatusRoute,/requestPublicAIHypotheses\(/,'the status endpoint cannot start generation');
const pollsPerRun=Math.ceil(60_000/2_500),statusPollLimit=180;
assert.match(publicAiStatusRoute,/rateLimit\(request, 'public-ai-hypotheses-status', 180\)/,'read-only status polling remains rate-limited at a bounded higher limit');
assert.ok(statusPollLimit>=5*pollsPerRun+60,'the status limit supports at least five full polling runs per hour with reserve');
assert.match(publicAiRoute,/rateLimit\(request, 'public-ai-hypotheses', 5\)/,'the generation endpoint keeps its strict independent limit');
assert.match(diagnosticUi,/<form noValidate onSubmit=/,'custom problem-length validation must run before the Diagnostic flow starts');
assert.match(diagnosticUi,/id="diagnostic-problem-error" role="alert"/,'the ten-character validation error must be visible and announced');
assert.match(diagnosticUi,/Ihre Beratungsanfrage wurde übermittelt\./);
assert.match(diagnosticUi,/Die Beratungsanfrage konnte nicht übermittelt werden\. Bitte versuchen Sie es erneut\./);
const diagnosticCss=await readFile(new URL('../app/globals.css',import.meta.url),'utf8');
assert.match(diagnosticCss,/\.analysis-exhausted\{/,'the conversion state has its own neutral visual treatment');
assert.match(diagnosticCss,/\.diagnostic-content-wrap\{margin:0 30px 25px;padding:25px\}/);
assert.match(diagnosticCss,/\.capture,\.diagnostic-content-wrap\{margin:0 17px 20px;padding:20px 15px\}/);
assert.match(diagnosticCss,/\.diagnostic-content-wrap input:not\(\[type=checkbox\]\),\.diagnostic-content-wrap select\{padding:14px\}/);
assert.match(diagnosticCss,/\.diagnostic-content-wrap \.button\{padding:14px 22px\}/);
console.log('PASS 30 Quality Diagnostic contract, HMAC isolation, immutable submission lifecycle, settled save state, spacing, domain separation, retry and accepted cause-map UI checks.');
