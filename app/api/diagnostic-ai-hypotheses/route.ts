import { CATEGORIES, parseAnalysis, type Category, type Cause } from '@/lib/analysis';
import { requestPublicAIHypotheses } from '@/lib/public-ai-intake-client';
import { json, rateLimit, readBody, setting } from '@/lib/server';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const customerError = 'Die KI-Hypothesen konnten nicht ergänzt werden. Ihre eigene Analyse bleibt unverändert nutzbar.';

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    if (!await rateLimit(request, 'public-ai-hypotheses', 5)) return json({ error: customerError }, 429);
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
  } catch { return json({ error: customerError }, 503); }
}
