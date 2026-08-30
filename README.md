# QONSUL · Data · Quality · Risk

Responsive Beratungswebsite mit interaktivem Ishikawa-Board. Eigenständiges Projekt; die benachbarte Mietvertrags-App bleibt unverändert.

## Designquellen

- Bestehendes Logo aus `../mietvertrag-app/public/qonsul-logo.png` bleibt vorläufig erhalten. Der ausdrücklich gewünschte zweite Logoentwurf aus dem Projekt-Chat ist noch nicht als Bild verfügbar; die Chat-Schnittstelle liefert nur Text. Das Originalbild wurde beim Nutzer angefordert.
- Vorläufige Farbbasis #323D4F (im Projekt-Chat genannte QONSUL-Primärfarbe), Navy, kühles Weiß und Stahlblau. Endgültige Farbwerte erst gegen den zweiten Logoentwurf abgleichen. Strukturreferenz https://helsing.ai/: bildfüllender Einstieg, Positionierung, großflächige Kompetenzkapitel, Unternehmen und redaktionelle Inhalte. Keine Helsing-Texte, Marken oder Militärbilder übernommen.
- Inhaltliche Grundlage: Projekt-Chats „Website für QM-Beratung“ und „QONSUL Positionierung und Startplan“. Praxisbeispiele und abstrakte Grafiken sind ausdrücklich illustrativ, keine Kundenreferenzen oder Messdaten. Bild: Jelifer Maniago, https://unsplash.com/photos/a-machine-that-is-cutting-a-piece-of-metal-O5rSp_U-Pa0 (Unsplash-Lizenz), lokal bereitgestellt; keine externe Bildanfrage durch Besucher.

## Stack und Funktionen

Next.js App Router auf dem durch Sites erzeugten Vinext/Vite-Runtime, React 19, TypeScript, Tailwind 4, Cloudflare Workers, D1 mit Drizzle-Migrationen. Eine Migration erzeugt Reports, kurzlebige Rate-Limit-Zähler und optionale aggregierte Trends.

- Quality Diagnostic mit Produkt, Prozess, Material, Mensch, Messung und Umgebung. Start ohne Login oder Speicherung; sechs Kategorien, maximal drei eigene Ursachen je Kategorie; eigene Ursachen bearbeiten/löschen, generierte Vorschläge aufklappen und entfernen.
- OpenAI Responses API mit striktem JSON-Schema, 1–2 Hypothesen/Kategorie und separatem KI-Opt-in. `store:false`; offensichtliche sensible Muster werden entfernt, keine Garantie vollständiger Anonymisierung.
- Ohne Schlüssel sowie bei Fehler/Timeout ausdrücklich gekennzeichneter Regelkatalog, keine vorgetäuschte KI. Externer Aufruf nach 2,5 Sekunden abgebrochen; reale End-to-End-Latenz hängt von Netzwerk, Startzeit und Provider ab, keine 3-Sekunden-Garantie.
- Direktdownload als druckfähige eigenständige HTML-Datei ohne Kontaktabgabe; im Browser auch als PDF druckbar.
- Optionaler dauerhafter Report mit Kontaktformular, getrennten Einwilligungen und 30 Tagen Gültigkeit. Zufälliger Schlüssel im URL-Fragment; Datenbank speichert nur SHA-256-Hash. Zugriff per Authorization-Header, keine öffentliche Liste, no-store.
- Separates CRM-Opt-in: HubSpot-Kontakt nach E-Mail suchen/anlegen und gesamte Analyse als verknüpfte Notiz speichern. Ohne produktive Konfiguration kein externer Versand. Kein E-Mail-Versand implementiert, da der Download-Link die gewünschte Alternative erfüllt.
- Löschung durch Nutzer über persönlichen Report. Schon übermittelte CRM-Anfragen werden nicht automatisch mitgelöscht: transparenter Hinweis, separate Bearbeitung beim Verantwortlichen erforderlich.
- Drei Leistungsseiten und drei Fachartikel; native responsive Navigation und reduzierte Animationen bei entsprechender Systemeinstellung.

## Lokal starten

Node >=22.13, pnpm. `pnpm install`, dann `pnpm dev`.

In dieser Desktop-Umgebung sind Installationsskripte standardmäßig gesperrt. Die vorgefertigten optionalen Binärpakete reichten aus; es wurden keine Build-Skripte freigeschaltet und keine Sicherheitseinstellungen verändert. Der pnpm-Wrapper kann dennoch beim erneuten automatischen Installationscheck abbrechen. In diesem Fall nach abgeschlossener Installation den bereits installierten Befehl `node_modules/.bin/vinext` direkt ausführen, ohne Installationsskripte freizugeben.

