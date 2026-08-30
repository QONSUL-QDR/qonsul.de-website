export const CATEGORIES = ['Codebase', 'Process', 'Environment', 'Data', 'People', 'Tooling'] as const;
export type Category = typeof CATEGORIES[number];
export type Source = 'user' | 'ai' | 'rules';
export type Cause = { id: string; category: Category; text: string; source: Source; check?: string; metric?: string };
export type Analysis = { problem: string; causes: Cause[]; mode: 'manual' | 'ai' | 'rules' };
export const METRICS = ['Change fail rate', 'Change lead time', 'Deployment frequency', 'Failed deployment recovery time', 'Deployment rework rate'] as const;
export const CONSENT_VERSION = '2026-08-30-v1';
export const categoryHints: Record<Category, string> = {
  Codebase: 'z. B. Ungetestete Service-Abhängigkeiten', Process: 'z. B. Manuelle Freigaben verzögern Releases', Environment: 'z. B. Staging weicht von Produktion ab', Data: 'z. B. Testdaten bilden Randfälle nicht ab', People: 'z. B. Unklare Ownership für fehlgeschlagene Tests', Tooling: 'z. B. Fehlerhafte Tests werden automatisch wiederholt',
};
type Rule = [string, string, typeof METRICS[number]];
const rules: Record<Category, Rule[]> = {
  Codebase: [ ['Service-Verträge sind nicht durch Contract-Tests abgesichert.', 'Einen betroffenen API-Vertrag mit Consumer- und Provider-Tests prüfen.', 'Change fail rate'], ['Zeit- und Reihenfolgeabhängigkeiten machen Tests instabil.', 'Verdächtige Tests isoliert, parallel und mit zufälliger Reihenfolge ausführen.', 'Change lead time'], ['Große Changes erschweren die Eingrenzung von Fehlern.', 'Change-Größe und Review-Wartezeit der letzten zehn Releases vergleichen.', 'Change lead time'] ],
  Process: [ ['Ein grüner Build prüft nicht alle kritischen Nutzerpfade.', 'Quality Gates mit den drei geschäftskritischsten Journeys abgleichen.', 'Change fail rate'], ['Retries verdecken Fehler statt eine Ursachenklärung auszulösen.', 'Erstversuch-Erfolgsrate getrennt von der finalen Pipeline-Erfolgsrate messen.', 'Deployment rework rate'], ['Freigaben bündeln kleine Änderungen zu großen Release-Paketen.', 'Wartezeiten zwischen Commit, Review und Deployment sichtbar machen.', 'Deployment frequency'] ],
  Environment: [ ['Konfiguration und Abhängigkeiten weichen zwischen Umgebungen ab.', 'Runtime-Versionen, Feature Flags und Infrastruktur deklarativ vergleichen.', 'Change fail rate'], ['Gemeinsam genutzte Runner erzeugen Ressourcen- und Timing-Konflikte.', 'Laufzeiten und Fehlerraten nach Runner-Auslastung segmentieren.', 'Change lead time'], ['Rollback und Wiederanlauf sind nicht unter realen Bedingungen erprobt.', 'Ein fehlgeschlagenes Deployment in einer isolierten Umgebung simulieren.', 'Failed deployment recovery time'] ],
  Data: [ ['Synthetische Testdaten decken Randfälle und Verteilungen nicht ab.', 'Grenzwerte, Nullwerte und Datenvolumen in kritischen Tests ergänzen.', 'Change fail rate'], ['Parallele Tests verändern denselben Datenbestand.', 'Daten pro Testlauf isolieren und Bereinigung bei Abbruch prüfen.', 'Change lead time'], ['Fehler und Deployments werden in der Messung nicht verknüpft.', 'Einheitliche Release-IDs in Deployment- und Incident-Ereignissen prüfen.', 'Deployment rework rate'] ],
  People: [ ['Für Fehler zwischen Teams fehlt eine eindeutige Ownership.', 'Für einen realen Fehler einen Owner und die beteiligten Teams bestimmen.', 'Failed deployment recovery time'], ['Instabile Tests haben keinen Owner und kein Behebungsziel.', 'Die häufigsten Flaky Tests priorisieren und Verantwortliche benennen.', 'Change lead time'], ['Qualitätswissen konzentriert sich auf einzelne Personen.', 'Explorative Test- und Incident-Reviews gemeinsam durchführen.', 'Deployment frequency'] ],
  Tooling: [ ['Pipeline-Ergebnisse sind nicht mit Produktionsfehlern verbunden.', 'Deployments, Telemetrie und Incident-Tickets über Release-IDs verbinden.', 'Deployment rework rate'], ['Retries und Timeouts maskieren systematische Testprobleme.', 'Retries, Traces und Timeout-Verteilung eines instabilen Tests untersuchen.', 'Change lead time'], ['Die Testsuite liefert spätes Feedback durch unnötige Volltests.', 'Schnelle Contract- und Komponententests vor langsame End-to-End-Tests setzen.', 'Deployment frequency'] ],
};
export function suggestRules(problem: string, existing: Cause[] = []): Cause[] {
  const focus = /flaky|instabil|sporad|retry|zufällig|parallel/i.test(problem) ? 1 : /lang|langsam|release-zyk|freigabe|warte/i.test(problem) ? 2 : 0;
  return CATEGORIES.flatMap(category => [rules[category][focus], rules[category][(focus + 1) % 3]].filter(r => !existing.some(c=>c.category===category && c.text.toLowerCase()===r[0].toLowerCase())).map(([text, check, metric], i) => ({ id: `rules-${category}-${focus}-${i}`, category, text, check, metric, source: 'rules' as const })));
}
export function parseAnalysis(value: unknown): Analysis {
  if (!value || typeof value !== 'object') throw new Error('Analyse fehlt.');
  const v = value as Record<string, unknown>;
  if(typeof v.problem !== 'string' || v.problem.trim().length < 10 || v.problem.length > 600) throw new Error('Bitte beschreiben Sie das Problem in 10 bis 600 Zeichen.');
  if(!Array.isArray(v.causes) || v.causes.length > 30) throw new Error('Zu viele Ursachen.');
  const causes = v.causes.map((item: unknown, i): Cause => {
    if(!item || typeof item!=='object') throw new Error('Ungültige Ursache.');
    const c = item as Record<string, unknown>;
    if(!CATEGORIES.includes(c.category as Category) || typeof c.text!=='string' || c.text.trim().length < 3 || c.text.length > 220 || !['user','ai','rules'].includes(String(c.source))) throw new Error('Ungültige Ursache.');
    if(c.check !== undefined && (typeof c.check!=='string' || c.check.length>300)) throw new Error('Ungültiger Prüfschritt.');
    if(c.metric !== undefined && !METRICS.includes(c.metric as typeof METRICS[number])) throw new Error('Ungültige Metrik.');
    return {id:`cause-${i}`,category:c.category as Category,text:c.text.trim(),source:c.source as Source,...(c.check?{check:c.check as string}:{}),...(c.metric?{metric:c.metric as string}:{})};
  });
  if(CATEGORIES.some(category=>causes.filter(c=>c.category===category).length>5 || causes.filter(c=>c.category===category&&c.source==='user').length>3)) throw new Error('Maximal drei eigene und zwei ergänzte Ursachen je Kategorie.');
  return {problem:v.problem.trim(),causes,mode:causes.some(c=>c.source==='ai')?'ai':causes.some(c=>c.source==='rules')?'rules':'manual'};
}
export function redactForAI(value: string) {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[E-Mail entfernt]').replace(/https?:\/\/\S+/g,'[URL entfernt]').replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[IP entfernt]').replace(/\b(?:sk-|ghp_|github_pat_)[\w-]+/g,'[Zugangsschlüssel entfernt]');
}
