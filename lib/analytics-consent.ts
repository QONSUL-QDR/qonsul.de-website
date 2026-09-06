export const ANALYTICS_CONSENT_STORAGE_KEY = 'qonsul.analytics.consent.v1';

export type AnalyticsConsentState = 'unknown' | 'granted' | 'denied';

export function parseAnalyticsConsent(value: string | null): AnalyticsConsentState {
  return value === 'granted' || value === 'denied' ? value : 'unknown';
}

export function analyticsConsentGranted(value: string | null): boolean {
  return parseAnalyticsConsent(value) === 'granted';
}
