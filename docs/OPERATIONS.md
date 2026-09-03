# Betrieb, Sicherung und Wiederherstellung

## Drei getrennte Ebenen

1. **Code/Assets:** GitHub-Historie und Releases plus unabhängiges Git-Bundle.
2. **Konfiguration:** Betreiber-Secret-Store und dokumentierte Schlüssel; keine Klartext-Secrets im Repository/Release.
3. **D1-Daten:** Separates geschütztes Backup mit Schema und Daten. Source-ZIP/Build enthalten keine Kontakte oder Reports.

Die bestehende D1-Datenbank bleibt unverändert. Ein vollständiger Live-Datenexport wurde beim Quellcode-Transfer **nicht** erstellt. Tabellen-Leseansichten sind kein transaktionskonsistentes Backupverfahren. Vor Hostingumzug ist ein unterstützter vollständiger Export samt Wiederherstellungsprobe erforderlich.

## Code sichern / wiederherstellen

```sh
git fetch --all --tags
git bundle create /sicherer/ort/qonsul-source.bundle --all
git bundle verify /sicherer/ort/qonsul-source.bundle
git clone /sicherer/ort/qonsul-source.bundle qonsul-restore
cd qonsul-restore
pnpm install --frozen-lockfile --ignore-scripts
pnpm setup:local
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Bundle außerhalb des Repositorys verwahren, Datum/Commit/Prüfsumme notieren. Diese Probe erzeugt eine **leere lokale Testdatenbank**, keine Wiederherstellung produktiver Daten/Secrets.

## Lokale Daten

Persistenz: `.wrangler/state`. Vor einer Dateisicherung zugehörige Entwicklungsserver beenden; mögliche SQLite-WAL-/SHM-Dateien beachten. Bevorzugt unterstützten SQLite-/D1-Export verwenden und separat wiederherstellen. Backups personenbezogener Daten verschlüsseln und Zugriff begrenzen.

`setup:local` verwendet Wranglers Migrationsprotokoll und überschreibt keine vorhandene `.dev.vars`. Bei älteren Installationen mit manuell ausgeführtem SQL können Tabellen ohne Einträge in `d1_migrations` existieren. Dann **nicht resetten oder blind Migrationen als erledigt markieren**: Backup, Schema-/Indexvergleich und kontrollierte Übernahme durch einen Entwickler.

## Wartung

- Dependency-/Security-Meldungen prüfen. Kein automatisches Zusammenführen von Dependabot-PRs.
- Täglich geschützten Wartungsendpunkt über freigegebenen Scheduler aufrufen; Secret aus Secret Store, nicht aus eingechecktem Skript.
- CRM/Mail `sending` und `needs_review` über interne Referenz beim Anbieter abgleichen, bevor erneut zugestellt wird.
- Lösch-/Auskunftsanfragen auch in bereits belieferten Drittsystemen bearbeiten. Reportlöschung löscht nicht automatisch HubSpot-Notizen/E-Mails.
- Domain, TLS, Absenderverifikation, Zugangsschlüssel und Betreiberzugriff pflegen.
- Je Veröffentlichung Commit, Build, Migrationen, Konfigurationsrevision, Zugriffsmodus und Rückfallversion dokumentieren.

## Hostingwechsel

Übernahme zuerst isoliert proben: vollständigen Export importieren, Tabellen/Datensätze/Indizes/Ablaufzeiten vergleichen, Zugriffs-/Löschtests durchführen, externe Zustellung auslassen. Final Schreibzugriffe kontrolliert anhalten, konsistent exportieren/importieren und prüfen, erst dann umschalten. Alte Ressourcen erst nach bestätigter Wiederherstellung und Rückfallmöglichkeit entfernen.
