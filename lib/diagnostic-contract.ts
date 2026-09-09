import { CATEGORIES, DATA_KINDS, type Analysis, type Category, type DataKind } from './analysis.ts';

export const DIAGNOSTIC_PROCESSING_CONSENT_VERSION = 'diagnostic-processing-consent-v1.0-2026-09-03';

const categoryCodes: Record<Category, string> = {
  Produkt: 'product', Prozess: 'process', Material: 'material', Mensch: 'people', Messung: 'measurement', Umgebung: 'environment',
};

export type WebsiteDiagnosticEvent = {
  source_event_id: string;
  problem: { title: string; description: string; area: string };
  categories: Array<{ code: string; causes?: string[] }>;
  hypotheses: Array<{ title: string; description: string; category_code: string; plausibility_score: number; required_data: string | null }>;
  available_data: Array<{ name: string; type: string; availability: 'available'; quality_score: number }>;
  consents: Array<{ type: 'diagnostic_processing'; granted: true }>;
  analytics_session_id?: string | null;
};

function title(problem: string): string {
  const compact = problem.replace(/\s+/g, ' ').trim();
  return compact.length <= 200 ? compact : `${compact.slice(0, 197).trimEnd()}...`;
}

/** Maps the public diagnostic UI into the established Cockpit Diagnostic API.
 * User observations remain causes; supplied rule/AI material remains an
 * unconfirmed hypothesis and is never promoted to a confirmed cause. */
export function diagnosticEvent(sourceEventId: string, analysis: Analysis, analyticsSessionId?: string | null): WebsiteDiagnosticEvent {
  const byCategory = new Map<Category, typeof analysis.causes>();
  for (const category of CATEGORIES) byCategory.set(category, analysis.causes.filter(cause => cause.category === category));
  const categories = CATEGORIES.flatMap(category => {
    const causes = byCategory.get(category) || [];
    return causes.length ? [{ code: categoryCodes[category], causes: causes.filter(cause => cause.source === 'user').map(cause => cause.text) }] : [];
  });
  if (!categories.length) throw new Error('Bitte ergänzen Sie mindestens eine Beobachtung oder Hypothese.');
  const hypotheses = analysis.causes.filter(cause => cause.source !== 'user').map(cause => ({
    title: `Prüfhypothese: ${cause.text}`.slice(0, 200),
    description: cause.check || cause.text,
    category_code: categoryCodes[cause.category],
    plausibility_score: 50,
    required_data: cause.data?.join(', ') || null,
  }));
  const available = new Set(analysis.availableData || []);
  const available_data = DATA_KINDS.filter(kind => available.has(kind)).map(kind => ({
    name: kind, type: kind, availability: 'available' as const, quality_score: 50,
  }));

  return {
    source_event_id: sourceEventId,
    problem: { title: title(analysis.problem), description: analysis.problem, area: 'Quality Diagnostic' },
    categories,
    hypotheses,
    available_data,
    consents: [{ type: 'diagnostic_processing', granted: true }],
    ...(analyticsSessionId ? { analytics_session_id: analyticsSessionId } : {}),
  };
}

export function isKnownDiagnosticDataKind(value: unknown): value is DataKind {
  return typeof value === 'string' && DATA_KINDS.includes(value as DataKind);
}
