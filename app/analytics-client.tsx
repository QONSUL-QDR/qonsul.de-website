'use client';

import { useEffect } from 'react';

type EventName = 'session_start' | 'page_view' | 'engagement_update' | 'scroll_depth' | 'cta_click';
type AnalyticsEvent = { event_id: string; name: EventName; occurred_at: string; data: Record<string, unknown> };

const endpoint = process.env.NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT;
const sessionKey = 'qonsul.analytics.session.v1';

function id(): string { return crypto.randomUUID(); }
function path(): string { return window.location.pathname; }
function referrerHost(): string | undefined { try { return document.referrer ? new URL(document.referrer).hostname : undefined; } catch { return undefined; } }
function attribution(): Record<string, string> | undefined {
  const values = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].flatMap(key => {
    const value = new URLSearchParams(window.location.search).get(key);
    return value ? [[key, value.slice(0, 100)]] : [];
  }));
  return Object.keys(values).length ? values : undefined;
}

function send(sessionId: string, pageViewId: string, events: AnalyticsEvent[]): void {
  if (!endpoint || events.length === 0) return;
  const body = JSON.stringify({ schema_version: 1, session_id: sessionId, page_view_id: pageViewId, events });
  try {
    if (navigator.sendBeacon) { navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' })); return; }
    void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'omit' });
  } catch { /* Analytics must never affect the website experience. */ }
}

export function AnalyticsClient(): null {
  useEffect(() => {
    let enabled = false;
    let sessionId = sessionStorage.getItem(sessionKey) || id();
    let pageViewId = id();
    let activeSince = 0;
    let accumulated = 0;
    const thresholds = new Set<number>();
    const event = (name: EventName, data: Record<string, unknown>): AnalyticsEvent => ({ event_id: id(), name, occurred_at: new Date().toISOString(), data });
    const flush = () => {
      if (!enabled) return;
      if (activeSince) { accumulated += Date.now() - activeSince; activeSince = 0; }
      if (accumulated > 0) { send(sessionId, pageViewId, [event('engagement_update', { active_duration_ms: Math.min(accumulated, 300000) })]); accumulated = 0; }
    };
    const start = () => {
      if (enabled) return;
      enabled = true; sessionStorage.setItem(sessionKey, sessionId); activeSince = document.visibilityState === 'visible' ? Date.now() : 0;
      const referrer = referrerHost();
      const touch = attribution();
      const base = { path: path(), ...(referrer ? { referrer_host: referrer } : {}) };
      send(sessionId, pageViewId, [event('session_start', { ...base, ...(touch ? { attribution: touch } : {}) }), event('page_view', base)]);
    };
    const onConsent = (input: Event) => { if ((input as CustomEvent<{ granted?: boolean }>).detail?.granted === true) start(); };
    const onVisibility = () => { if (!enabled) return; if (document.visibilityState === 'hidden') flush(); else activeSince = Date.now(); };
    const onScroll = () => {
      if (!enabled) return;
      const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.round((window.scrollY / maximum) * 100);
      for (const threshold of [25, 50, 75, 100]) if (progress >= threshold && !thresholds.has(threshold)) { thresholds.add(threshold); send(sessionId, pageViewId, [event('scroll_depth', { threshold })]); }
    };
    const onClick = (input: MouseEvent) => {
      if (!enabled) return;
      const target = (input.target as Element | null)?.closest<HTMLElement>('[data-analytics-cta]');
      const ctaId = target?.dataset.analyticsCta; const placement = target?.dataset.analyticsPlacement;
      if (ctaId && placement) send(sessionId, pageViewId, [event('cta_click', { cta_id: ctaId, placement, path: path() })]);
    };
    window.addEventListener('qonsul:analytics-consent', onConsent);
    document.addEventListener('visibilitychange', onVisibility); window.addEventListener('pagehide', flush); window.addEventListener('pageshow', () => { if (enabled && document.visibilityState === 'visible') activeSince = Date.now(); }); window.addEventListener('scroll', onScroll, { passive: true }); document.addEventListener('click', onClick);
    return () => { flush(); window.removeEventListener('qonsul:analytics-consent', onConsent); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', flush); window.removeEventListener('scroll', onScroll); document.removeEventListener('click', onClick); };
  }, []);

  return null;
}
