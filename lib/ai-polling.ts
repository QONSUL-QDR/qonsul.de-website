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
