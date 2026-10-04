import { CATEGORIES, type Cause } from './analysis.ts';
import type { PublicAIHypothesis } from './public-ai-intake-client.ts';

export type FocusCause = {
  origin_ref: string;
  source: 'user' | 'ai';
  category: Cause['category'];
  text: string;
  reasoning_summary?: string;
  recommended_check?: string;
};

export type PriorHypothesis = { id: string; category: Cause['category']; text: string };

export function focusedRoundRequest(causes: Cause[], roundOneHypotheses: Cause[], selectedIds: string[]) {
  const selectable = [...causes.filter(cause => cause.source === 'user' || cause.source === 'ai'), ...roundOneHypotheses];
  const unique = new Map(selectable.map(cause => [cause.id, cause]));
  const focusCauses: FocusCause[] = selectedIds.flatMap(id => {
    const cause = unique.get(id);
    if (!cause) return [];
    return [{ origin_ref: cause.id, source: cause.source === 'user' ? 'user' : 'ai', category: cause.category, text: cause.text,
      ...(cause.source === 'ai' ? { reasoning_summary: cause.reasoning || '', recommended_check: cause.recommendedCheck || '' } : {}) }];
  });
  return {
    causes: causes.filter(cause => cause.source === 'user').map(cause => ({ id: cause.id, source: 'user' as const, category: cause.category, text: cause.text })),
    focus_causes: focusCauses,
    prior_hypotheses: roundOneHypotheses.map(cause => ({ id: cause.id, category: cause.category, text: cause.text } satisfies PriorHypothesis)),
  };
}

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function parseFocusPayload(value: unknown, ownCauses: { category: string; text: string }[]) {
  if (!value || typeof value !== 'object') throw new Error('Invalid focus payload');
  const body = value as { focus_causes?: unknown; prior_hypotheses?: unknown };
  if (!Array.isArray(body.focus_causes) || body.focus_causes.length < 1 || body.focus_causes.length > 30 ||
      !Array.isArray(body.prior_hypotheses) || body.prior_hypotheses.length !== 12) throw new Error('Invalid focus payload');
  const prior = body.prior_hypotheses.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Invalid prior hypothesis');
    const row = item as PriorHypothesis;
    if (!uuid(row.id) || !CATEGORIES.includes(row.category) || typeof row.text !== 'string' || row.text.trim().length < 3 || row.text.length > 220) throw new Error('Invalid prior hypothesis');
    return { id: row.id, category: row.category, text: row.text.trim() };
  });
  if (new Set(prior.map(row => row.id)).size !== prior.length) throw new Error('Duplicate prior hypothesis');
  const focus = body.focus_causes.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Invalid focus cause');
    const row = item as FocusCause;
    if (!uuid(row.origin_ref) || !['user', 'ai'].includes(row.source) || !CATEGORIES.includes(row.category) || typeof row.text !== 'string' || row.text.trim().length < 3 || row.text.length > 220) throw new Error('Invalid focus cause');
    if (row.source === 'user' && !ownCauses.some(cause => cause.category === row.category && cause.text === row.text.trim())) throw new Error('Unknown own cause');
    if (row.source === 'ai' && (!prior.some(item => item.id === row.origin_ref && item.category === row.category && item.text === row.text.trim()) ||
      typeof row.reasoning_summary !== 'string' || !row.reasoning_summary.trim() || row.reasoning_summary.length > 300 ||
      typeof row.recommended_check !== 'string' || !row.recommended_check.trim() || row.recommended_check.length > 300)) throw new Error('Unknown AI cause');
    return { origin_ref: row.origin_ref, source: row.source, category: row.category, text: row.text.trim(),
      ...(row.source === 'ai' ? { reasoning_summary: row.reasoning_summary!.trim(), recommended_check: row.recommended_check!.trim() } : {}) };
  });
  if (new Set(focus.map(row => row.origin_ref)).size !== focus.length) throw new Error('Duplicate focus cause');
  return { focus_causes: focus, prior_hypotheses: prior };
}

export function publicHypothesesAsCauses(hypotheses: PublicAIHypothesis[], round: 1 | 2): Cause[] {
  if (round === 2 && hypotheses.length > 8) throw new Error('Too many focused hypotheses');
  const perOrigin = new Map<string, number>();
  return hypotheses.map((hypothesis, index) => {
    if ((round === 2 && !uuid(hypothesis.id)) || !CATEGORIES.includes(hypothesis.category as Cause['category']) ||
        typeof hypothesis.text !== 'string' || hypothesis.text.length < 3 || hypothesis.text.length > 220) throw new Error('Invalid hypothesis');
    if (round === 1 && (typeof hypothesis.reasoning_summary !== 'string' || !hypothesis.reasoning_summary.trim())) throw new Error('Invalid broad hypothesis');
    if (round === 2) {
      if (!uuid(hypothesis.origin_ref) || typeof hypothesis.mechanism !== 'string' || !hypothesis.mechanism.trim() ||
          typeof hypothesis.recommended_check !== 'string' || !hypothesis.recommended_check.trim()) throw new Error('Invalid focused hypothesis');
      const count = (perOrigin.get(hypothesis.origin_ref) || 0) + 1;
      if (count > 2) throw new Error('Too many hypotheses per cause');
      perOrigin.set(hypothesis.origin_ref, count);
    }
    const summary = typeof hypothesis.reasoning_summary === 'string' ? hypothesis.reasoning_summary : '';
    const recommendedCheck = round === 1 ? summary.match(/Prüfen\s*:\s*(.+)$/iu)?.[1]?.trim() || '' : hypothesis.recommended_check;
    return { id: hypothesis.id || `ai-${index}`, category: hypothesis.category as Cause['category'], text: hypothesis.text, source: 'ai',
      check: round === 1 ? summary : recommendedCheck,
      ...(round === 1 ? { reasoning: summary, recommendedCheck } : { originRef: hypothesis.origin_ref, mechanism: hypothesis.mechanism }) };
  });
}
