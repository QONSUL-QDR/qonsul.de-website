export const ANALYTICS_SESSION_STORAGE_KEY = 'qonsul.analytics.session.v1';
export const ANALYTICS_SESSION_INACTIVITY_MS = 30 * 60 * 1000;
export const ANALYTICS_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type AnalyticsSession = {
  id: string;
  createdAt: number;
  touchedAt: number;
};

function validSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function parseAnalyticsSession(value: string | null): AnalyticsSession | null {
  try {
    const session = JSON.parse(value || 'null') as Partial<AnalyticsSession> | null;
    return validSessionId(session?.id) && validTimestamp(session.createdAt) && validTimestamp(session.touchedAt)
      ? { id: session.id, createdAt: session.createdAt, touchedAt: session.touchedAt }
      : null;
  } catch {
    return null;
  }
}

export function resolveAnalyticsSession(value: string | null, now: number, createId: () => string): AnalyticsSession {
  const existing = parseAnalyticsSession(value);
  if (!existing || now - existing.touchedAt >= ANALYTICS_SESSION_INACTIVITY_MS || now - existing.createdAt >= ANALYTICS_SESSION_MAX_AGE_MS) {
    return { id: createId(), createdAt: now, touchedAt: now };
  }

  return { ...existing, touchedAt: now };
}

export function currentAnalyticsSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return parseAnalyticsSession(window.sessionStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY))?.id ?? null;
}
