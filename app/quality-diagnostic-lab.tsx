'use client';

import { BrandMark } from '@/app/brand';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CATEGORIES, DATA_KINDS, categoryHints, suggestBlindSpots, type Analysis, type BlindSpot, type Category, type Cause, type DataKind } from '@/lib/analysis';
import { DIAGNOSTIC_PROCESSING_CONSENT_VERSION } from '@/lib/diagnostic-contract';
import { CONTACT_PRIVACY_VERSION } from '@/lib/contact';
import { emitAnalyticsHook } from '@/lib/analytics-hooks';
import { currentAnalyticsSessionId } from '@/lib/analytics-session';
import { invalidateDraftSubmissionId, submissionIdForSave, withSavingState } from '@/lib/diagnostic-submission-lifecycle';

const examples = ['Sporadische Ausfälle bei hohen Temperaturen', 'Steigende Ausschussquote in der Fertigung', 'Qualität schwankt zwischen Lieferchargen'];
const initialStatus = { ai: false, productionReady: false };
const diagnosticSaveError = 'Die Analyse konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.';

type DiagnosticResult = { id: string; reference: string; evidenceScore: number; replayed: boolean };

export default function QualityDiagnosticLab({ launch }: { launch?: { problem: string; id: number } }) {
  const [input, setInput] = useState(''), [problem, setProblem] = useState(''), [causes, setCauses] = useState<Cause[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<Cause[]>([]);
  const [blindSpots, setBlindSpots] = useState<BlindSpot[]>([]);
  const [selected, setSelected] = useState<Category>('Produkt'), [draft, setDraft] = useState(''), [availableData, setAvailableData] = useState<DataKind[]>([]);
  const [status, setStatus] = useState(initialStatus), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [saved, setSaved] = useState<DiagnosticResult | null>(null), [consultationOpen, setConsultationOpen] = useState(false), [consultationNotice, setConsultationNotice] = useState('');
  const submissionId = useRef(''), consultationId = useRef(''), aiRequestId = useRef(''), aiRequestInFlight = useRef(false), flowId = useRef(''), completedSteps = useRef(new Set<string>()), causeInput = useRef<HTMLInputElement>(null);
  const analysis: Analysis = { problem, causes, availableData, mode: causes.some(c => c.source === 'ai') ? 'ai' : causes.some(c => c.source === 'rules') ? 'rules' : 'manual' };
  const userCount = causes.filter(cause => cause.source === 'user').length;
  const hypothesisCount = causes.length - userCount;

  function invalidateDraftSubmission() { submissionId.current = invalidateDraftSubmissionId(); aiRequestId.current = ''; }

  useEffect(() => { fetch('/api/status').then(response => response.json() as Promise<typeof initialStatus>).then(setStatus).catch(() => {}); }, []);
  // The launcher is intentionally a one-shot action keyed by its monotonically
  // increasing id; re-running it on state changes would discard user input.
  useEffect(() => {
    if (!launch?.problem) return;
    if (problem) return;
    start(launch.problem);
  // The launch id is deliberately the sole trigger; state changes must not restart an in-progress Diagnostic.
  }, [launch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function step(key: 'problem' | 'causes' | 'report', sequence: number) {
    if (!flowId.current || completedSteps.current.has(key)) return;
    completedSteps.current.add(key);
    emitAnalyticsHook('diagnostic_step_completed', { diagnosticFlowId: flowId.current, stepKey: key, stepSequence: sequence });
  }
  function start(value = input) {
    const next = value.trim();
    if (next.length < 10) return setError('Bitte beschreiben Sie das Problem in mindestens 10 Zeichen.');
    flowId.current = crypto.randomUUID(); completedSteps.current.clear(); invalidateDraftSubmission(); consultationId.current = '';
    emitAnalyticsHook('diagnostic_started', { diagnosticFlowId: flowId.current }); step('problem', 1);
    setInput(next); setProblem(next); setCauses([]); setAiSuggestions([]); setBlindSpots([]); setAvailableData([]); setSaved(null); setConsultationOpen(false); setConsultationNotice(''); setError('');
    setNotice('Ergänzen Sie Ihre Beobachtungen. Vorschläge bleiben prüfbare Hypothesen, bis Ihr Team sie mit Daten bestätigt.');
    setTimeout(() => document.getElementById('analyse')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
  function addCause(event: FormEvent) {
    event.preventDefault(); const text = draft.trim();
    if (text.length < 3) return;
    if (causes.filter(cause => cause.category === selected && cause.source === 'user').length >= 3) return setError('Pro Perspektive sind maximal drei eigene Beobachtungen möglich.');
    invalidateDraftSubmission(); step('causes', 2); setCauses(previous => [...previous, { id: crypto.randomUUID(), category: selected, text, source: 'user' }]); setAiSuggestions([]); setBlindSpots([]); setDraft(''); setSaved(null); setError('');
  }
  function addBlindspots() {
    setBlindSpots(suggestBlindSpots(problem, causes));
    setNotice('Blinde Flecken sind Untersuchungsfragen und keine Ursachen. Formulieren Sie bei Bedarf eine eigene Beobachtung.');
  }
  async function addAIHypotheses(regenerate = false) {
    if (aiRequestInFlight.current) return;
    if (aiSuggestions.length > 0 && !regenerate) return setNotice('Die KI-Analyse wurde gerade bereits ausgeführt. Bitte verwenden Sie die vorhandenen Vorschläge oder erstellen Sie später bewusst neue Vorschläge.');
    if (regenerate) aiRequestId.current = '';
    aiRequestInFlight.current = true;
    setError(''); setNotice('');
    if (!aiRequestId.current) aiRequestId.current = crypto.randomUUID();
    setBusy(true);
    try {
      const response = await fetch('/api/diagnostic-ai-hypotheses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(45000), body: JSON.stringify({
        sourceEventId: aiRequestId.current, problem, causes,
      }) });
      const result = await response.json() as { causes?: Cause[]; error?: string; notice?: string };
      if (!response.ok || !result.causes) throw new Error(result.error || 'KI-Hypothesen konnten nicht ergänzt werden.');
      const supplementalByCategory = new Map<Category, number>(CATEGORIES.map(category => [category, causes.filter(item => item.category === category && item.source !== 'user').length]));
      const accepted = result.causes.filter(candidate => {
        const count = supplementalByCategory.get(candidate.category) || 0;
        if (count >= 2) return false;
        supplementalByCategory.set(candidate.category, count + 1);
        return true;
      });
      if (accepted.length === 0) throw new Error('Für ergänzende Hypothesen ist in den gewählten Perspektiven kein Platz mehr frei.');
      setAiSuggestions(accepted);
      setNotice(result.notice || 'KI-Hypothesen bereit. Bitte einzeln übernehmen oder verwerfen; keine bestätigten Ursachen.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Die KI-Hypothesen konnten nicht ergänzt werden. Ihre eigene Analyse bleibt unverändert nutzbar.'); }
    finally { aiRequestInFlight.current = false; setBusy(false); }
  }
  function acceptAISuggestion(id: string) {
    const suggestion = aiSuggestions.find(item => item.id === id);
    if (!suggestion) return;
    if (causes.filter(item => item.category === suggestion.category && item.source !== 'user').length >= 2) return setError('Pro Perspektive sind maximal zwei ergänzende Hypothesen möglich.');
    invalidateDraftSubmission(); setCauses(previous => [...previous, suggestion]); setAiSuggestions(previous => previous.filter(item => item.id !== id)); setBlindSpots([]); setSaved(null); setError('');
    setNotice('KI-Hypothese übernommen. Sie bleibt eine prüfbare Hypothese und keine bestätigte Ursache.');
  }
  function dismissAISuggestion(id: string) {
    setAiSuggestions(previous => previous.filter(item => item.id !== id));
    setNotice('KI-Hypothese verworfen. Ihre eigene Analyse bleibt unverändert nutzbar.');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    await withSavingState(setBusy, async () => {
      try {
        submissionId.current = submissionIdForSave(submissionId.current, () => crypto.randomUUID());
        const form = new FormData(event.currentTarget);
        const response = await fetch('/api/diagnostics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000), body: JSON.stringify({
          submissionId: submissionId.current, analysis, diagnosticConsent: form.get('diagnosticConsent') === 'on', consentVersion: DIAGNOSTIC_PROCESSING_CONSENT_VERSION,
          demoConfirmed: form.get('demoConfirmed') === 'on', website: form.get('website'), analyticsSessionId: currentAnalyticsSessionId(),
        }) });
        const result = await response.json() as { diagnostic?: DiagnosticResult; retryWithNewSubmissionId?: boolean };
        if (result.retryWithNewSubmissionId === true) submissionId.current = '';
        if (!response.ok || !result.diagnostic) throw new Error(diagnosticSaveError);
        step('report', 3); emitAnalyticsHook('diagnostic_completed', { diagnosticFlowId: flowId.current }); setSaved(result.diagnostic);
      } catch { setError(diagnosticSaveError); }
    });
  }
  async function requestConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!saved) return; setBusy(true); setConsultationNotice('');
    if (!consultationId.current) consultationId.current = crypto.randomUUID();
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/diagnostics', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000), body: JSON.stringify({
        consultationId: consultationId.current, diagnosticId: saved.id, name: form.get('name'), email: form.get('email'), company: form.get('company'), website: form.get('website'),
        contactConsent: form.get('contactConsent') === 'on', privacyVersion: CONTACT_PRIVACY_VERSION, demoConfirmed: form.get('demoConfirmed') === 'on',
      }) });
      const result = await response.json() as { error?: string; status?: string };
      if (!response.ok || !result.status) throw new Error(result.error || 'Beratungsanfrage konnte nicht übermittelt werden.');
      setConsultationNotice('Ihre Beratungsanfrage wurde übermittelt.');
    } catch { setConsultationNotice('Die Beratungsanfrage konnte nicht übermittelt werden. Bitte versuchen Sie es erneut.'); } finally { setBusy(false); }
  }

  return <section id="analyse" className="lab" aria-label="QONSUL Quality Diagnostic">
    <div className="lab-top"><div className="lab-title"><span className="lab-mark"><BrandMark /></span><div><strong>QONSUL Quality Diagnostic</strong><span>Vom Problem zu prüfbaren Hypothesen und einer belastbaren Datenbasis.</span></div></div><span className="pill"><span className="live-dot" /> Ohne Anmeldung starten</span></div>
    <div className="steps" aria-label="Diagnostic-Schritte"><span className="active"><b>{problem ? '✓' : '01'}</b> Problem beschreiben</span><i /><span className={problem ? 'active' : ''}><b>{causes.length ? '✓' : '02'}</b> Hypothesen strukturieren</span><i /><span className={saved ? 'active' : ''}><b>{saved ? '✓' : '03'}</b> Diagnostic sichern</span></div>
    {!problem ? <div className="lab-entry"><div className="eyebrow">DAS PROBLEM IST DER ANFANG. NICHT DAS ENDE.</div><h2>Welches Qualitätsproblem möchten Sie verstehen?</h2><p>Beschreiben Sie eine Beobachtung aus Entwicklung, Validierung oder Produktion. Bitte keine vertraulichen Daten eingeben.</p><form noValidate onSubmit={event => { event.preventDefault(); start(); }}><div className="problem-input"><span aria-hidden="true">⌕</span><input value={input} onChange={event => { setInput(event.target.value); if (error) setError(''); }} minLength={10} maxLength={600} required aria-invalid={Boolean(error)} aria-describedby={error ? 'diagnostic-problem-error' : undefined} placeholder="z. B. Bauteile fallen bei der thermischen Validierung sporadisch aus." /><button className="button button-green">Diagnostic starten <span>↗</span></button></div>{error && <p id="diagnostic-problem-error" role="alert" className="error-message">{error}</p>}<div className="examples"><span>Zum Beispiel:</span>{examples.map(example => <button type="button" key={example} onClick={() => start(example)}>{example} <span>↗</span></button>)}</div></form></div> : <div className="active-problem"><div><span className="eyebrow">IHR QUALITÄTSPROBLEM</span><h2>{problem}</h2></div><button className="quiet-button" disabled={busy} onClick={() => { invalidateDraftSubmission(); consultationId.current = ''; flowId.current = ''; completedSteps.current.clear(); setProblem(''); setCauses([]); setAiSuggestions([]); setBlindSpots([]); setAvailableData([]); setSaved(null); }}>Neu beginnen ↺</button></div>}
    {problem && <><div className="board-preview board-active">
      <div className="board-heading"><span><span className="live-dot" /> IHRE URSACHENLANDKARTE</span><span>{userCount} eigene · {hypothesisCount} ergänzte Hypothesen</span></div>
      <div className="fish-layout"><div className="fish-categories">
        <svg className="fish-lines" viewBox="0 0 900 400" preserveAspectRatio="none" aria-hidden="true"><path d="M0 200 H940 M110 20 L230 200 L110 380 M390 20 L510 200 L390 380 M670 20 L790 200 L670 380" fill="none" stroke="var(--diagram-line)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" /></svg>
        {CATEGORIES.map((category, index) => <div className={`cause-category ${selected === category ? 'selected' : ''}`} key={category}>
          <button type="button" className="category-title" disabled={busy} onClick={() => { setSelected(category); causeInput.current?.focus(); }}><span className="category-number">0{index + 1}</span><strong>{category}</strong><span className="category-count">{causes.filter(cause => cause.category === category).length}</span></button>
          <ul className="cause-list">{causes.filter(cause => cause.category === category).map(cause => <li className={`cause cause-${cause.source}`} key={cause.id}><details><summary><span className="cause-source">{cause.source === 'user' ? '●' : '◇'}</span>{cause.text}</summary><div className="cause-details"><span>{cause.source === 'user' ? 'Eigene Beobachtung' : cause.source === 'ai' ? 'KI-Hypothese · von Ihnen übernommen · gezielt prüfen' : 'Ergänzende Hypothese · gezielt prüfen'}</span>{cause.check && <p>{cause.check}</p>}{cause.data && cause.data.length > 0 && <p className="required-data"><b>Benötigte Daten:</b> {cause.data.join(' · ')}</p>}<button type="button" className="quiet-button" disabled={busy} aria-label={`Eintrag aus ${category} entfernen`} onClick={() => { invalidateDraftSubmission(); setCauses(previous => previous.filter(item => item.id !== cause.id)); setAiSuggestions([]); setBlindSpots([]); setSaved(null); }}>Entfernen</button></div></details></li>)}</ul>
          <button type="button" className="add-cause" disabled={busy || causes.filter(cause => cause.category === category && cause.source === 'user').length >= 3} onClick={() => { setSelected(category); causeInput.current?.focus(); }}>+ Eigene Ursache</button>
        </div>)}
      </div><div className="fish-problem"><span>AUSGANGSPUNKT</span><strong>{problem}</strong><small>Hier beginnt die Veränderung.</small></div></div>
      <div className="board-bottom"><span>● Eigene Beobachtungen <span className="separator">+</span> ◇ Ergänzende Hypothesen</span><a href="#methode">Die Methode verstehen ↗</a></div>
    </div>
      <div className="workbench"><form onSubmit={addCause} className="cause-form"><label htmlFor="diagnostic-category">Ihre Perspektive ergänzen</label><div><select id="diagnostic-category" value={selected} onChange={event => setSelected(event.target.value as Category)}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select><input id="diagnostic-cause" ref={causeInput} value={draft} onChange={event => setDraft(event.target.value)} minLength={3} maxLength={220} required placeholder={categoryHints[selected]} aria-label="Eigene Ursache" /><button className="button button-outline">Hinzufügen +</button></div></form><div className="boost-section"><div><strong>Was übersehen wir vielleicht?</strong><p>KI-Hypothesen sind konkrete Analysevorschläge. Blinde Flecken sind dagegen Fragen zu noch unzureichend betrachteten Perspektiven. Bitte keine vertraulichen Daten eingeben.</p></div><div><button type="button" className="button button-green boost-button" disabled={busy} onClick={() => addAIHypotheses()}>{busy ? 'KI-Hypothesen werden erstellt …' : 'KI-Hypothesen ergänzen'}</button>{aiSuggestions.length > 0 && <button type="button" className="button button-outline boost-button" disabled={busy} onClick={() => addAIHypotheses(true)}>Neue KI-Hypothesen erstellen</button>}<button type="button" className="button button-outline boost-button" disabled={busy} onClick={addBlindspots}>Blinde Flecken ergänzen</button></div></div>{aiSuggestions.length > 0 && <section className="ai-suggestions" aria-label="KI-Hypothesen"><strong>KI-Hypothesen</strong><p>KI-Hypothesen sind Analysevorschläge und keine bestätigten Ursachen.</p><ul>{aiSuggestions.map(suggestion => <li key={suggestion.id}><div><b>KI-Hypothese · {suggestion.category}</b><span>{suggestion.text}</span>{suggestion.check && <small>{suggestion.check}</small>}</div><div><button type="button" className="button button-outline" disabled={busy} onClick={() => acceptAISuggestion(suggestion.id)}>Übernehmen</button><button type="button" className="quiet-button" disabled={busy} onClick={() => dismissAISuggestion(suggestion.id)}>Verwerfen</button></div></li>)}</ul></section>}{blindSpots.length > 0 && <section className="blind-spots" aria-label="Blinde Flecken"><strong>Blinde Flecken</strong><p>Diese Fragen sind Untersuchungsperspektiven und keine Ursachen.</p><ul>{blindSpots.map(spot => <li key={spot.id}><div><b>{spot.category}</b><span>{spot.prompt}</span></div><button type="button" className="quiet-button" onClick={() => { setSelected(spot.category); causeInput.current?.focus(); }}>Eigene Beobachtung formulieren</button></li>)}</ul></section>}<div aria-live="polite" className="analysis-notice">{notice}</div><div className="hypothesis-note">◎ Eigene Beobachtungen und KI-/System-Hypothesen bleiben getrennt. Eine Hypothese ist kein bestätigter Grund.</div></div>
      <section className="data-inventory"><span className="eyebrow">DIE DATENGRUNDLAGE</span><h3>Welche Daten stehen bereits zur Verfügung?</h3><p>Es werden keine Dateien hochgeladen und keine Messwerte in der Website verarbeitet.</p><div className="data-options">{DATA_KINDS.map(kind => <label key={kind}><input type="checkbox" checked={availableData.includes(kind)} onChange={event => { invalidateDraftSubmission(); setAvailableData(previous => event.target.checked ? [...previous, kind] : previous.filter(item => item !== kind)); setSaved(null); }} />{kind}</label>)}</div></section>
      {causes.length > 0 && !saved && <form className="lead-form diagnostic-content-wrap" onSubmit={save}><div className="lead-heading"><h3>Diagnostic sicher speichern</h3><p>Die Diagnostic wird separat im QONSUL Cockpit angelegt. Ohne Beratungsanfrage werden keine CRM-Kontakte oder Leads erzeugt.</p></div><div className="honey" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div><label className="check-label"><input name="diagnosticConsent" type="checkbox" required onChange={invalidateDraftSubmission} /> <span>Ich willige in die Verarbeitung meiner Diagnostic für die strukturierte Qualitätsanalyse ein. <a href="/datenschutz">Datenschutzhinweise</a></span></label>{!status.productionReady && <label className="check-label"><input name="demoConfirmed" type="checkbox" required onChange={invalidateDraftSubmission} /><span>Ich verwende ausschließlich fiktive Testdaten für diese private Vorschau.</span></label>}{error && <p role="alert" className="error-message">{error}</p>}<div className="lead-submit"><span>Keine Contact- oder CRM-Erstellung ohne die folgende ausdrückliche Anfrage.</span><button className="button button-green" disabled={busy}>{busy ? 'Diagnostic wird gesichert …' : 'Diagnostic sichern ↗'}</button></div></form>}
      {saved && <div className="lead-content diagnostic-result diagnostic-content-wrap"><div className="save-success" role="status"><span className="success-mark">✓</span><h3>Ihre Quality Diagnostic ist gesichert.</h3><p>Referenz: {saved.reference}. Beobachtungen, Hypothesen und Datenbasis wurden getrennt dokumentiert.</p><button className="button button-outline" type="button" onClick={() => setConsultationOpen(open => !open)}>Persönliche Beratung anfragen ↗</button></div>{consultationOpen && <form className="lead-form" onSubmit={requestConsultation}><div className="lead-heading"><h3>Optional: Persönliche Beratung</h3><p>Diese separate Einwilligung löst erst jetzt die CRM-Zuordnung aus. Kein Newsletter.</p></div><div className="lead-fields"><label>Name<input name="name" required maxLength={100} autoComplete="name" /></label><label>Geschäftliche E-Mail<input name="email" type="email" required maxLength={254} autoComplete="email" /></label><label>Unternehmen<input name="company" maxLength={150} autoComplete="organization" /></label></div><div className="honey" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div><label className="check-label"><input name="contactConsent" type="checkbox" required /> <span>Ich wünsche eine persönliche Beratung zu dieser Quality Diagnostic und stimme der Kontaktaufnahme per E-Mail zu.</span></label>{!status.productionReady && <label className="check-label"><input name="demoConfirmed" type="checkbox" required /><span>Ich verwende ausschließlich fiktive Testdaten für diese private Vorschau.</span></label>}<div className="lead-submit"><span>Die Diagnostic bleibt auch bei einer CRM-Prüfung sicher erhalten.</span><button className="button button-green" disabled={busy}>{busy ? 'Anfrage wird übermittelt …' : 'Beratung anfragen ↗'}</button></div>{consultationNotice && <p role="status" className="crm-notice">{consultationNotice}</p>}</form>}</div>}
    </>}
    <div className="lab-trust"><span>◈ Keine vertraulichen Daten eingeben</span><span>◎ Hypothesen sind keine bestätigten Ursachen</span><span>↧ CRM nur nach separater Einwilligung</span></div>
  </section>;
}
