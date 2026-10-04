import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requiredCompany } from '../lib/required-company.ts';

for (const value of [undefined, null, '', '   ', 'x'.repeat(151)]) {
  assert.throws(() => requiredCompany(value), /Bitte geben Sie Ihr Unternehmen an\./);
}
assert.equal(requiredCompany('  Fiktives Testunternehmen  '), 'Fiktives Testunternehmen');

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [ui, diagnosticRoute, contactUi, contactRoute, imprint, privacyPage, privacyText] = await Promise.all([
  read('app/quality-diagnostic-lab.tsx'), read('app/api/diagnostics/route.ts'),
  read('app/contact-dialog.tsx'), read('app/api/contact/route.ts'),
  read('app/impressum/page.tsx'), read('app/datenschutz/page.tsx'),
  read('docs/legal/QONSUL_Datenschutzhinweise_Veroeffentlichungsfassung_2026-10-04.md'),
]);

const consultationForm = ui.match(/\{consultationOpen && <form[\s\S]*?<\/form>\}/)?.[0];
assert.ok(consultationForm, 'the consultation form remains available after saving');
assert.match(consultationForm, /<h3>Persönliche Beratung<\/h3>/);
assert.doesNotMatch(consultationForm, /Optional: Persönliche Beratung|Diese separate Einwilligung|demoConfirmed|fiktive Testdaten/);
assert.match(consultationForm, /<input name="company" required maxLength=\{150\}/, 'the browser blocks an empty company');
assert.match(consultationForm, /name="contactConsent" type="checkbox" required/);
assert.match(consultationForm, /href="\/datenschutz">Datenschutzhinweise<\/a>/);
assert.match(ui, /requiredCompany\(form\.get\('company'\)\)/, 'the browser also blocks whitespace-only company values');
assert.match(ui, /setConsultationNotice\('Ihre Anfrage ist eingegangen\.'\)/);
assert.doesNotMatch(ui, /Wir haben Ihnen eine Bestätigungs-E-Mail gesendet\./);

const diagnosticSave = ui.match(/<form id="diagnostic-save"[\s\S]*?<\/form>/)?.[0];
assert.ok(diagnosticSave);
assert.match(diagnosticSave, /name="demoConfirmed" type="checkbox" required/, 'the Diagnostic save consent remains intact');
const consultationPut = diagnosticRoute.split('export async function PUT(request: Request)')[1];
assert.ok(consultationPut);
assert.doesNotMatch(consultationPut, /demoConfirmed/, 'consultation submission does not require the removed checkbox');
assert.match(consultationPut, /requiredCompany\(body\.company\)/);
assert.match(consultationPut, /Bitte geben Sie Ihr Unternehmen an\.' \}, 400/);
assert.match(consultationPut, /company: \{ name: company \}/, 'a valid company is always sent to Cockpit');
assert.match(diagnosticRoute.split('export async function POST(request: Request)')[1].split('export async function PUT(request: Request)')[0], /body\.demoConfirmed !== true/, 'Diagnostic saving still requires preview test-data confirmation');

assert.match(contactUi, /<label>Unternehmen \*<input name="company" autoComplete="organization" required/);
assert.match(contactRoute, /requiredCompany\(body\.company\)/);
assert.match(imprint, /mailto:info@qonsul\.de/);
assert.match(imprint, /HRB 781990/);
assert.match(imprint, /Bildnachweise/);
assert.doesNotMatch(imprint, /raphael\.zajonz@qonsul\.de|Verbraucherstreitbeilegung|Verbraucherschlichtungsstelle/i);

assert.match(privacyPage, /QONSUL_Datenschutzhinweise_Veroeffentlichungsfassung_2026-10-04\.md\?raw/);
assert.match(privacyText, /E-Mail: info@qonsul\.de/);
assert.doesNotMatch(privacyText, /raphael\.zajonz@qonsul\.de/i);
assert.match(privacyText, /Telefon: \+49 7022 9686-004/);
assert.match(privacyText, /Name, geschäftliche E-Mail-Adresse, Unternehmen und Nachricht/);
assert.match(privacyText, /Erst wenn Sie eine persönliche Beratung anfragen/);
assert.match(privacyText, /Soweit der Versand produktiv aktiviert ist/);
assert.match(privacyText, /Art\. 44 ff\. DSGVO/);

console.log('PASS consultation company requirement, separate consent, neutral acknowledgement, public legal copy, and unchanged Diagnostic save consent');
