# Konfiguration

Die öffentliche Production-Candidate-Konfiguration liegt versioniert in `lib/production-public-runtime.mjs` (`PRODUCTION_PUBLIC_RUNTIME_V1`). Nur Builds mit `PRODUCTION_ARTIFACT_BUILD=true` binden ihre zehn freigegebenen Werte als Worker-`vars` in `dist/server/wrangler.json` ein. Seal und Verify verlangen die exakte Schlüsselliste und jeden exakten Wert; zusätzliche oder abweichende `vars` brechen ab. Diese Werte werden nicht in Cloudflare, GitHub-Environment-Variablen oder `.env` gesetzt.

Lokale und Sites-Vorschau behalten ihre bisherige Laufzeitkonfiguration. Lokal erzeugt `pnpm setup:local` die ignorierte `.dev.vars`; vorhandene Werte bleiben erhalten. Die `.env.example` dokumentiert lokale Schlüssel. Echte Secrets wie `QONSUL_COCKPIT_INTAKE_SECRET`, `RESEND_API_KEY`, `RATE_LIMIT_SALT` und `MAINTENANCE_SECRET` bleiben außerhalb von Git und werden separat je Zielumgebung verwaltet. CI benötigt keine Produktivgeheimnisse.

| Schlüssel | Zweck |
| --- | --- |
| `PRODUCTION_READY` | Vorschau false; im versiegelten Production-Candidate freigegebenes `true` |
| `PUBLIC_SITE_URL` | Vertrauenswürdige Basis-URL; lokal http://localhost:3000 |
| `OPENAI_API_KEY` | Optionales serverseitiges KI-Geheimnis |
| `OPENAI_MODEL` | Ausgangsstand gpt-4.1-mini |
| `QONSUL_COCKPIT_INTAKE_URL` | Basis-URL des autorisierten Cockpit-Intake; lokal nur HTTPS oder ein lokaler Mock auf `localhost`/`127.0.0.1` |
| `QONSUL_COCKPIT_INTAKE_SECRET` | Mindestens 32 Zeichen langes HMAC-Secret für Diagnostic-, Consultation- und KI-Intake; niemals committen oder ausgeben |
| `STAGING_AI_INTAKE_TRACE` | Optional `true` für nicht-sensitive Staging-Diagnosemetadaten; lokal und standardmäßig `false` |
| `HUBSPOT_ACCESS_TOKEN` | Kontakt-/Notiz- und Suchzugriff |
| `RESEND_API_KEY` | E-Mail-Versand |
| `CONTACT_FROM_EMAIL` | Beim Anbieter verifizierter Absender |
| `PUBLIC_CONTACT_EMAIL` | Öffentliche Empfängeradresse; im Production-Candidate `info@qonsul.de` |
| `CONTACT_RETENTION_DAYS` | Standard 90 |
| `RATE_LIMIT_SALT` | Zufälliges serverseitiges Geheimnis |
| `MAINTENANCE_SECRET` | Separates Zufallsgeheimnis für Wartung |
| `LEGAL_ENTITY_NAME`, `LEGAL_ADDRESS` | Vollständige Firma / Geschäftsanschrift |
| `LEGAL_REPRESENTATIVE`, `LEGAL_PHONE` | Vertretung / Geschäftskontakt |
| `LEGAL_REGISTER`, `LEGAL_VAT_ID` | Registerangabe / USt-ID |
| `LEGAL_EDITORIAL_RESPONSIBLE` | Redaktionell Verantwortlicher, sofern erforderlich |
| `LEGAL_DISPUTE_RESOLUTION` | Geprüfte Streitbeilegungsangabe |

## Ausgangsstand

Die bestehende Vorschau verwendet Runtime-Revision 5. Firmenangaben, Empfängeradresse, Basis-URL, Frist, Modell und die beiden Sicherheitsschlüssel sind dort hinterlegt. Für OpenAI, HubSpot und Resend sind bei Übergabe **keine produktiven API-Zugänge konfiguriert**. `PRODUCTION_READY=false`.

Konfiguration nur gelesen, nicht verändert. Geheimnisse werden nicht nach GitHub kopiert. Für neues Hosting stellt der Betreiber sie über einen Secret Store bereit.

`GET /api/status` gibt Verfügbarkeitsmerkmale und öffentliche Kontaktadresse zurück, keine Schlüssel. `ai` und `diagnosticReady` sind nur dann `true`, wenn `QONSUL_COCKPIT_INTAKE_URL` gültig und `QONSUL_COCKPIT_INTAKE_SECRET` vorhanden ist; `OPENAI_API_KEY` beeinflusst diese beiden Merkmale nicht. Integrationstests verlangen Vorschau ohne aktive externe Zustellung.

## Lokaler Diagnostic-Test

1. `pnpm setup:local` ausführen. Das Skript behält eine vorhandene `.dev.vars` bei und wendet ausschließlich lokale D1-Migrationen an.
2. In der ignorierten `.dev.vars` `QONSUL_COCKPIT_INTAKE_URL` und `QONSUL_COCKPIT_INTAKE_SECRET` aus einer autorisierten lokalen/Staging-Konfiguration setzen. `STAGING_AI_INTAKE_TRACE` bleibt normalerweise `false`.
3. `pnpm dev` starten und `GET /api/status` prüfen: `ai` und `diagnosticReady` müssen `true` sein.
4. Im Quality Diagnostic eine eigene Beobachtung ergänzen, die KI-Hypothesen einmal ausführen, die Diagnostic-Einwilligung aktivieren und speichern. Erst nach erfolgreicher Speicherung darf die separate Consultation-Einwilligung verwendet werden.

Der Diagnostic-POST antwortet fail-closed mit stabilen, nicht-sensitiven Codes: `local_database_unavailable` bei fehlender lokaler D1-Bindung, `diagnostic_intake_not_configured` bei fehlender Intake-Konfiguration, `diagnostic_intake_rejected` bei einer fachlich abgelehnten Cockpit-Anfrage und `diagnostic_saved` bei erfolgreicher Speicherung. Temporäre Intake-Ausfälle verwenden `diagnostic_intake_unavailable`. HMAC, Idempotency-Key und Einwilligungsprüfung bleiben unverändert.
