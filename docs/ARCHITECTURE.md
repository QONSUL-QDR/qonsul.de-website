# Architektur und Datenflüsse

## Laufzeit

Next.js-App-Router-Komponenten laufen über Vinext/Vite auf Cloudflare Workers. Der Sites-Vite-Plugin integriert das bestehende Hosting; der Cloudflare-Vite-Plugin stellt lokal D1 bereit. Persistente Daten liegen in D1, nicht im Worker-Dateisystem.

`.openai/hosting.json` verbindet den Stand mit dem bestehenden Projekt und der logischen Bindung `DB`. Reale Ressourcen und Secrets stehen nicht darin. Keine neue Site-Zuordnung als vermeintliche Reparatur erzeugen.

## Abläufe

1. Browser sammelt Problem/Ursachen. Der PDF-Download wird lokal mit eingebettetem Logo erzeugt; keine Kontaktabgabe erforderlich.
2. `POST /api/analyze` validiert/begrenzt Anfragen. Optional OpenAI mit getrenntem Opt-in und `store:false`; sonst gekennzeichnete Regeln. Musterbereinigung ist keine garantierte Anonymisierung.
3. `POST /api/reports` speichert vollständige Analyse/Kontakt nur mit Speicher-Einwilligung. CRM/Trends separat. Zugriffsschlüssel im URL-Fragment, Übertragung zum Lesen/Löschen im Authorization-Header.
4. `POST /api/contact` persistiert vor der optionalen, HMAC-signierten Übermittlung an das QONSUL Cockpit und vor Resend. Statusfelder machen Teilausfälle sichtbar.
5. `POST /api/maintenance` verlangt ein Wartungsgeheimnis. Ablaufgrenzen verhindern Zugriff auch ohne laufenden Scheduler.

| Tabelle | Inhalt / Betrieb |
| --- | --- |
| `reports` | Analyse, Kontakt, Einwilligung, Schlüssel-Hash, CRM-Status; 30 Tage Gültigkeit |
| `contact_requests` | Nachricht, Kontakt, Bestätigung, CRM-/Mail-Status; Standard 90 Tage |
| `trends` | Optionale Kategoriezähler je Quartal, keine Freitexte |
| `rate_limits` | Stundenbezogene pseudonymisierte Zähler, keine rohe IP |

`sending` oder `needs_review` nach Timeout erfordert Abgleich beim Anbieter, keinen blinden Retry.

## Oberfläche und Export

Hauptseite: `app/quality-site.tsx`; Interaktion: `app/ishikawa-lab.tsx`; Farben: `app/globals.css`. `lib/ishikawa-pdf.ts` erzeugt ein Vektor-PDF mit JPEG-Logo. `lib/qonsul-logo-pdf.ts` enthält Bilddaten, kein Geheimnis.

HTML-Report und gespeicherte Analyse erhalten vollständige Texte. Die A4-Ansicht kürzt lange Texte erkennbar. HTML und PDF escapen Nutzereingaben getrennt. Keine echte KI-Leistung behaupten, wenn Regeln aktiv sind.
