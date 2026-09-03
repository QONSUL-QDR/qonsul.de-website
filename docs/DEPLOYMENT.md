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

## qonsul.de / IONOS

Die Registrierung bei IONOS kann bleiben. Dieser Quellstand benötigt **Worker-kompatible Laufzeit und D1**; FTP auf gewöhnlichen Webspace oder GitHub Pages reicht nicht.

Domain auf kompatibles Hosting aufschalten oder einen getrennt geplanten Hostingwechsel mit Laufzeit-/Datenbankanpassung durchführen. Klassisches Node/PHP-Hosting erfordert Änderungen an Cloudflare-Bindungen; nicht einfach `next start` oder einen statischen Export verwenden.

Vor DNS-Änderung alle Einträge sichern, besonders MX, SPF, DKIM und DMARC für E-Mail erhalten. Nur bestätigte Website-Zielwerte des ausgewählten Hosters verwenden. Danach HTTPS, beide Hostnamen, Weiterleitungen, Kontakt, Mail und Reports prüfen.

Vor echten Kundendaten: fachliche/rechtliche Freigabe, Provider-Verträge/Zugänge, Zustelltests, Wartung und getestetes Backup. Ein GitHub-Release ist kein Nachweis, dass diese Punkte erledigt sind.
