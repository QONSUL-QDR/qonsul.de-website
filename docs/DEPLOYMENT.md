# Deployment und Domain

## Bestehenden Betrieb erhalten

Die Vorschau bleibt auf https://qonsul-quality-lab.raphael-zajonz.chatgpt.site/ beim bestehenden Sites-Projekt. Die GitHub-Übergabe löst keinen Umzug, DNS-Wechsel oder Datenbankeingriff aus. GitHub ist die Quelle für Weiterentwicklung/Reviews; ein Merge veröffentlicht nicht automatisch.

## Veröffentlichung über Sites

1. Betreiberzugriff auf bestehendes Sites-Projekt und zugehöriges Source-Repository sicherstellen.
2. Freigegebenen GitHub-Commit auschecken, Lockfile verwenden, prüfen und bauen.
3. Exakt diesen Stand mit kurzlebigem Zugriff in das Sites-Source-Repository übertragen; keine Credentials in Remote-URLs speichern.
4. Worker mit `dist/server/index.js`, `dist/client`, Hosting-Metadaten und Migrationen über das Sites-Paketwerkzeug paketieren.
5. Version mit exakt diesem Commit/Build speichern. Zugriffsmodus prüfen; öffentliche Freigabe separat.
6. Veröffentlichen und prüfen. GitHub-Commit, Sites-Version und Runtime-Revision protokollieren.
7. Bei Fehlern letzte bestätigte Version wieder veröffentlichen. Code-Rollback setzt Datenbankänderungen nicht zurück.

Zuordnung in `.openai/hosting.json` erhalten. Kein neues Site-Projekt als Reparatur anlegen.

## Eigenständige Cloudflare-Testumgebung (losgelöst von Sites)

Für einen vom Sites-Projekt unabhängigen Cloudflare-Account (eigene Testumgebung, später eigenständiges Produktivziel) baut `@cloudflare/vite-plugin` bei jedem `pnpm build` automatisch eine vollständige, deploybare `dist/server/wrangler.json`. Ein zusätzliches Wrangler-Konfigurationsfile im Repository-Root ist dafür nicht nötig.

Die D1-Bindung ist standardmäßig weiterhin auf die lokale Sites-Platzhalter-ID gesetzt (`.openai/hosting.json` bleibt unverändert, siehe oben). Für einen eigenständigen Build zwei Umgebungsvariablen vor `pnpm build` setzen:

```sh
export CF_D1_DATABASE_ID="<uuid aus: wrangler d1 create qonsul-website-d1>"
export CF_D1_DATABASE_NAME="qonsul-website-d1"   # optional, sonst dieser Standardwert
pnpm build
```

Danach in `dist/server` deployen, z. B.:

```sh
cd dist/server
CLOUDFLARE_ACCOUNT_ID="<Account-ID>" npx wrangler deploy --dry-run   # erst prüfen
CLOUDFLARE_ACCOUNT_ID="<Account-ID>" npx wrangler deploy
```

Secrets (`OPENAI_API_KEY`, `HUBSPOT_ACCESS_TOKEN`, `RESEND_API_KEY`, `MAINTENANCE_SECRET`, `RATE_LIMIT_SALT`, `LEGAL_*` usw.) separat je Umgebung über `wrangler secret put <NAME>` bzw. das Cloudflare-Dashboard setzen, nicht im Repository. Migrationen (`drizzle/0000_*.sql`, `drizzle/0001_*.sql`) auf die neue Datenbank anwenden, bevor der Worker sie anspricht. Dieser Pfad betrifft ausschließlich einen zusätzlichen, eigenständigen Cloudflare-Account/Worker — die bestehende Sites-Vorschau und `.openai/hosting.json` bleiben davon unberührt.

### Secrets-Checkliste (Testumgebung)

Alle Namen aus `.env.example`, einzeln per `wrangler secret put <NAME>` gesetzt (nicht `--remote`-Bulk, kein Klartext im Repository):

- [ ] `OPENAI_API_KEY` (optional — ohne Schlüssel laufen nur die regelbasierten Vorschläge)
- [ ] `HUBSPOT_ACCESS_TOKEN`
- [ ] `RESEND_API_KEY`
- [ ] `CONTACT_FROM_EMAIL`
- [ ] `RATE_LIMIT_SALT` (zufällig, nicht wiederverwendet aus lokaler `.dev.vars`)
- [ ] `MAINTENANCE_SECRET` (zufällig, separat vom Sites-Wert)
- [ ] `PUBLIC_CONTACT_EMAIL`, `PUBLIC_SITE_URL`
- [ ] `LEGAL_ENTITY_NAME`, `LEGAL_ADDRESS`, `LEGAL_REPRESENTATIVE`, `LEGAL_PHONE`, `LEGAL_REGISTER`, `LEGAL_VAT_ID`, `LEGAL_EDITORIAL_RESPONSIBLE`, `LEGAL_DISPUTE_RESOLUTION`
- [ ] `PRODUCTION_READY` bleibt `false`, bis Issue #6 vollständig abgehakt ist

Nach dem Setzen: `wrangler secret list` gegen den Worker der Testumgebung prüfen, ob alle erwarteten Namen vorhanden sind (Werte werden nie angezeigt).

### Wiederherstellungstest (D1-Backup)

`scripts/d1-backup-restore-check.sh` (`pnpm d1:backup-restore-check`) exportiert die D1-Datenbank der Testumgebung, spielt den Export in eine wegwerfbare Restore-Prüf-Datenbank ein, vergleicht Zeilenzahlen je Tabelle und löscht die Prüf-Datenbank danach automatisch wieder. Rührt die Quelldatenbank selbst nicht an.

```sh
export CLOUDFLARE_ACCOUNT_ID="<Account-ID>"
export CLOUDFLARE_API_TOKEN="<Token mit D1: Edit>"
export CF_D1_DATABASE_NAME="qonsul-website-d1"
pnpm d1:backup-restore-check
```

Der Export landet unter `./backups/d1/` (per `.gitignore` von Commits ausgeschlossen) und muss danach an einen gesicherten Ort außerhalb des Repositorys verschoben und verschlüsselt werden, siehe [Betrieb](OPERATIONS.md). Ein Lauf mit "Restore check PASSED" für alle Tabellen erfüllt den entsprechenden Punkt aus Issue #6 für **diese Testumgebung**; das bestehende Sites-Produktivsystem braucht einen eigenen, separaten Exporttest, da es eine andere D1-Instanz ist.

## qonsul.de / IONOS

Die Registrierung bei IONOS kann bleiben. Dieser Quellstand benötigt **Worker-kompatible Laufzeit und D1**; FTP auf gewöhnlichen Webspace oder GitHub Pages reicht nicht.

Domain auf kompatibles Hosting aufschalten oder einen getrennt geplanten Hostingwechsel mit Laufzeit-/Datenbankanpassung durchführen. Klassisches Node/PHP-Hosting erfordert Änderungen an Cloudflare-Bindungen; nicht einfach `next start` oder einen statischen Export verwenden.

Vor DNS-Änderung alle Einträge sichern, besonders MX, SPF, DKIM und DMARC für E-Mail erhalten. Nur bestätigte Website-Zielwerte des ausgewählten Hosters verwenden. Danach HTTPS, beide Hostnamen, Weiterleitungen, Kontakt, Mail und Reports prüfen.

Vor echten Kundendaten: fachliche/rechtliche Freigabe, Provider-Verträge/Zugänge, Zustelltests, Wartung und getestetes Backup. Ein GitHub-Release ist kein Nachweis, dass diese Punkte erledigt sind.
