# Konfiguration

Alle Schlüssel ohne Geheimnisse stehen in `.env.example`. Lokal erzeugt `pnpm setup:local` die ignorierte `.dev.vars`; vorhandene Werte bleiben erhalten. Im Hosting nur über Sites-Runtime-Einstellungen pflegen. CI benötigt keine Produktivgeheimnisse.

| Schlüssel | Zweck |
| --- | --- |
| `PRODUCTION_READY` | Standard false; true erst nach Freigabe |
| `PUBLIC_SITE_URL` | Vertrauenswürdige Basis-URL; lokal http://localhost:3000 |
| `OPENAI_API_KEY` | Optionales serverseitiges KI-Geheimnis |
| `OPENAI_MODEL` | Ausgangsstand gpt-4.1-mini |
| `QONSUL_COCKPIT_INTAKE_URL` | Server-seitige Basis-URL des QONSUL Cockpits |
| `QONSUL_COCKPIT_INTAKE_SECRET` | Server-seitiges HMAC-Secret; niemals als `NEXT_PUBLIC_*` setzen |
| `RESEND_API_KEY` | E-Mail-Versand |
| `CONTACT_FROM_EMAIL` | Beim Anbieter verifizierter Absender |
| `PUBLIC_CONTACT_EMAIL` | Empfänger; vorgesehen info@qonsul.de |
| `CONTACT_RETENTION_DAYS` | Standard 90 |
| `RATE_LIMIT_SALT` | Zufälliges serverseitiges Geheimnis |
| `MAINTENANCE_SECRET` | Separates Zufallsgeheimnis für Wartung |
| `LEGAL_ENTITY_NAME`, `LEGAL_ADDRESS` | Vollständige Firma / Geschäftsanschrift |
| `LEGAL_REPRESENTATIVE`, `LEGAL_PHONE` | Vertretung / Geschäftskontakt |
| `LEGAL_REGISTER`, `LEGAL_VAT_ID` | Registerangabe / USt-ID |
| `LEGAL_EDITORIAL_RESPONSIBLE` | Redaktionell Verantwortlicher, sofern erforderlich |
| `LEGAL_DISPUTE_RESOLUTION` | Geprüfte Streitbeilegungsangabe |

## Ausgangsstand

Die bestehende Vorschau verwendet Runtime-Revision 5. Firmenangaben, Empfängeradresse, Basis-URL, Frist, Modell und die Sicherheitsschlüssel sind dort hinterlegt. Für OpenAI, QONSUL Cockpit und Resend sind bei Übergabe **keine produktiven API-Zugänge konfiguriert**. `PRODUCTION_READY=false`.

Konfiguration nur gelesen, nicht verändert. Geheimnisse werden nicht nach GitHub kopiert. Für neues Hosting stellt der Betreiber sie über einen Secret Store bereit.

`GET /api/status` gibt Verfügbarkeitsmerkmale und öffentliche Kontaktadresse zurück, keine Schlüssel. Integrationstests verlangen Vorschau ohne aktive externe Zustellung.
