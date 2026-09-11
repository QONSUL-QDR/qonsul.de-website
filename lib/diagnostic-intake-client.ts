import { signature } from './cockpit-intake-client.ts';

type Options = { baseUrl: string; secret: string; fetchImpl?: typeof fetch; attempts?: number; timeoutMs?: number };
type DiagnosticResponse = { data?: { id?: string; reference?: string; status?: string; evidence_score?: number } };

export class DiagnosticDeliveryError extends Error {
  readonly transient: boolean;
  readonly httpStatus: number | null;
  readonly retryWithNewSubmissionId: boolean;
  constructor(message: string, transient: boolean, httpStatus: number | null = null, retryWithNewSubmissionId = false) {
    super(message); this.name = 'DiagnosticDeliveryError'; this.transient = transient; this.httpStatus = httpStatus;
    this.retryWithNewSubmissionId = retryWithNewSubmissionId;
  }
}

async function hasIdempotencyConflict(response: Response): Promise<boolean> {
  try {
    const payload = await response.clone().json() as { errors?: Record<string, unknown> };
    return Object.prototype.hasOwnProperty.call(payload.errors || {}, 'idempotency_key');
  } catch { return false; }
}

function validOptions(options: Options) {
  if (options.secret.length < 32) throw new DiagnosticDeliveryError('Diagnostic authentication is not configured.', false);
  const base = new URL(options.baseUrl);
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new DiagnosticDeliveryError('Diagnostic URL must use HTTPS.', false);
  return base;
}

async function post(path: string, event: Record<string, unknown>, options: Options): Promise<Response> {
  const base = validOptions(options), body = JSON.stringify(event), url = new URL(path, base), execute = options.fetchImpl || fetch;
  const attempts = Math.min(3, Math.max(1, options.attempts || 3)), timeout = Math.min(10000, Math.max(500, options.timeoutMs || 4000));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000), sourceEventId = String(event.source_event_id || ''), requestId = crypto.randomUUID();
    try {
      const response = await execute(url, { method: 'POST', signal: AbortSignal.timeout(timeout), headers: {
        'Accept': 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': sourceEventId, 'X-Request-ID': requestId,
        'X-Qonsul-Timestamp': String(timestamp), 'X-Qonsul-Signature': `v1=${await signature(options.secret, 'POST', path, timestamp, sourceEventId, body)}`,
      }, body });
      if (response.ok || response.status === 202) return response;
      if (response.status < 500 && response.status !== 429) throw new DiagnosticDeliveryError('Diagnostic request was rejected.', false, response.status, await hasIdempotencyConflict(response));
      if (attempt === attempts - 1) throw new DiagnosticDeliveryError('Diagnostic service is temporarily unavailable.', true, response.status);
    } catch (error) {
      if (error instanceof DiagnosticDeliveryError && !error.transient) throw error;
      if (attempt === attempts - 1) throw error instanceof DiagnosticDeliveryError ? error : new DiagnosticDeliveryError('Diagnostic service is temporarily unavailable.', true);
    }
    await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
  }
  throw new DiagnosticDeliveryError('Diagnostic service is temporarily unavailable.', true);
}

export async function deliverDiagnostic(event: Record<string, unknown>, options: Options) {
  const response = await post('/api/v1/intake/diagnostic', event, options);
  const result = await response.json() as DiagnosticResponse;
  if (!result.data?.id || !result.data.reference || result.data.status !== 'completed') throw new DiagnosticDeliveryError('Unexpected diagnostic response.', false, response.status);
  return { id: result.data.id, reference: result.data.reference, evidenceScore: result.data.evidence_score ?? 0, replayed: response.status === 200 };
}

export async function requestDiagnosticConsultation(event: Record<string, unknown>, options: Options) {
  const response = await post('/api/v1/intake/diagnostic/consultation', event, options);
  const result = await response.json() as { status?: string; diagnostic_id?: string };
  if (!result.diagnostic_id || !['resolved', 'pending_review', 'pending'].includes(result.status || '')) throw new DiagnosticDeliveryError('Unexpected consultation response.', false, response.status);
  return { status: result.status as 'resolved' | 'pending_review' | 'pending', diagnosticId: result.diagnostic_id };
}
