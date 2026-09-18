import { correctDiagnosticConsultationEmail, DiagnosticDeliveryError } from '@/lib/diagnostic-intake-client';
import { json, rateLimit, readBody, setting } from '@/lib/server';

const configured = () => ({ baseUrl: setting('QONSUL_COCKPIT_INTAKE_URL'), secret: setting('QONSUL_COCKPIT_INTAKE_SECRET') });
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const email = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
      ? body.email.trim().toLowerCase() : null;
    if (!validToken(body.token) || !validToken(body.nextToken) || !uuid(body.correctionId) || !email) throw new Error('Ungültige Eingabe.');
    if (!await rateLimit(request, 'diagnostic-email-correction', 3)) {
      return json({ error: 'Eine Korrektur ist derzeit nicht möglich. Bitte versuchen Sie es später erneut.' }, 429);
    }

    const result = await correctDiagnosticConsultationEmail({
      source_event_id: body.correctionId, correction_token: body.token,
      new_correction_token: body.nextToken, email,
    }, configured());
    return json({ status: 'accepted', correctionPath: `/anfrage-verwalten/${encodeURIComponent(result.correctionToken)}` }, 202);
  } catch (error) {
    const status = error instanceof DiagnosticDeliveryError && error.transient ? 503
      : error instanceof DiagnosticDeliveryError ? (error.httpStatus || 422) : 400;
    return json({ error: 'Der Korrektur-Link ist ungültig oder abgelaufen. Eine Anfrage kann nicht angezeigt werden.' }, status);
  }
}
