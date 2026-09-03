# Übergabeprotokoll

Stand: 2026-09-03. Ziel: https://github.com/QONSUL-QDR/qonsul.de-website

## Umfang

Quellcode, komplette vorhandene Git-Historie, sämtliche öffentlichen Assets, PDF-Muster, Lockfile, Schema, beide SQL-Migrationen, Konfigurationsvorlage und Entwickler-/Betriebsdokumentation.

Basis: erfolgreich veröffentlichte **Sites-Version 7**, Commit `c000366a4412631e5545d6f9a09492a7ce276a92`. Ergänzungen betreffen Einrichtung/Wartbarkeit. Die ursprüngliche Historie bleibt erhalten. Vorher wurde unabhängig ein vollständiges Git-Bundle gesichert; es bleibt außerhalb des öffentlichen Repositorys. Asset-Prüfsummen stehen in `assets-manifest.json`.

## Nicht enthalten

- Reale Kontakt-/Reportdaten, SQLite-Dateien und Logs.
- `.dev.vars`, produktive API-/Wartungsschlüssel, Hosting-/Domain-Zugänge.
- Benachbarte Projekte, insbesondere keine Laravel-Cockpit-Anwendung.

Website, Runtime-Revision 5, DB-Bindung `DB` und Tabellen `reports`, `contact_requests`, `trends`, `rate_limits` bleiben unverändert. Git-Upload ersetzt keinen Live-Datenbankexport.

## Vor Produktivfreigabe noch erforderlich

- [ ] Impressum, Datenschutz, Aufbewahrung und Löschprozess freigeben.
- [ ] OpenAI-Zugang/Datenverarbeitung prüfen, falls KI gewünscht.
- [ ] HubSpot und Resend-Absender/DNS einrichten; fiktive Zustelltests.
- [ ] Empfänger info@qonsul.de und Geschäftskontaktdaten bestätigen.
- [ ] Missbrauchsschutz und öffentliche Zugriffseinstellungen prüfen.
- [ ] Geschütztes vollständiges Live-Backup mit Wiederherstellungsprobe.
- [ ] Wartungsscheduler und Zuständigkeiten.
- [ ] Domain-/Hostingziel und Rückfallplan für qonsul.de.
- [ ] Erst danach PRODUCTION_READY=true und gegebenenfalls SEO-Freigabe.

GitHub-Berechtigungen getrennt von Sites/Providern vergeben. Niemand wurde ungefragt eingeladen. CI ohne Produktivschlüssel; Deployment bleibt bewusst manuell. Branch-Schutz nach erfolgreichem CI-Lauf so einrichten, dass das Team weiterarbeiten kann.
