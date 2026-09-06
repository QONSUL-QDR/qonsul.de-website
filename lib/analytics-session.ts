export const ANALYTICS_SESSION_STORAGE_KEY = 'qonsul.analytics.session.v1';

export function currentAnalyticsSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY) || 'null') as {id?: unknown};
    return typeof value?.id === 'string' && /^[0-9a-f-]{36}$/i.test(value.id) ? value.id : null;
  } catch { return null; }
}
