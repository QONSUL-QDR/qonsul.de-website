import { signature } from './cockpit-intake-client.ts';

export type PublicAIHypothesis = {
  id: string;
  category: string;
  text: string;
  reasoning_summary: string;
  origin: 'ai';
};

export type PublicAIHypothesesStatus = {
  status: 'processing' | 'completed' | 'failed' | 'not_found';
  hypotheses?: PublicAIHypothesis[];
};

export type PublicAIHypothesesSubmission =
  | { status: 'processing' }
  | { status: 'completed'; hypotheses: PublicAIHypothesis[] };

export class PublicAIIntakeError extends Error {
  readonly transient: boolean;
  readonly httpStatus: number | null;
  readonly retryAfterSeconds: number | null;
  readonly correlationId: string | null;
  readonly targetHost: string | null;
  readonly targetPath: string | null;
  readonly networkFailure: string | null;
  readonly reason: 'configuration' | 'http_error' | 'cockpit_failed' | 'invalid_response' | 'network_failure';
  readonly outboundAttempted: boolean;
  constructor(transient: boolean, httpStatus: number | null = null, retryAfterSeconds: number | null = null, correlationId: string | null = null, targetHost: string | null = null, targetPath: string | null = null, networkFailure: string | null = null, reason: PublicAIIntakeError['reason'] = 'invalid_response', outboundAttempted = false) {
    super('Public AI assistance is unavailable.');
    this.transient = transient;
    this.httpStatus = httpStatus;
    this.retryAfterSeconds = retryAfterSeconds;
    this.correlationId = correlationId;
    this.targetHost = targetHost;
    this.targetPath = targetPath;
    this.networkFailure = networkFailure;
    this.reason = reason;
    this.outboundAttempted = outboundAttempted;
  }
}

function target(options: { baseUrl: string; secret: string }, path: string) {
  const correlationId = crypto.randomUUID();
  let base: URL;
  try { base = new URL(options.baseUrl); }
  catch { throw new PublicAIIntakeError(false, null, null, correlationId, null, path, null, 'configuration'); }
  if (options.secret.length < 32 || (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname))) {
    throw new PublicAIIntakeError(false, null, null, correlationId, base.hostname, path, null, 'configuration');
  }
  return { base, correlationId };
}

export async function requestPublicAIHypotheses(
  event: { source_event_id: string; analysis_round: 1 | 2; problem: string; causes: { category: string; text: string }[] },
  options: { baseUrl: string; secret: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<PublicAIHypothesesSubmission> {
  const path = '/api/v1/intake/diagnostic/ai-hypotheses';
  const { base, correlationId } = target(options, path);
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  let response: Response;
  try {
    response = await (options.fetchImpl || fetch)(new URL(path, base), {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(Math.min(40_000, Math.max(500, options.timeoutMs || 35_000))),
      headers: {
        'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Request-ID': correlationId,
        'X-Qonsul-Timestamp': String(timestamp),
        'X-Qonsul-Signature': `v1=${await signature(options.secret, 'POST', path, timestamp, event.source_event_id, body)}`,
      }, body,
    });
  } catch { throw new PublicAIIntakeError(true, null, null, correlationId, base.hostname, path, 'OTHER_NETWORK_ERROR', 'network_failure', true); }

  if (!response.ok) {
    const retryAfter = Number(response.headers.get('Retry-After'));
    throw new PublicAIIntakeError(response.status >= 500 || response.status === 429, response.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null, correlationId, base.hostname, path, null, 'http_error', true);
  }
  let result: { status?: unknown; hypotheses?: unknown };
  try { result = await response.json() as typeof result; }
  catch { throw new PublicAIIntakeError(false, response.status, null, correlationId, base.hostname, path, null, 'invalid_response', true); }
  if (result.status === 'processing') return { status: 'processing' };
  if (result.status === 'failed') throw new PublicAIIntakeError(false, response.status, null, correlationId, base.hostname, path, null, 'cockpit_failed', true);
  if (!Array.isArray(result.hypotheses)) throw new PublicAIIntakeError(false, response.status, null, correlationId, base.hostname, path, null, 'invalid_response', true);
  return { status: 'completed', hypotheses: result.hypotheses as PublicAIHypothesis[] };
}

/** Reads only the Cockpit's cached public-AI state; it never requests generation. */
export async function requestPublicAIHypothesesStatus(
  sourceEventId: string,
  options: { baseUrl: string; secret: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<PublicAIHypothesesStatus> {
  const path = '/api/v1/intake/diagnostic/ai-hypotheses/status';
  const { base, correlationId } = target(options, path);
  const body = JSON.stringify({ source_event_id: sourceEventId });
  const timestamp = Math.floor(Date.now() / 1000);
  let response: Response;
  try {
    response = await (options.fetchImpl || fetch)(new URL(path, base), {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(Math.min(15_000, Math.max(500, options.timeoutMs || 10_000))),
      headers: {
        'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Request-ID': correlationId,
        'X-Qonsul-Timestamp': String(timestamp),
        'X-Qonsul-Signature': `v1=${await signature(options.secret, 'POST', path, timestamp, sourceEventId, body)}`,
      }, body,
    });
  } catch { throw new PublicAIIntakeError(true, null, null, correlationId, base.hostname, path, 'OTHER_NETWORK_ERROR', 'network_failure', true); }

  if (!response.ok) {
    const retryAfter = Number(response.headers.get('Retry-After'));
    throw new PublicAIIntakeError(response.status >= 500 || response.status === 429, response.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null, correlationId, base.hostname, path, null, 'http_error', true);
  }
  let result: { status?: unknown; hypotheses?: unknown };
  try { result = await response.json() as typeof result; }
  catch { throw new PublicAIIntakeError(false, response.status, null, correlationId, base.hostname, path, null, 'invalid_response', true); }
  if (!['processing', 'completed', 'failed', 'not_found'].includes(String(result.status))) throw new PublicAIIntakeError(false, response.status, null, correlationId, base.hostname, path, null, 'invalid_response', true);
  if (result.status === 'completed' && !Array.isArray(result.hypotheses)) throw new PublicAIIntakeError(false, response.status, null, correlationId, base.hostname, path, null, 'invalid_response', true);
  return result as PublicAIHypothesesStatus;
}
