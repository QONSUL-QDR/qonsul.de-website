import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [site, diagnosticUi, diagnosticRoute, aiRoute, aiStatusRoute, consent, styles] = await Promise.all([
  read('app/quality-site.tsx'),
  read('app/quality-diagnostic-lab.tsx'),
  read('app/api/diagnostics/route.ts'),
  read('app/api/diagnostic-ai-hypotheses/route.ts'),
  read('app/api/diagnostic-ai-hypotheses/status/route.ts'),
  read('app/analytics-consent.tsx'),
  read('app/globals.css'),
]);

assert.match(site, /import QualityDiagnosticLab from '\.\/quality-diagnostic-lab'/);
assert.match(site, /<QualityDiagnosticLab launch=\{launch\}\/>/);
assert.doesNotMatch(site, /IshikawaLab|analytics-consent-slot/);

assert.match(diagnosticRoute, /export async function POST\(request: Request\)/);
assert.match(diagnosticRoute, /deliverDiagnostic\(/);
assert.match(aiRoute, /requestPublicAIHypotheses\(/);
assert.match(aiStatusRoute, /requestPublicAIHypothesesStatus\(/);
assert.match(diagnosticUi, /fetch\('\/api\/diagnostic-ai-hypotheses'/);
assert.match(diagnosticUi, /fetch\('\/api\/diagnostic-ai-hypotheses\/status'/);
assert.match(diagnosticUi, /fetch\('\/api\/diagnostics', \{ method: 'POST'/);

assert.match(diagnosticRoute, /export async function PUT\(request: Request\)/);
assert.match(diagnosticRoute, /requestDiagnosticConsultation\(/);
assert.match(diagnosticUi, /onSubmit=\{requestConsultation\}/);
assert.match(diagnosticUi, /name="diagnosticConsent"/);
assert.match(diagnosticUi, /name="contactConsent"/);

assert.match(styles, /\.analytics-consent\{position:fixed;/);
assert.match(styles, /\.analytics-consent-status\{position:fixed;/);
assert.doesNotMatch(styles, /\.analytics-consent-slot\{/);
assert.doesNotMatch(consent, /createPortal|footerSlot|getElementById\(['"]analytics-consent-slot/);

assert.doesNotMatch(diagnosticUi, /\/api\/reports|30 Tage|reportToken|storageConsent|crmConsent/);

console.log('PASS restored visible Quality Diagnostic, AI routes, consultation handoff, fixed analytics consent, and explicit 30-day report exclusion');
