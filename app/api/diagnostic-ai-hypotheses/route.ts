import { CATEGORIES, parseAnalysis, type Category, type Cause } from '@/lib/analysis';
import { PublicAIIntakeError, requestPublicAIHypotheses } from '@/lib/public-ai-intake-client';
import { json, rateLimit, readBody, setting } from '@/lib/server';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const customerError = 'Die KI-Hypothesen konnten nicht ergänzt werden. Ihre eigene Analyse bleibt unverändert nutzbar.';

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    if (!await rateLimit(request, 'public-ai-hypotheses', 5)) return json({ error: 'Die KI-Analyse wurde gerade bereits ausgeführt. Bitte verwenden Sie die vorhandenen Vorschläge oder versuchen Sie es in Kürze erneut.' }, 429, { 'Retry-After': '60' });
    if (!uuid(body.sourceEventId)) return json({ error: customerError }, 400);
    const analysis = parseAnalysis({ problem: body.problem, causes: body.causes, availableData: [] });
    const hypotheses = await requestPublicAIHypotheses({
      source_event_id: body.sourceEventId,
      problem: analysis.problem,
      causes: analysis.causes.filter(cause => cause.source === 'user').map(cause => ({ category: cause.category, text: cause.text })),
    }, { baseUrl: setting('QONSUL_COCKPIT_INTAKE_URL'), secret: setting('QONSUL_COCKPIT_INTAKE_SECRET') });

    const causes: Cause[] = hypotheses.map((hypothesis, index) => ({
      id: hypothesis.id || `ai-${index}`,
      category: CATEGORIES.includes(hypothesis.category as Category) ? hypothesis.category as Category : 'Prozess',
      text: hypothesis.text,
      check: hypothesis.reasoning_summary,
      source: 'ai',
    }));
    parseAnalysis({ problem: analysis.problem, causes });
    return json({ causes, notice: 'KI-Hypothesen ergänzt. Bitte mit Daten validieren; keine bestätigten Ursachen.' });
  } catch (error) {
    if (setting('STAGING_AI_INTAKE_TRACE') === 'true' && error instanceof PublicAIIntakeError) {
      console.info('staging_ai_intake_trace', JSON.stringify({ correlation_id: error.correlationId, handler_reached: true, outbound_attempted: true, target_host: error.targetHost, target_path: error.targetPath, method: 'POST', content_type: 'application/json', hmac_header_present: true, timestamp_header_present: true, cockpit_status: error.httpStatus, network_failure: error.networkFailure }));
    }
    if (error instanceof PublicAIIntakeError && error.httpStatus === 429) {
      if (error.retryAfterSeconds) return json({ error: 'Die KI-Analyse wurde gerade bereits ausgeführt. Bitte verwenden Sie die vorhandenen Vorschläge oder versuchen Sie es in Kürze erneut.' }, 429, { 'Retry-After': String(error.retryAfterSeconds) });
      return json({ error: 'Die KI-Analyse wurde gerade bereits ausgeführt. Bitte verwenden Sie die vorhandenen Vorschläge oder versuchen Sie es in Kürze erneut.' }, 429);
    }
    return json({ error: customerError }, 503);
  }
}
