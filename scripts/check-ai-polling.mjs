import assert from 'node:assert/strict';
import { startAIHypothesesRun } from '../lib/ai-polling.ts';

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const firstCauses = [{ id: 'first-a' }, { id: 'first-b' }];
const secondCauses = [{ id: 'second-a' }];
const outcome = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const withLimit = promise => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('AI polling test did not settle')), 2_000)),
]);
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

const ui = { hypotheses: [], completedRounds: 0, error: '' };
const firstDone = outcome();
const started = [];
const polled = [];
const statuses = [
  { status: 'processing' },
  { status: 'processing' },
  { status: 'completed', causes: firstCauses },
];
startAIHypothesesRun({
  sourceEventId: firstId, analysisRound: 1,
  submit: async (id, round) => {
    started.push({ id, round });
    const response = Response.json({ status: 'processing' }, { status: 202 });
    assert.equal(response.status, 202);
    return response.json();
  },
  poll: async id => { polled.push(id); return statuses.shift(); },
  onComplete: result => {
    ui.hypotheses = result.causes;
    ui.completedRounds++;
    firstDone.resolve();
  },
  onFail: reason => { ui.error = reason; firstDone.resolve(); },
  initialPollDelayMs: 0, pollIntervalMs: 0, deadlineMs: 1_000,
});
await withLimit(firstDone.promise);
assert.deepEqual(ui, { hypotheses: firstCauses, completedRounds: 1, error: '' }, 'completed hypotheses appear on the first run without another click');
assert.deepEqual(started, [{ id: firstId, round: 1 }], 'the first start endpoint is called exactly once');
assert.deepEqual(polled, [firstId, firstId, firstId], 'all processing and completed statuses belong to the first ID');

const secondDone = outcome();
startAIHypothesesRun({
  sourceEventId: secondId, analysisRound: 2,
  submit: async (id, round) => { started.push({ id, round }); return { status: 'processing' }; },
  poll: async id => {
    assert.equal(id, secondId);
    return { status: 'completed', causes: secondCauses };
  },
  onComplete: result => { ui.hypotheses = result.causes; ui.completedRounds++; secondDone.resolve(); },
  onFail: reason => { ui.error = reason; secondDone.resolve(); },
  initialPollDelayMs: 0, deadlineMs: 1_000,
});
await withLimit(secondDone.promise);
assert.deepEqual(started, [{ id: firstId, round: 1 }, { id: secondId, round: 2 }], 'the deliberate second click starts a genuinely new request');
assert.deepEqual(ui.hypotheses, secondCauses, 'the second click never replays the first result');

const racingDone = outcome();
let releaseLateSubmit;
let racingApplies = 0;
startAIHypothesesRun({
  sourceEventId: firstId, analysisRound: 1,
  submit: async () => new Promise(resolve => { releaseLateSubmit = resolve; }),
  poll: async () => ({ status: 'completed', causes: firstCauses }),
  onComplete: () => { racingApplies++; racingDone.resolve(); },
  onFail: reason => racingDone.resolve(reason),
  initialPollDelayMs: 0, deadlineMs: 1_000,
});
await withLimit(racingDone.promise);
releaseLateSubmit({ status: 'completed', causes: firstCauses });
await nextTick();
assert.equal(racingApplies, 1, 'a late POST completion cannot apply the same hypotheses twice');

const retryDone = outcome();
let retryPolls = 0;
startAIHypothesesRun({
  sourceEventId: firstId, analysisRound: 1,
  submit: async () => { throw new DOMException('POST timed out', 'TimeoutError'); },
  poll: async () => {
    retryPolls++;
    if (retryPolls === 1) throw new DOMException('Status timed out', 'TimeoutError');
    if (retryPolls === 2) return { status: 'processing' };
    return { status: 'completed', causes: firstCauses };
  },
  onComplete: result => retryDone.resolve(result),
  onFail: reason => retryDone.resolve(reason),
  initialPollDelayMs: 0, pollIntervalMs: 0, deadlineMs: 1_000,
});
assert.deepEqual(await withLimit(retryDone.promise), { status: 'completed', causes: firstCauses }, 'one transport timeout cannot discard a later completed status');
assert.equal(retryPolls, 3);

const failedDone = outcome();
let lateFailedStatus;
let failedApplies = 0;
startAIHypothesesRun({
  sourceEventId: firstId, analysisRound: 1,
  submit: async () => ({ status: 'processing' }),
  poll: async () => new Promise(resolve => { lateFailedStatus = resolve; }),
  onComplete: () => { failedApplies++; failedDone.resolve('completed'); },
  onFail: reason => failedDone.resolve(reason),
  initialPollDelayMs: 0, deadlineMs: 20,
});
assert.equal(await withLimit(failedDone.promise), 'timeout', 'a late status produces a timeout, never a completed UI');
lateFailedStatus({ status: 'completed', causes: firstCauses });
await nextTick();
assert.equal(failedApplies, 0, 'a completed response arriving after the deadline is ignored');

const explicitFailure = outcome();
startAIHypothesesRun({
  sourceEventId: firstId, analysisRound: 1,
  submit: async () => ({ status: 'processing' }),
  poll: async () => ({ status: 'failed' }),
  onComplete: () => explicitFailure.resolve('completed'),
  onFail: reason => explicitFailure.resolve(reason),
  initialPollDelayMs: 0, deadlineMs: 1_000,
});
assert.equal(await withLimit(explicitFailure.promise), 'failed', 'a failed status cannot become completed');

const cancelledDone = outcome();
let releaseCancelledStatus;
let cancelledApplies = 0;
const cancelled = startAIHypothesesRun({
  sourceEventId: firstId, analysisRound: 1,
  submit: async () => ({ status: 'processing' }),
  poll: async () => new Promise(resolve => { releaseCancelledStatus = resolve; cancelledDone.resolve(); }),
  onComplete: () => { cancelledApplies++; },
  onFail: () => { cancelledApplies++; },
  initialPollDelayMs: 0, deadlineMs: 1_000,
});
await withLimit(cancelledDone.promise);
cancelled.cancel();
releaseCancelledStatus({ status: 'completed', causes: firstCauses });
await nextTick();
assert.equal(cancelledApplies, 0, 'a cancelled old run cannot update a new Diagnostic flow');

console.log('PASS first-click completion, one start call, new second run, transient timeout, terminal failure, deadline, and cancellation');
