export const CATEGORIES = ['Produkt', 'Prozess', 'Material', 'Mensch', 'Messung', 'Umgebung'] as const;
export type Category = typeof CATEGORIES[number];
export const DATA_KINDS = ['Anforderungen & FMEA', 'Prüf- & Messdaten', 'Prozessparameter', 'Chargen & Lieferanten', 'Reklamationen & Felddaten', 'Umgebungsdaten', 'Änderungshistorie', 'Prüfmittel & Kalibrierung'] as const;
export type DataKind = typeof DATA_KINDS[number];
export type Source = 'user' | 'ai' | 'rules';
export type Cause = { id: string; category: Category; text: string; source: Source; check?: string; metric?: string; data?: DataKind[] };
export type Analysis = { problem: string; causes: Cause[]; mode: 'manual' | 'ai' | 'rules'; availableData?: DataKind[] };
export const METRICS = ['Ausfallrate', 'Ausschussquote', 'Nacharbeitsquote', 'Anforderungsabdeckung', 'Messsystemstreuung', 'Maßnahmenwirksamkeit'] as const;
export const CONSENT_VERSION = '2026-08-30-v1';
export const categoryHints: Record<Category, string> = {
  Produkt: 'z. B. Toleranzen berücksichtigen thermische Ausdehnung nicht',
  Prozess: 'z. B. Prozessänderungen werden nicht erneut validiert',
  Material: 'z. B. Schwankende Eigenschaften zwischen Lieferchargen',
  Mensch: 'z. B. Unklare Verantwortung für auffällige Prüfergebnisse',
  Messung: 'z. B. Prüfmittel liefern voneinander abweichende Ergebnisse',
  Umgebung: 'z. B. Feuchtigkeit im Einsatz weicht vom Prüfprofil ab',
};
type Rule = [string, string, typeof METRICS[number], DataKind[]];
const rules: Record<Category, Rule[]> = {
  Produkt: [
    ['Die Auslegung könnte kritische Lastfälle oder Toleranzkombinationen unzureichend abdecken.', 'Anforderungen, Toleranzrechnung und Fehlerbilder abgleichen. Den kritischen Lastfall in einem abgegrenzten Versuch prüfen.', 'Anforderungsabdeckung', ['Anforderungen & FMEA', 'Prüf- & Messdaten']],
    ['Temperaturabhängige Bauteileigenschaften könnten die Funktionsreserve verringern.', 'Messwerte über Temperatur und Betriebsdauer auswerten. Den vermuteten Zusammenhang mit einem kontrollierten Temperaturversuch prüfen.', 'Ausfallrate', ['Prüf- & Messdaten', 'Umgebungsdaten']],
    ['Schnittstellen oder Freigabekriterien könnten zwischen Entwicklung und Lieferant unterschiedlich interpretiert werden.', 'Zeichnungsstand, Spezifikationen und Abnahmebefunde gemeinsam vergleichen. Kritische Merkmale eindeutig festlegen.', 'Anforderungsabdeckung', ['Anforderungen & FMEA', 'Chargen & Lieferanten']]
  ],
  Prozess: [
    ['Prozessparameter könnten außerhalb des validierten Arbeitsfensters liegen.', 'Fehler nach Anlage, Parameterstand und Zeitpunkt gruppieren. Unterschiede mit vergleichbaren Gutteilen untersuchen.', 'Ausschussquote', ['Prozessparameter', 'Prüf- & Messdaten']],
    ['Aufwärmphase oder Prozessreihenfolge könnten einen zeitabhängigen Fehler auslösen.', 'Fehlerzeitpunkte mit Prozessverlauf und Anlaufbedingungen abgleichen. Einen Ablauf unter kontrollierten Bedingungen wiederholen.', 'Ausfallrate', ['Prozessparameter', 'Umgebungsdaten']],
    ['Änderungen könnten ohne ausreichende erneute Freigabe in den Prozess gelangt sein.', 'Änderungshistorie und betroffene Chargen abgleichen. Fehlerraten vor und nach der Änderung unter vergleichbaren Bedingungen prüfen.', 'Nacharbeitsquote', ['Änderungshistorie', 'Chargen & Lieferanten']]
  ],
  Material: [
    ['Material- oder Komponenteneigenschaften könnten zwischen Chargen streuen.', 'Fehler- und Gutteile nach Charge und Lieferant vergleichen. Dabei Prozessbedingungen und Stichprobengröße berücksichtigen.', 'Ausfallrate', ['Chargen & Lieferanten', 'Prüf- & Messdaten']],
    ['Alterung, Feuchteaufnahme oder thermische Vorbelastung könnten das Materialverhalten verändern.', 'Lager- und Einsatzbedingungen mit Materialprüfungen verbinden. Gealterte und unbelastete Muster unter gleichen Bedingungen vergleichen.', 'Ausfallrate', ['Chargen & Lieferanten', 'Umgebungsdaten']],
    ['Die Wareneingangsprüfung könnte das später besondere Merkmal nicht erfassen.', 'Prüfplan, Lieferantenspezifikation und Reklamationsbefund abgleichen. Ein geeignetes Prüfmerkmal an Rückstellmustern bewerten.', 'Anforderungsabdeckung', ['Anforderungen & FMEA', 'Reklamationen & Felddaten']]
  ],
  Mensch: [
    ['Unklare Zuständigkeiten könnten die Bearbeitung auffälliger Qualitätsdaten verzögern.', 'Den Weg einer Abweichung vom Befund bis zur Maßnahme nachvollziehen. Verantwortung und Rückmeldung gemeinsam klären.', 'Maßnahmenwirksamkeit', ['Änderungshistorie', 'Reklamationen & Felddaten']],
    ['Unterschiedlich interpretierte Arbeitsanweisungen könnten zu variierenden Abläufen führen.', 'Tätigkeiten mit dem Team beobachten und Anweisungen abgleichen. Unterschiede sachlich erfassen, ohne einzelne Personen zu bewerten.', 'Nacharbeitsquote', ['Prozessparameter', 'Prüf- & Messdaten']],
    ['Erkenntnisse aus Reklamationen könnten nicht in Entwicklung und Lieferantensteuerung zurückfließen.', 'Für einen wiederkehrenden Fehler die Verbindung zwischen Reklamation, FMEA, Prüfplan und umgesetzter Maßnahme prüfen.', 'Maßnahmenwirksamkeit', ['Reklamationen & Felddaten', 'Anforderungen & FMEA']]
  ],
  Messung: [
    ['Messsystemstreuung könnte einen Teil der beobachteten Produktstreuung erklären.', 'Dasselbe Referenzteil wiederholt mit relevanten Prüfmitteln und Bedienpersonen messen. Messsystemeignung vor Prozessbewertung untersuchen.', 'Messsystemstreuung', ['Prüfmittel & Kalibrierung', 'Prüf- & Messdaten']],
    ['Temperaturdrift oder Abtastrate könnten sporadische Abweichungen verzerren oder übersehen.', 'Referenzmessung, Sensorkalibrierung und zeitliche Auflösung vergleichen. Temperaturverlauf synchron zu den Messwerten erfassen.', 'Messsystemstreuung', ['Prüfmittel & Kalibrierung', 'Umgebungsdaten']],
    ['Messdaten könnten durch fehlende Bauteil- und Chargenzuordnung falsch zusammengeführt werden.', 'Eine Stichprobe vom Rohmesswert bis zur Charge rückverfolgen. Einheiten, Zeitstempel und Prüfversionen vereinheitlichen.', 'Maßnahmenwirksamkeit', ['Prüf- & Messdaten', 'Chargen & Lieferanten']]
  ],
  Umgebung: [
    ['Prüfbedingungen könnten relevante Einsatzbedingungen unvollständig abbilden.', 'Prüfprofile mit Temperatur, Feuchte, Vibration und Belastung im Einsatz vergleichen. Relevante Kombinationen begründet auswählen.', 'Anforderungsabdeckung', ['Umgebungsdaten', 'Reklamationen & Felddaten']],
    ['Wechselwirkungen aus Temperatur, Feuchte oder Vibration könnten sporadische Ausfälle begünstigen.', 'Synchron erfasste Umgebungs- und Fehlerdaten untersuchen. Verdächtige Faktoren anschließend in einem geplanten Versuch variieren.', 'Ausfallrate', ['Umgebungsdaten', 'Prüf- & Messdaten']],
    ['Transport- oder Lagerbedingungen könnten Bauteile vor dem Einsatz belasten.', 'Logistikbedingungen und Verpackung betroffener Chargen prüfen. Referenzteile gezielt vergleichbaren Belastungen aussetzen.', 'Ausfallrate', ['Chargen & Lieferanten', 'Umgebungsdaten']]
  ],
};
export function suggestRules(problem: string, existing: Cause[] = []): Cause[] {
  const focus = /therm|temperatur|sporad|wärme|hitze|feucht|vibration/i.test(problem) ? 1 : /liefer|charge|änder|reklam/i.test(problem) ? 2 : 0;
  return CATEGORIES.flatMap(category => [rules[category][focus], rules[category][(focus + 1) % 3]].filter(r => !existing.some(c=>c.category===category && c.text.toLowerCase()===r[0].toLowerCase())).map(([text, check, metric, data], i) => ({ id: 'rules-'+category+'-'+focus+'-'+i, category, text, check, metric, data, source: 'rules' as const })));
}
function parseData(value:unknown):DataKind[] {
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>DATA_KINDS.length||value.some(d=>!DATA_KINDS.includes(d as DataKind)))throw new Error('Ungültige Datengrundlage.');
  return [...new Set(value)] as DataKind[];
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
    return {id:'cause-'+i,category:c.category as Category,text:c.text.trim(),source:c.source as Source,...(c.check?{check:c.check as string}:{}),...(c.metric?{metric:c.metric as string}:{}),data:parseData(c.data)};
  });
  if(CATEGORIES.some(category=>causes.filter(c=>c.category===category).length>5 || causes.filter(c=>c.category===category&&c.source==='user').length>3 || causes.filter(c=>c.category===category&&c.source!=='user').length>2)) throw new Error('Maximal drei eigene und zwei ergänzte Ursachen je Kategorie.');
  return {problem:v.problem.trim(),causes,availableData:parseData(v.availableData),mode:causes.some(c=>c.source==='ai')?'ai':causes.some(c=>c.source==='rules')?'rules':'manual'};
}
export function redactForAI(value: string) {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[E-Mail entfernt]').replace(/https?:\/\/\S+/g,'[URL entfernt]').replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[IP entfernt]').replace(/\b(?:sk-|ghp_|github_pat_)[\w-]+/g,'[Zugangsschlüssel entfernt]');
}