Die Vorlage aus `.env.example` als `.dev.vars` übernehmen. Schlüssel bleiben serverseitig und werden nicht eingecheckt. Im Hosting dieselben Werte über Sites setzen. `.openai/hosting.json` enthält nur Projekt-ID und logische Bindings.

Für die lokale D1-Datenbank dieselbe DB-Bindung und State-Verzeichnis wie die Vite-Konfiguration benutzen: `DB`, lokale Platzhalter-ID `00000000-0000-4000-8000-000000000000`, `.wrangler/state`. Migration `drizzle/0000_gigantic_dorian_gray.sql` mit Wrangler lokal ausführen. Hosting wendet die mitgelieferten Migrationen an.

## Prüfen

`node scripts/check-analysis.mjs`, `pnpm typecheck`, `pnpm test:api` bei laufender lokaler Vorschau, `pnpm build`.

Der API-Test verwendet nur fiktive Daten, erlaubt ausschließlich localhost, verweigert produktiven Modus/aktive KI und löscht den eigenen Report. Er prüft Validierung, Origin-Schutz, Größenlimits, Vorschläge, Einwilligung, Persistenz, Wiederholungen, Zugriffsschutz, HTML-Escaping, Löschung, Seiten und Metadaten. Browser-/Screenshot-Tests wurden nicht beauftragt.

## Vor produktiver Freigabe erforderlich

1. Firmenname, Anschrift, Geschäftsführung, HRB und USt-ID sind aus QONSUL-Vorlagen hinterlegt. Geschäftlichen E-Mail-/Telefonkontakt und Datenschutzkontakt in `LEGAL_*`/`PUBLIC_CONTACT_EMAIL` hinterlegen. Rechtliche Texte prüfen lassen; Vorschau-Entwurf ersetzen. Keine Compliance-Zertifizierung wird behauptet.
2. OpenAI-Schlüssel und `OPENAI_MODEL` nur nach Freigabe bereitstellen. DPA, Datenregionen und Anbieterprotokolle prüfen. Der OpenAI-Developers-Plugin/API-Key-Skill ist in dieser Sitzung nicht verfügbar; Schlüssel wurde nicht erstellt.
3. HubSpot Private-App-Zugang mit benötigten Kontakt-/Notizrechten und Berechtigungen zur Suche bereitstellen; zuerst mit fiktivem Kontakt in Sandbox prüfen. Keine Live-CRM-Verbindung wurde getestet.
4. Starkes zufälliges `RATE_LIMIT_SALT` und `MAINTENANCE_SECRET` setzen. Öffentliche Seite erst nach Missbrauchsschutz-Prüfung freigeben; zusätzlicher Bot-Schutz empfohlen.
5. Täglich `POST /api/maintenance` mit `Authorization: Bearer <MAINTENANCE_SECRET>` durch einen freigegebenen Scheduler aufrufen. Es wurde keine Automation ungefragt angelegt. Abgelaufene Reports werden bereits bei Speicherung bereinigt und sind unabhängig vom Scheduler nicht mehr abrufbar.
6. CRM-Retention und Widerrufsprozess festlegen. `needs_review`/`sending` in der Report-Tabelle prüfen: nach unsicherem Timeout bewusst kein automatischer Retry, um doppelte CRM-Notizen zu vermeiden. Über `Interne Referenz` in HubSpot abgleichen und manuell beheben.
7. `PUBLIC_SITE_URL` auf die tatsächliche vertrauenswürdige URL setzen. `PRODUCTION_READY=true` erst nach Abschluss dieser Punkte. Der Schalter erlaubt reale Daten und CRM-Übertragung. Robots bleibt bis zur gezielten SEO-Freigabe auf noindex.

## Primärquellen

- https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc3.htm
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.hubspot.com/docs/api-reference/legacy/crm/activities/notes/guide
- https://asq.org/quality-resources/fmea
- https://asq.org/quality-resources/fishbone
- https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679

## Inhaltliche Überarbeitung 30.08.2026

DORA und Software-QA aus der Hauptpositionierung entfernt. Neue Kompetenzseiten Quality Engineering, Risk Engineering und Quality Analytics. Regel- und KI-Hypothesen nennen konkrete Prüfschritte, passende Qualitätskennzahlen und benötigte Datentypen. Die optionale Dateninventur wird im Report und in der CRM-Notiz mitgespeichert. Sie ist eine Selbstauskunft, kein Daten-Upload, kein Analyseergebnis und kein Evidence Score. Alte Reports behalten beim Lesen ihre ursprünglichen Kategorien. Keine Datenbankmigration erforderlich.
