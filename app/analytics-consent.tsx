'use client';

import { useEffect, useState } from 'react';
import { ANALYTICS_CONSENT_STORAGE_KEY, type AnalyticsConsentState, parseAnalyticsConsent } from '@/lib/analytics-consent';

function notifyAnalyticsConsent(granted: boolean): void {
  window.dispatchEvent(new CustomEvent('qonsul:analytics-consent', { detail: { granted } }));
}

export function AnalyticsConsent(): React.ReactNode {
  const [state, setState] = useState<AnalyticsConsentState>('unknown');
  const [settingsOpen, setSettingsOpen] = useState(true);

  useEffect(() => {
    const stored = parseAnalyticsConsent(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
    notifyAnalyticsConsent(stored === 'granted');
    const frame = window.requestAnimationFrame(() => {
      setState(stored);
      setSettingsOpen(stored === 'unknown');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const choose = (granted: boolean) => {
    const next: AnalyticsConsentState = granted ? 'granted' : 'denied';
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, next);
    setState(next);
    setSettingsOpen(false);
    notifyAnalyticsConsent(granted);
  };

  if (!settingsOpen) {
    return <button className="analytics-consent-status" type="button" onClick={() => setSettingsOpen(true)}>
      Website-Analyse: {state === 'granted' ? 'aktiv' : 'deaktiviert'}
    </button>;
  }

  return <aside className="analytics-consent" aria-label="Optionale Website-Analyse">
    <p className="eyebrow">OPTIONALE WEBSITE-ANALYSE</p>
    <p>Mit Ihrer Zustimmung messen wir ausschließlich pseudonyme Nutzungsereignisse zur Verbesserung dieser Website – ohne Cookies, ohne Ihre Kontakt- oder Analyseinhalte. Diese Einwilligung ist getrennt von Einwilligungen zum Kontaktformular oder zur Ishikawa-Analyse und wird nicht für andere Zwecke verwendet. Ihre Entscheidung hat keinen Einfluss auf die Nutzbarkeit des Kontaktformulars oder der Ishikawa-Analyse.</p>
    <div className="analytics-consent-actions">
      <button className="button button-green" type="button" onClick={() => choose(true)}>Analyse erlauben</button>
      <button className="quiet-button" type="button" onClick={() => choose(false)}>Nur notwendige Funktionen</button>
    </div>
    {state !== 'unknown' && <p className="analytics-consent-note">Ihre Auswahl kann hier jederzeit geändert oder widerrufen werden.</p>}
  </aside>;
}
