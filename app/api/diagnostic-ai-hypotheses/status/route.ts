import { CATEGORIES, type Category, type Cause } from '@/lib/analysis';
import { PublicAIIntakeError, requestPublicAIHypothesesStatus } from '@/lib/public-ai-intake-client';
import { json, rateLimit, readBody, setting } from '@/lib/server';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const customerError = 'Die KI-Hypothesen konnten nicht ergänzt werden. Ihre eigene Analyse bleibt unverändert nutzbar.';

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    if (!await rateLimit(request, 'public-ai-hypotheses-status', 60)) return json({ error: customerError }, 429, { 'Retry-After': '60' });
    if (!uuid(body.sourceEventId)) return json({ error: customerError }, 400);
    const result = await requestPublicAIHypothesesStatus(body.sourceEventId, {
      baseUrl: setting('QONSUL_COCKPIT_INTAKE_URL'), secret: setting('QONSUL_COCKPIT_INTAKE_SECRET'),
    });
    if (result.status !== 'completed') return json({ status: result.status });
    const causes: Cause[] = result.hypotheses!.map((hypothesis, index) => ({
      id: hypothesis.id || `ai-${index}`,
      category: CATEGORIES.includes(hypothesis.category as Category) ? hypothesis.category as Category : 'Prozess',
      text: hypothesis.text,
      check: hypothesis.reasoning_summary,
      source: 'ai',
    }));
    return json({ status: 'completed', causes });
  } catch (error) {
    if (setting('STAGING_AI_INTAKE_TRACE') === 'true' && error instanceof PublicAIIntakeError) {
      console.info('staging_ai_intake_trace', JSON.stringify({ correlation_id: error.correlationId, handler_reached: true, outbound_attempted: true, target_host: error.targetHost, target_path: error.targetPath, method: 'POST', content_type: 'application/json', hmac_header_present: true, timestamp_header_present: true, cockpit_status: error.httpStatus, network_failure: error.networkFailure }));
    }
    return json({ error: customerError }, 503);
  }
}
