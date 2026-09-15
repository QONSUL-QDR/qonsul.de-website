import { signature } from './cockpit-intake-client.ts';

export type PublicAIHypothesis = {
  id: string;
  category: string;
  text: string;
  reasoning_summary: string;
  origin: 'ai';
};

export class PublicAIIntakeError extends Error {
  readonly transient: boolean;
  readonly httpStatus: number | null;
  readonly retryAfterSeconds: number | null;
  constructor(transient: boolean, httpStatus: number | null = null, retryAfterSeconds: number | null = null) { super('Public AI assistance is unavailable.'); this.transient = transient; this.httpStatus = httpStatus; this.retryAfterSeconds = retryAfterSeconds; }
}

export async function requestPublicAIHypotheses(
  event: { source_event_id: string; problem: string; causes: { category: string; text: string }[] },
  options: { baseUrl: string; secret: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<PublicAIHypothesis[]> {
  if (options.secret.length < 32) throw new PublicAIIntakeError(false);
  const base = new URL(options.baseUrl);
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new PublicAIIntakeError(false);

  const path = '/api/v1/intake/diagnostic/ai-hypotheses';
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  let response: Response;
  try {
    response = await (options.fetchImpl || fetch)(new URL(path, base), {
      method: 'POST', signal: AbortSignal.timeout(Math.min(10_000, Math.max(500, options.timeoutMs || 8_000))),
      headers: {
        'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Request-ID': crypto.randomUUID(),
        'X-Qonsul-Timestamp': String(timestamp),
        'X-Qonsul-Signature': `v1=${await signature(options.secret, 'POST', path, timestamp, event.source_event_id, body)}`,
      }, body,
    });
  } catch { throw new PublicAIIntakeError(true); }

  if (!response.ok) {
    const retryAfter = Number(response.headers.get('Retry-After'));
    throw new PublicAIIntakeError(response.status >= 500 || response.status === 429, response.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null);
  }
  const result = await response.json() as { hypotheses?: unknown };
  if (!Array.isArray(result.hypotheses)) throw new PublicAIIntakeError(false);
  return result.hypotheses as PublicAIHypothesis[];
}
