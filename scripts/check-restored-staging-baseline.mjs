import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [site, diagnosticUi, diagnosticRoute, aiRoute, aiStatusRoute, statusRoute, consent, styles, aiPolling] = await Promise.all([
  read('app/quality-site.tsx'),
  read('app/quality-diagnostic-lab.tsx'),
  read('app/api/diagnostics/route.ts'),
  read('app/api/diagnostic-ai-hypotheses/route.ts'),
  read('app/api/diagnostic-ai-hypotheses/status/route.ts'),
  read('app/api/status/route.ts'),
  read('app/analytics-consent.tsx'),
  read('app/globals.css'),
  read('lib/ai-polling.ts'),
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
assert.match(styles, /\.site-footer \.footer-bottom\{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding-bottom:64px\}/);
assert.match(styles, /\.site-footer \.footer-bottom>div\{grid-column:2;justify-self:center\}/);
assert.match(styles, /@media\(max-width:700px\)\{\.site-footer \.footer-bottom\{grid-template-columns:1fr;padding-bottom:68px\}/);
assert.doesNotMatch(styles, /\.analytics-consent-slot\{/);
assert.doesNotMatch(consent, /createPortal|footerSlot|getElementById\(['"]analytics-consent-slot/);

assert.match(statusRoute, /isCockpitIntakeConfigured/);
assert.match(statusRoute, /QONSUL_COCKPIT_INTAKE_URL/);
assert.match(statusRoute, /QONSUL_COCKPIT_INTAKE_SECRET/);
assert.match(statusRoute, /ai:intakeReady,diagnosticReady:intakeReady/);
assert.doesNotMatch(statusRoute, /OPENAI_API_KEY/);

assert.match(diagnosticUi, /startAIHypothesesRun<Cause>\(\{/);
assert.match(diagnosticUi, /onComplete: result => applyAIHypotheses\(result, analysisRound, sourceEventId, targets\)/);
assert.match(diagnosticUi, /onFail: failAIAnalysis/);
assert.match(aiPolling, /deadlineMs \?\? 90_000/);
assert.match(aiPolling, /if \(active\) schedulePoll\(options\.pollIntervalMs \?\? 2_500\)/);
assert.match(aiPolling, /controller\.abort\(\)/);

assert.doesNotMatch(diagnosticUi, /\/api\/reports|30 Tage|reportToken|storageConsent|crmConsent/);

console.log('PASS restored Diagnostic integration, Cockpit readiness, bounded AI polling, centered footer links, fixed analytics consent, and explicit 30-day report exclusion');
