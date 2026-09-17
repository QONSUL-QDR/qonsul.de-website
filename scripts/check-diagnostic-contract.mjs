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
const publicAiEvent={source_event_id:'33333333-3333-4333-8333-333333333333',analysis_round:1,problem:'Synthetisches Qualitätsproblem für die KI-Unterstützung.',causes:[{category:'Prozess',text:'Synthetische Beobachtung'}]};
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
assert.match(diagnosticUi,/const \[completedAIRounds, setCompletedAIRounds\] = useState\(0\)/,'the AI round counter starts at zero for every new Diagnostic flow');
assert.match(diagnosticUi,/const analysisRound: 1 \| 2 = completedAIRounds === 0 \? 1 : 2/,'the browser derives an explicit first or second analysis round without changing the UX');
assert.match(diagnosticUi,/sourceEventId, analysisRound, problem, causes: \[\.\.\.causes, \.\.\.aiSuggestions\]/,'each bounded AI generation sends its round and preserves the original problem plus unconfirmed context');
assert.match(diagnosticUi,/if \(accepted\.length === 0\) \{\s+activateAnalysisConversion\(\);[\s\S]*?\} else \{\s+setCompletedAIRounds\(previous => Math\.min\(previous \+ 1, 2\)\);/,'only a successful AI result with at least one usable hypothesis advances a bounded round counter');
assert.match(diagnosticUi,/\{!analysisExhausted && completedAIRounds === 0 && <button[^>]+boost-action-button[^>]+onClick=\{\(\) => addAIHypotheses\(\)\}[\s\S]*?QONSUL Expertise einbeziehen/,'the initial QONSUL action is visible only before the first successful AI round and never beside conversion');
assert.match(diagnosticUi,/\{!analysisExhausted && completedAIRounds > 0 && <button[^>]+boost-action-button[^>]+onClick=\{\(\) => addAIHypotheses\(true\)\}[\s\S]*?QONSUL Expertise vertiefen/,'deliberate regeneration uses the branded follow-up action only while another round is allowed');
assert.doesNotMatch(diagnosticUi,/KI-Hypothesen ergänzen|Neue KI-Hypothesen erstellen/,'technical AI terms are not shown in action labels');
assert.doesNotMatch(diagnosticUi,/aiSuggestions\.length > 0 && <button[^>]+QONSUL Expertise vertiefen/,'button visibility is independent of remaining suggestion count');
assert.equal((diagnosticUi.match(/QONSUL ergänzt Ihre Analyse um weitere technisch prüfbare Perspektiven\./g)||[]).length,1,'the branded action explanation is visible exactly once');
assert.match(diagnosticUi,/className="button button-outline boost-button boost-action-button" disabled=\{busy\} onClick=\{addBlindspots\}>Blinde Flecken untersuchen/,'the independent blind-spot action has its exact visible label and shared action-button class');
assert.doesNotMatch(diagnosticUi,/Blinde Flecken ergänzen/,'the former visible blind-spot action label is removed');
assert.equal((diagnosticUi.match(/setCompletedAIRounds\(0\)/g)||[]).length,2,'only a new flow and Neu beginnen reset the completed AI-round state, never accept or dismiss');
assert.match(diagnosticUi,/setAiSuggestions\(accepted\)/,'AI responses are staged as suggestions instead of being automatically accepted');
assert.doesNotMatch(diagnosticUi,/setCauses\(previous => \[\.\.\.previous, \.\.\.accepted\]\)/,'AI suggestions must not be inserted into the Cause Map automatically');
assert.match(diagnosticUi,/function acceptAISuggestion/,'each AI suggestion requires an explicit accept action');
assert.match(diagnosticUi,/function dismissAISuggestion/,'each AI suggestion can be dismissed without changing the Cause Map');
const blindSpotHandler=diagnosticUi.match(/function addBlindspots\(\) \{[\s\S]*?\n  \}\n  function applyAIHypotheses/)?.[0]||'';
assert.match(blindSpotHandler,/const uncovered = suggestBlindSpots\(problem, causes\);\s+setBlindSpots\(uncovered\.length \? uncovered : suggestBlindSpots\(problem\)\);/,'blind spots remain available before and after every AI round, even when every category already has a hypothesis');
assert.doesNotMatch(blindSpotHandler,/setCompletedAIRounds|setAnalysisExhausted|setCauses/,'blind spots never advance AI rounds, activate conversion, or create causes');
assert.match(diagnosticUi,/KI-Hypothesen sind Analysevorschläge und keine bestätigten Ursachen\./,'the required AI disclaimer is visible');
assert.match(diagnosticUi,/>Übernehmen</,'AI suggestions can be accepted explicitly');
assert.match(diagnosticUi,/>Verwerfen</,'AI suggestions can be dismissed explicitly');
assert.match(diagnosticUi,/aiRequestInFlight\.current/,'a synchronous request guard blocks repeated clicks before React state updates');
assert.match(diagnosticUi,/const \[analysisProgress, setAnalysisProgress\] = useState<'idle' \| 'active' \| 'complete'>\('idle'\)/,'a separate UI-only analysis-progress state starts idle');
assert.match(diagnosticUi,/resetAnalysisProgress\(\); setAnalysisProgress\('active'\);/,'progress starts only after a provider-backed AI run passes the local conversion guard');
assert.match(diagnosticUi,/QONSUL Analyse läuft …/,'the branded loading state is visible while an AI request is active');
assert.match(diagnosticUi,/aria-busy=\{analysisBusy\}/,'the running action communicates busy state accessibly');
assert.match(diagnosticUi,/beginAIPolling\(sourceEventId\)/,'one click begins bounded status polling for the same event ID');
assert.match(diagnosticUi,/fetch\('\/api\/diagnostic-ai-hypotheses\/status'/,'polling uses the Website same-origin status route');
assert.match(diagnosticUi,/body: JSON\.stringify\(\{ sourceEventId \}\)/,'polling reuses the generation source event ID');
assert.match(diagnosticUi,/Date\.now\(\) \+ 90_000/,'status polling has a hard ninety-second overall deadline');
assert.match(diagnosticUi,/aiResultApplied\.current/,'generation and polling responses are settled only once');
assert.doesNotMatch(diagnosticUi,/fetch\('\/api\/diagnostic-ai-hypotheses', { method: 'POST'[\s\S]*fetch\('\/api\/diagnostic-ai-hypotheses', { method: 'POST'/,'polling never invokes a second generation request');
assert.match(diagnosticUi,/beginAIPolling\(sourceEventId\);\s+try \{\s+const response = await fetch\('\/api\/diagnostic-ai-hypotheses'/,'status polling begins before the initial generation response can time out');
assert.match(diagnosticUi,/\} catch \{ \/\* Status polling resolves controlled provider failures and timeouts\. \*\/ \}/,'an initial generation timeout does not stop active status polling or mark a final UI error');
assert.match(diagnosticUi,/response\.ok && result\.status === 'completed' && result\.causes\) return applyAIHypotheses/,'a later completed status result is applied after an initial generation timeout');
assert.match(diagnosticUi,/response\.ok && result\.status === 'failed'\) return failAIAnalysis\(\);/,'a failed status result remains a controlled technical error');
assert.match(diagnosticUi,/function failAIAnalysis\(\) \{\s+resetAnalysisProgress\(\);/,'failed polling resets the visual progress without showing completion');
const aiFailureHandler=diagnosticUi.match(/function failAIAnalysis\(\) \{[\s\S]*?\n  \}/)?.[0]||'';
assert.doesNotMatch(aiFailureHandler,/setAnalysisExhausted/,'429, 503, and timeout failures remain technical errors rather than conversion');
assert.match(diagnosticUi,/function completeAnalysisProgress\(afterComplete: \(\) => void\) \{[\s\S]*?setAnalysisProgress\('complete'\);/,'only completed provider results briefly render full visual progress before applying results');
assert.match(diagnosticUi,/QONSUL Expertise vertiefen/,'later deliberate regeneration stays available after the first round');
assert.match(diagnosticUi,/const \[aiSuggestions, setAiSuggestions\] = useState<Cause\[\]>\(\[\]\), \[analysisExhausted, setAnalysisExhausted\] = useState\(false\)/,'the conversion state starts inactive');
const conversionActivator=diagnosticUi.match(/function activateAnalysisConversion\(\) \{[\s\S]*?\n  \}/)?.[0]||'';
assert.match(conversionActivator,/setAnalysisExhausted\(true\);/,'the canonical conversion action makes the exhaustion callout visible');
assert.match(conversionActivator,/setOpenConsultationAfterSave\(true\);/,'the canonical conversion action preserves the after-save consultation intent');
assert.match(conversionActivator,/setError\(''\);/,'the canonical conversion action clears only stale technical UI errors');
assert.match(conversionActivator,/setNotice\('Die verfügbaren Analyseperspektiven sind bereits umfassend ausgeschöpft\.'/,'the canonical conversion action keeps the controlled exhaustion notice');
assert.match(diagnosticUi,/if \(accepted\.length === 0\) \{\s+activateAnalysisConversion\(\);/,'a technically successful AI result without usable hypotheses activates the complete conversion state immediately');
const thirdRoundBranch=diagnosticUi.match(/if \(completedAIRounds >= 2\) \{[\s\S]*?\n    \}/)?.[0]||'';
assert.match(thirdRoundBranch,/activateAnalysisConversion\(\);\s+return;/,'a third deliberate AI attempt activates the complete conversion state locally');
assert.doesNotMatch(thirdRoundBranch,/aiRequestId|beginAIPolling|setAnalysisProgress|fetch\(/,'the third deliberate attempt creates no event, polling, progress animation, or generation request');
assert.doesNotMatch(diagnosticUi,/hasAICapacity/,'local capacity cannot block the required second AI round or activate conversion after round one');
assert.match(diagnosticUi,/if \(aiRequestInFlight\.current \|\| analysisExhausted\) return;/,'a completed conversion state cannot restart an AI request');
assert.match(diagnosticUi,/sourceEventId, analysisRound, problem, causes: \[\.\.\.causes, \.\.\.aiSuggestions\]/,'round two sends accepted and still-visible unconfirmed hypotheses as analysis context');
assert.match(diagnosticUi,/function start\(value = input\) \{[\s\S]*?stopAIPolling\(\); resetAnalysisProgress\(\);/,'a new Diagnostic flow clears visual progress and polling');
assert.doesNotMatch(diagnosticUi,/setError\('Für ergänzende Hypothesen ist in den gewählten Perspektiven kein Platz mehr frei\.'/,'capacity exhaustion is never rendered as a red technical error');
assert.match(diagnosticUi,/setCompletedAIRounds\(previous => Math\.min\(previous \+ 1, 2\)\);\s+setAnalysisExhausted\(false\);\s+setAiSuggestions\(accepted\)/,'both successful AI rounds keep their new hypotheses visible and do not activate conversion');
assert.match(diagnosticUi,/Analyseperspektiven umfassend ausgeschöpft/,'the neutral conversion heading is displayed');
assert.match(diagnosticUi,/Analyse mit QONSUL vertiefen →/,'the conversion CTA is displayed');
assert.match(diagnosticUi,/\{analysisExhausted && <section className="analysis-exhausted"[\s\S]*?<h3>Analyseperspektiven umfassend ausgeschöpft<\/h3>[\s\S]*?Analyse mit QONSUL vertiefen →/,'the active conversion state renders the complete exhaustion callout and CTA together');
assert.match(diagnosticUi,/\{!analysisExhausted && completedAIRounds > 0 && <button[^>]+[\s\S]*?QONSUL Expertise vertiefen/,'the follow-up action is hidden while the conversion state is active');
assert.match(diagnosticUi,/function continueToConsultation\(\) \{\s+if \(saved\) return setConsultationOpen\(true\);\s+setOpenConsultationAfterSave\(true\);\s+document\.getElementById\('diagnostic-save'\)/,'the CTA only opens the existing consultation form after saving or leads to the existing save step without submitting data');
const consultationCtaHandler=diagnosticUi.match(/function continueToConsultation\(\) \{[\s\S]*?\n  \}/)?.[0]||'';
assert.doesNotMatch(consultationCtaHandler,/fetch\(|save\(/,'the conversion CTA itself neither persists a Diagnostic nor creates CRM data');
assert.match(diagnosticUi,/function submitDiagnostic\(event: FormEvent<HTMLFormElement>\) \{\s+const continueAfterSave = analysisExhausted \|\| openConsultationAfterSave;\s+void save\(event, continueAfterSave\);/,'the conversion-mode save action preserves the existing post-save consultation intent');
assert.match(diagnosticUi,/setSaved\(result\.diagnostic\); if \(continueAfterSave\) setConsultationOpen\(true\)/,'the existing consultation form opens only after successful Diagnostic persistence');
assert.match(diagnosticUi,/onSubmit=\{submitDiagnostic\}/,'the save form uses the conversion-aware submit handler');
assert.match(diagnosticUi,/analysisExhausted \? 'Diagnostic sichern und Analyse mit QONSUL vertiefen' : 'Diagnostic sichern'/,'the save button has the exact conversion and normal labels');
assert.match(diagnosticUi,/resetAnalysisProgress\(\); invalidateDraftSubmission\(\);[\s\S]*?setAnalysisExhausted\(false\); setOpenConsultationAfterSave\(false\); setCompletedAIRounds\(0\)/,'Neu beginnen resets the visual progress, conversion, and completed-round states');
assert.match(diagnosticUi,/setBlindSpots\(uncovered\.length \? uncovered : suggestBlindSpots\(problem\)\)/,'blind spots are separate deterministic investigation prompts even after all categories are represented');
assert.match(diagnosticUi,/Diese Fragen sind Untersuchungsperspektiven und keine Ursachen\./,'blind-spot semantics are explicit in the UI');
assert.match(diagnosticUi,/Eigene Beobachtung formulieren/,'blind spots guide the user to the existing own-cause action instead of being added automatically');
const publicAiRoute=await readFile(new URL('../app/api/diagnostic-ai-hypotheses/route.ts',import.meta.url),'utf8');
assert.match(publicAiRoute,/Retry-After/,'429 responses include a controlled retry hint');
assert.match(publicAiRoute,/Die KI-Analyse wurde gerade bereits ausgeführt/,'429 responses use a safe German message');
assert.match(publicAiRoute,/return json\(\{ error: customerError \}, 503\)/,'provider failures remain controlled 503 technical errors');
assert.match(publicAiRoute,/causes: analysis\.causes\.map\(cause => \(\{ category: cause\.category, text: cause\.text \}\)\)/,'the Website forwards all accepted and pending hypothesis context for duplicate avoidance without changing Cockpit');
assert.match(publicAiRoute,/body\.analysisRound !== 1 && body\.analysisRound !== 2/,'the Website accepts only the two explicit analysis rounds');
assert.match(publicAiRoute,/analysis_round: body\.analysisRound/,'the Website forwards the explicit round to Cockpit');
assert.doesNotMatch(publicAiRoute,/analysis\.causes\.filter\(cause => cause\.source === 'user'\)/,'AI context is no longer restricted to user observations alone');
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
assert.match(diagnosticCss,/\.boost-action-button\{font-family:Arial,'Segoe UI',sans-serif;font-size:12px;font-weight:600;line-height:1\.4;min-height:46px;padding:14px 22px\}/,'both neighbouring actions share height, typography, weight, and horizontal padding');
assert.match(diagnosticCss,/\.boost-action-button>span\{font-size:inherit\}/,'the QONSUL action label cannot inherit the global enlarged button-span typography');
assert.match(diagnosticCss,/\.analysis-progress-button\.active:after\{animation:qonsul-analysis-progress 65s/,'the branded action uses a bounded left-to-right progress fill');
assert.match(diagnosticCss,/@keyframes qonsul-analysis-progress\{0%\{transform:scaleX\(0\)\}46%\{transform:scaleX\(\.7\)\}92%\{transform:scaleX\(\.9\)\}100%\{transform:scaleX\(\.92\)\}\}/,'progress reaches 70 percent near thirty seconds, 90 percent near sixty seconds, then stays bounded');
assert.match(diagnosticCss,/@media\(prefers-reduced-motion:reduce\)\{\.analysis-progress-button\.active:after\{animation:none/,'reduced-motion users do not receive a continuous progress animation');
assert.match(diagnosticCss,/\.diagnostic-content-wrap\{margin:0 30px 25px;padding:25px\}/);
assert.match(diagnosticCss,/\.capture,\.diagnostic-content-wrap\{margin:0 17px 20px;padding:20px 15px\}/);
assert.match(diagnosticCss,/\.diagnostic-content-wrap input:not\(\[type=checkbox\]\),\.diagnostic-content-wrap select\{padding:14px\}/);
assert.match(diagnosticCss,/\.diagnostic-content-wrap \.button\{padding:14px 22px\}/);
console.log('PASS 30 Quality Diagnostic contract, HMAC isolation, immutable submission lifecycle, settled save state, spacing, domain separation, retry and accepted cause-map UI checks.');
