# Deployment und Domain

## Phase 3c deployment topology

GitHub `QONSUL-QDR/qonsul.de-website` is the source of truth. The Phase-3c integration baseline is `c57001a77e71060847bec0694d6d8a51ca314c58`, and the logical D1 binding remains `DB`.

The standalone Worker `qonsul-quality-engineering` is the current test/staging target. The production target for `qonsul.de` is **not yet defined**. The existing Sites project remains a preview assignment and must not be treated as production merely because a domain mapping exists or is pending. Staging and production require separately verified D1 resources and server-side secrets before any cutover.

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

## qonsul.de / IONOS

Die Registrierung bei IONOS kann bleiben. Dieser Quellstand benötigt **Worker-kompatible Laufzeit und D1**; FTP auf gewöhnlichen Webspace oder GitHub Pages reicht nicht.

Domain auf kompatibles Hosting aufschalten oder einen getrennt geplanten Hostingwechsel mit Laufzeit-/Datenbankanpassung durchführen. Klassisches Node/PHP-Hosting erfordert Änderungen an Cloudflare-Bindungen; nicht einfach `next start` oder einen statischen Export verwenden.

Vor DNS-Änderung alle Einträge sichern, besonders MX, SPF, DKIM und DMARC für E-Mail erhalten. Nur bestätigte Website-Zielwerte des ausgewählten Hosters verwenden. Danach HTTPS, beide Hostnamen, Weiterleitungen, Kontakt, Mail und Reports prüfen.

Vor echten Kundendaten: fachliche/rechtliche Freigabe, Provider-Verträge/Zugänge, Zustelltests, Wartung und getestetes Backup. Ein GitHub-Release ist kein Nachweis, dass diese Punkte erledigt sind.
