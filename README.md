# QONSUL · Data · Quality · Risk

Vollständige Beratungswebsite mit Ishikawa-Board, A4-PDF, Branchen-Bildfolge, Kontaktformular und optionaler KI-/CRM-Anbindung.

**Status: Anwendungsvorschau, kein freigegebener Betrieb mit echten Kundendaten.** Das GitHub-Repository ist öffentlich. Die Übergabe verändert weder die Zugriffseinstellungen der laufenden Website noch ihre Datenbank.

- Repository: https://github.com/QONSUL-QDR/qonsul.de-website
- Bestehende Vorschau: https://qonsul-quality-lab.raphael-zajonz.chatgpt.site/
- Übernommene Funktionsbasis: Sites-Version 7, Commit `c000366a4412631e5545d6f9a09492a7ce276a92`.
- Initiale GitHub-Version: `v0.1.0`; Produktivfreigabe separat erforderlich.

## Schnellstart

Voraussetzungen: Git, Node.js **24.19.0** (siehe `.nvmrc`) und **pnpm 11.19.0**. Immer das vorhandene Lockfile verwenden. Keine Installationsskripte von Abhängigkeiten freischalten, um Fehler zu umgehen.

```sh
git clone https://github.com/QONSUL-QDR/qonsul.de-website.git
cd qonsul.de-website
pnpm install --frozen-lockfile --ignore-scripts
pnpm setup:local
pnpm dev
```

Die vom Server ausgegebene lokale Adresse öffnen. Unter Windows funktionieren dieselben Befehle in PowerShell; bei blockierter Skriptausführung `pnpm.cmd` verwenden, ohne die Sicherheitsrichtlinie zu ändern.

`setup:local` erstellt eine ignorierte `.dev.vars` mit zufälligen lokalen Sicherheitsschlüsseln und wendet **beide** SQL-Migrationen auf die lokale D1-Datenbank an. Vorhandene Konfiguration wird nicht überschrieben; kein automatischer Reset. Ohne externe Schlüssel funktioniert der gekennzeichnete Regelkatalog. **Ausschließlich fiktive Testdaten verwenden.**

## Prüfen

```sh
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

- `test`: Repository-Hygiene, Asset-Prüfsummen, Analyse-/Reportvalidierung, PDF und synchroner Download.
- `test:integration`: eigener lokaler Server, 48 API-/Seitenprüfungen, danach Beenden. Verweigert aktive KI/CRM/E-Mail-Zustellung.
- `build`: Worker unter `dist/server/index.js`, statische Dateien unter `dist/client`.
- `pdf:sample`: A4-Muster regenerieren. Logo-Werkzeuge siehe [Assets](docs/ASSETS.md).
- GitHub Actions prüft Einrichtung, Tests und Build. **Kein automatischer Produktiv-Deploy.**

## Funktionen

- Industrielle Positionierung: Quality Engineering, Risk Engineering und Quality Analytics; drei Leistungsseiten und drei Fachartikel.
- Zwölf Branchenmotive, acht Sekunden Standzeit, manuelle Auswahl/Pause und reduzierte Bewegung.
- Ishikawa mit Produkt, Prozess, Material, Mensch, Messung und Umgebung; bis zu drei eigene und zwei ergänzte Ursachen je Kategorie.
- Optional OpenAI Responses API; ohne Schlüssel/bei Fehlern Regeln. Hypothesen sind keine bewiesenen Ursachen.
- Direkter PDF-Download ohne Kontaktdaten: eine A4-Seite quer, eingebettetes Drucklogo, sechs dezente Wasserzeichen, Firmenname und Website. Bis zu 30 Einträge; lange Texte mit Auslassungszeichen.
- Gespeicherter vollständiger Report mit getrennten Einwilligungen und 30 Tage gültigem Zugriffsschlüssel.
- Kontaktformular mit Name, E-Mail, optionalem Telefon/Unternehmen und Nachricht. Speicherung in D1; optional HubSpot und E-Mail-Zusammenfassung über Resend.
- Löschung und begrenzte Aufbewahrung; keine Analyse-/Werbetracker.

## Struktur

| Bereich | Zweck |
| --- | --- |
| `app/` | Seiten, Oberfläche und API-Routen |
| `lib/` | Analyse, PDF/HTML, CRM, E-Mail und Inhalte |
| `db/`, `drizzle/` | Schema, SQL-Migrationen und Generator-Metadaten |
| `public/` | Alle Bilder und Logos |
| `scripts/`, `.github/` | Einrichtung, Prüfungen, CI und PR-Vorlage |
| `.openai/hosting.json` | Bestehende Sites-Zuordnung und logische DB-Bindung, keine Geheimnisse |
| `docs/` | Architektur, Konfiguration, Betrieb und Übergabe |

## Weiterarbeiten

[Beiträge](CONTRIBUTING.md) · [Architektur](docs/ARCHITECTURE.md) · [Konfiguration](docs/CONFIGURATION.md) · [Deployment/IONOS](docs/DEPLOYMENT.md) · [Betrieb/Backups](docs/OPERATIONS.md) · [Assets](docs/ASSETS.md) · [Übergabe](docs/HANDOFF.md) · [Änderungen](CHANGELOG.md) · [Sicherheit](SECURITY.md)

Stack: Next.js App Router/React 19 auf Vinext/Vite, Tailwind CSS, Cloudflare Workers und D1. **Kein Laravel-Projekt und kein reines HTML-Paket.** GitHub Pages oder ein gewöhnlicher IONOS-FTP-Webspace ersetzen die benötigte Laufzeit/Datenbank nicht. Ein Git-Clone enthält bewusst keine realen Kundendaten oder Secrets.
