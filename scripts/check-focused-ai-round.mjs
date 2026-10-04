import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { focusedRoundRequest, parseFocusPayload, publicHypothesesAsCauses } from '../lib/public-ai-rounds.ts';
import { parseAnalysis } from '../lib/analysis.ts';
import { startAIHypothesesRun } from '../lib/ai-polling.ts';

const uuid = number => `${String(number).padStart(8, '0')}-1111-4111-8111-111111111111`;
const own = [
  { id: uuid(1), category: 'Messung', text: 'Die Prüflehre könnte bei Wärme driften.', source: 'user' },
  { id: uuid(2), category: 'Prozess', text: 'Die Anfahrfolge könnte zeitweise abweichen.', source: 'user' },
];
const roundOne = Array.from({ length: 12 }, (_, index) => ({
  id: uuid(index + 10), category: ['Produkt', 'Prozess', 'Material', 'Mensch', 'Messung', 'Umgebung'][Math.floor(index / 2)],
  text: `Breite Ausgangshypothese Nummer ${index + 1}.`, source: 'ai',
  reasoning: `Mechanismus ${index + 1}. Prüfen: Referenzvergleich ${index + 1}.`,
  check: `Mechanismus ${index + 1}. Prüfen: Referenzvergleich ${index + 1}.`,
  recommendedCheck: `Referenzvergleich ${index + 1}.`,
}));

const empty = focusedRoundRequest(own, roundOne, []);
assert.equal(empty.focus_causes.length, 0, 'a second round has no implicit focus');
assert.throws(() => parseFocusPayload(empty, empty.causes), /Invalid focus payload/);

const selected = focusedRoundRequest([...own, roundOne[0]], roundOne, [own[0].id, roundOne[0].id]);
assert.deepEqual(selected.causes, own, 'all own causes are context; accepted AI suggestions are not confirmed causes');
assert.equal(parseAnalysis({ problem: 'Synthetisches Qualitätsproblem beim Anfahren.', causes: selected.causes, availableData: [] }).causes.length, 2);
assert.deepEqual(selected.focus_causes.map(item => item.origin_ref), [own[0].id, roundOne[0].id]);
assert.equal(selected.focus_causes[1].reasoning_summary, roundOne[0].reasoning);
assert.equal(selected.focus_causes[1].recommended_check, roundOne[0].recommendedCheck);
assert.equal(selected.prior_hypotheses.length, 12, 'all first-round suggestions prevent repetition');
assert.deepEqual(parseFocusPayload(selected, selected.causes), { focus_causes: selected.focus_causes, prior_hypotheses: selected.prior_hypotheses });
assert.throws(() => parseFocusPayload({ ...selected, focus_causes: [{ ...selected.focus_causes[1], origin_ref: uuid(99) }] }, selected.causes), /Unknown AI cause/);
assert.throws(() => parseFocusPayload({ ...selected, prior_hypotheses: selected.prior_hypotheses.slice(1) }, selected.causes), /Invalid focus payload/);

const hypothesis = (ref, id) => ({ id: uuid(id), origin_ref: ref, category: 'Messung', text: `Zusätzliche Hypothese ${id}.`,
  mechanism: 'Ein konkreter Kontaktmechanismus verschiebt die Bauteillage.', recommended_check: 'Referenzteile unter identischen Bedingungen vergleichen.', origin: 'ai' });
const focused = publicHypothesesAsCauses([hypothesis(own[0].id, 30), hypothesis(roundOne[0].id, 31)], 2);
assert.deepEqual(focused.map(item => item.originRef), [own[0].id, roundOne[0].id]);
assert.match(focused[0].mechanism, /Kontaktmechanismus/);
assert.throws(() => publicHypothesesAsCauses([30, 31, 32].map(id => hypothesis(own[0].id, id)), 2), /per cause/);
assert.throws(() => publicHypothesesAsCauses(Array.from({ length: 9 }, (_, index) => hypothesis(uuid(index + 1), index + 30)), 2), /Too many/);

let starts = 0;
const seen = [];
const finished = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const firstDone = finished();
let statuses = [{ status: 'processing' }, { status: 'processing' }, { status: 'completed', causes: roundOne }];
startAIHypothesesRun({ sourceEventId: uuid(100), analysisRound: 1,
  submit: async () => { starts++; return { status: 'processing' }; },
  poll: async () => statuses.shift(),
  onComplete: result => { seen.push(result.causes); firstDone.resolve(); }, onFail: firstDone.resolve,
  initialPollDelayMs: 0, pollIntervalMs: 0, deadlineMs: 1_000 });
await firstDone.promise;
assert.equal(starts, 1);
assert.deepEqual(seen, [roundOne], 'the first completed result appears without a second click');

const secondDone = finished();
statuses = [{ status: 'processing' }, { status: 'completed', causes: focused }];
startAIHypothesesRun({ sourceEventId: uuid(101), analysisRound: 2,
  submit: async (id, round) => { assert.equal(id, uuid(101)); assert.equal(round, 2); starts++; return { status: 'processing' }; },
  poll: async id => { assert.equal(id, uuid(101)); return statuses.shift(); },
  onComplete: result => { seen.push(result.causes); secondDone.resolve(); }, onFail: secondDone.resolve,
  initialPollDelayMs: 0, pollIntervalMs: 0, deadlineMs: 1_000 });
await secondDone.promise;
assert.equal(starts, 2, 'one distinct source_event_id and start request per round');
assert.deepEqual(seen[1], focused, 'the second click cannot replay round one');

const ui = await readFile(new URL('../app/quality-diagnostic-lab.tsx', import.meta.url), 'utf8');
assert.match(ui, /if \(analysisRound === 2 && !focused\?\.focus_causes\.length\) return setNotice/);
assert.match(ui, /activeAIRunId\.current !== runId/);
assert.match(ui, /setCompletedAIRounds\(2\);\s+activateAnalysisConversion\(\)/);
assert.match(ui, /disabled=\{busy \|\| analysisExhausted\}/);
assert.match(ui, /analysisExhausted \? 'Analyseperspektiven umfassend ausgeschöpft'/);
assert.match(ui, /setRoundOneHypotheses\(\[\]\); setRoundTwoSuggestions\(\[\]\); setSelectedFocusIds\(\[\]\)/);
console.log('PASS focused selection, round isolation, provenance, limits, first-click completion and terminal CTA');
