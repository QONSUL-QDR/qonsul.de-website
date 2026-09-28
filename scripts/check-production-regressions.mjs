import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [privacy, imprint, layout, site, styles, analytics, consent, diagnosticLab, diagnosticAi, reports] = await Promise.all([
  readFile(new URL('../app/datenschutz/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/impressum/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/quality-site.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/globals.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/analytics-client.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/analytics-consent.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/quality-diagnostic-lab.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/diagnostic-ai-hypotheses/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/reports/route.ts', import.meta.url), 'utf8'),
]);

assert.match(privacy, /<h2>3\. Optionale Website-Analyse<\/h2>/);
assert.match(privacy, /keine funktionsfremden Cookies/);
assert.match(privacy, /kein Browser-Fingerprinting/);
assert.match(privacy, /90 Tage als Rohdaten/);
assert.match(privacy, /24 Monate/);
assert.match(imprint, /<h2>Anbieter<\/h2>/);
assert.match(imprint, /<h2>Verbraucherstreitbeilegung<\/h2>/);
assert.match(imprint, /href="\/datenschutz"/);

assert.match(layout, /<AnalyticsClient \/>\{children\}<AnalyticsConsent \/>/);
assert.match(consent, /Optionale Website-Analyse/);
assert.match(consent, /localStorage\.setItem\(ANALYTICS_CONSENT_STORAGE_KEY, next\)/);
assert.match(consent, /Website-Analyse: \{state === 'granted' \? 'aktiv' : 'deaktiviert'\}/);
assert.match(analytics, /analyticsConsentGranted\(window\.localStorage\.getItem/);
assert.match(analytics, /credentials: 'omit'/);
assert.doesNotMatch(analytics, /contact_message|problem_statement|cause_text/);

assert.match(site, /<a href="\/impressum">Impressum<\/a><a href="\/datenschutz">Datenschutz<\/a>/);
assert.match(site, /<section className="bottom-cta" id="kontakt"><div className="section-wrap">/);
assert.match(styles, /\.bottom-cta\{padding:90px 0\}/);
assert.match(styles, /\.bottom-cta\{padding:65px 0\}/);
assert.match(styles, /\.analytics-consent\{position:fixed;z-index:90;right:20px;bottom:20px/);
assert.match(styles, /\.analytics-consent-status\{position:fixed;z-index:90;right:20px;bottom:20px/);
assert.match(diagnosticLab, /export default function QualityDiagnosticLab/);
assert.match(diagnosticAi, /requestPublicAIHypotheses/);
assert.match(reports, /now\+30\*86400000/);
assert.match(reports, /crmConsent=body\.crmConsent===true/);

console.log('PASS production legal routes, floating consent widget, Quality Diagnostic, AI, thirty-day report, CRM handoff, and responsive CTA grid anchoring');
