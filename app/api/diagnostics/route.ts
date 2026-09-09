import { diagnosticEvent, DIAGNOSTIC_PROCESSING_CONSENT_VERSION } from '@/lib/diagnostic-contract';
import { deliverDiagnostic, DiagnosticDeliveryError, requestDiagnosticConsultation } from '@/lib/diagnostic-intake-client';
import { parseAnalysis } from '@/lib/analysis';
import { json, rateLimit, readBody, setting } from '@/lib/server';
import { CONTACT_PRIVACY_VERSION } from '@/lib/contact';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const configured = () => ({ baseUrl: setting('QONSUL_COCKPIT_INTAKE_URL'), secret: setting('QONSUL_COCKPIT_INTAKE_SECRET') });

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    if (setting('PRODUCTION_READY') !== 'true' && body.demoConfirmed !== true) throw new Error('In der privaten Vorschau bitte nur Testdaten verwenden und dies bestätigen.');
    if (body.website) throw new Error('Anfrage abgelehnt.');
    if (!uuid(body.submissionId)) throw new Error('Ungültige Diagnostic-Kennung.');
    if (body.diagnosticConsent !== true || body.consentVersion !== DIAGNOSTIC_PROCESSING_CONSENT_VERSION) throw new Error('Bitte stimmen Sie der Verarbeitung für das Quality Diagnostic ausdrücklich zu.');
    if (!await rateLimit(request, 'diagnostic', 8)) return json({ error: 'Zu viele Diagnosen. Bitte später erneut versuchen.' }, 429);
    const analysis = parseAnalysis(body.analysis);
    const analyticsSessionId = uuid(body.analyticsSessionId) ? body.analyticsSessionId : null;
    const result = await deliverDiagnostic(diagnosticEvent(body.submissionId, analysis, analyticsSessionId), configured());
    return json({ status: 'accepted', diagnostic: result }, result.replayed ? 200 : 201);
  } catch (error) {
    const status = error instanceof DiagnosticDeliveryError && error.transient ? 503 : error instanceof DiagnosticDeliveryError ? (error.httpStatus || 422) : 400;
    return json({ error: error instanceof Error ? error.message : 'Diagnostic konnte nicht gespeichert werden.' }, status);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readBody(request);
    if (setting('PRODUCTION_READY') !== 'true' && body.demoConfirmed !== true) throw new Error('In der privaten Vorschau bitte nur Testdaten verwenden und dies bestätigen.');
    if (body.website) throw new Error('Anfrage abgelehnt.');
    if (!uuid(body.consultationId) || !uuid(body.diagnosticId)) throw new Error('Ungültige Diagnostic-Kennung.');
    const name = typeof body.name === 'string' && body.name.trim().length >= 2 && body.name.trim().length <= 100 ? body.name.trim() : null;
    const email = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ? body.email.trim().toLowerCase() : null;
    const company = typeof body.company === 'string' && body.company.trim().length <= 150 ? body.company.trim() || null : null;
    if (!name || !email || body.contactConsent !== true || body.privacyVersion !== CONTACT_PRIVACY_VERSION) throw new Error('Bitte geben Sie Ihre Kontaktdaten ein und bestätigen Sie die Kontaktaufnahme.');
    const result = await requestDiagnosticConsultation({
      source_event_id: body.consultationId, diagnostic_id: body.diagnosticId,
      contact: { name, email }, ...(company ? { company: { name: company } } : {}),
      consent: { contact_requested: true, privacy_version: CONTACT_PRIVACY_VERSION },
    }, configured());
    return json({ status: result.status, diagnosticId: result.diagnosticId }, result.status === 'pending' ? 202 : 201);
  } catch (error) {
    const status = error instanceof DiagnosticDeliveryError && error.transient ? 503 : error instanceof DiagnosticDeliveryError ? (error.httpStatus || 422) : 400;
    return json({ error: error instanceof Error ? error.message : 'Beratungsanfrage konnte nicht übermittelt werden.' }, status);
  }
}
