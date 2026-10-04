export type AIHypothesesPollingAction = 'poll' | 'apply' | 'fail';

type AIHypothesesPollingInput =
  | { kind: 'timeout' }
  | { kind: 'status'; responseOk: boolean; status?: string; hasCauses: boolean };

/** Resolves the only three outcomes of a public AI status lookup. */
export function nextAIHypothesesPollingAction(input: AIHypothesesPollingInput): AIHypothesesPollingAction {
  if (input.kind === 'timeout') return 'fail';
  if (!input.responseOk || input.status === 'failed') return 'fail';
  if (input.status === 'not_found' || input.status === 'processing') return 'poll';
  return input.status === 'completed' && input.hasCauses ? 'apply' : 'fail';
}

export type AIHypothesesRunResult<T> =
  | { status: 'processing' | 'not_found' }
  | { status: 'completed'; causes: T[]; notice?: string }
  | { status: 'failed'; reason?: 'unavailable' };

type AIHypothesesRunOptions<T> = {
  sourceEventId: string;
  analysisRound: 1 | 2;
  submit: (sourceEventId: string, analysisRound: 1 | 2, signal: AbortSignal) => Promise<AIHypothesesRunResult<T>>;
  poll: (sourceEventId: string, signal: AbortSignal) => Promise<AIHypothesesRunResult<T>>;
  onComplete: (result: Extract<AIHypothesesRunResult<T>, { status: 'completed' }>) => void;
  onFail: (reason: 'failed' | 'timeout' | 'unavailable') => void;
  initialPollDelayMs?: number;
  pollIntervalMs?: number;
  deadlineMs?: number;
};

/** Keeps one submission and every status response bound to the same cancellable run. */
export function startAIHypothesesRun<T>(options: AIHypothesesRunOptions<T>): { cancel: () => void } {
  const controller = new AbortController();
  let active = true;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (!active) return;
    active = false;
    if (pollTimer) clearTimeout(pollTimer);
    if (deadlineTimer) clearTimeout(deadlineTimer);
    controller.abort();
  };
  const fail = (reason: 'failed' | 'timeout' | 'unavailable') => {
    if (!active) return;
    cancel();
    options.onFail(reason);
  };
  const complete = (result: Extract<AIHypothesesRunResult<T>, { status: 'completed' }>) => {
    if (!active) return;
    cancel();
    options.onComplete(result);
  };
  const schedulePoll = (delay: number) => {
    if (active) pollTimer = setTimeout(() => void poll(), delay);
  };
  const poll = async () => {
    if (!active) return;
    try {
      const result = await options.poll(options.sourceEventId, controller.signal);
      if (!active) return;
      const action = nextAIHypothesesPollingAction({
        kind: 'status', responseOk: true, status: result.status,
        hasCauses: result.status === 'completed' && Array.isArray(result.causes),
      });
      if (action === 'apply' && result.status === 'completed') complete(result);
      else if (action === 'poll') schedulePoll(options.pollIntervalMs ?? 2_500);
      else fail('failed');
    } catch {
      // A single transport timeout is inconclusive. The run deadline remains authoritative.
      if (active) schedulePoll(options.pollIntervalMs ?? 2_500);
    }
  };

  deadlineTimer = setTimeout(() => fail('timeout'), options.deadlineMs ?? 90_000);
  schedulePoll(options.initialPollDelayMs ?? 3_000);
  void options.submit(options.sourceEventId, options.analysisRound, controller.signal).then(result => {
    if (!active) return;
    if (result.status === 'completed') complete(result);
    else if (result.status === 'failed') fail(result.reason ?? 'failed');
  }).catch(() => {
    // The POST may have reached Cockpit despite a transport timeout; polling decides its outcome.
  });

  return { cancel };
}
