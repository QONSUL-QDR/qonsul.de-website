# Weiterentwicklung

1. Schnellstart der README durchführen.
2. Arbeitsbranch anlegen, z. B. `git switch -c feature/kurze-beschreibung`.
3. Kleine, nachvollziehbare Änderungen vornehmen; bestehende Architektur erhalten.
4. Typprüfung, Tests, Integrationstest und Build ausführen.
5. Verhalten, Risiken und Prüfungen im Pull Request beschreiben. Bei PDF-/Darstellungsänderungen die Ausgabe visuell prüfen; nur fiktive Daten.
6. Nach Review zusammenführen. Codefreigabe ist keine Produktiv-Deploy-Freigabe.

## Abhängigkeiten und Datenbank

Node-/pnpm-Versionen und Lockfile verwenden; kein zweites Lockfile anlegen. Updates in eigenen PRs prüfen, Installationsskripte nicht pauschal freigeben.

Schema in `db/schema.ts` ändern und mit `pnpm db:generate` eine **neue** Migration erzeugen. SQL und Metadaten gemeinsam prüfen/versionieren. Ausgelieferte Migrationen nicht umschreiben. Vor destruktiven Änderungen Backup, Wiederherstellungsprobe und Freigabe. Kein Reset und kein Entfernen von `.wrangler/state` als Fehlerbehebung.

Die Kontaktmigration war bereits ausgeliefert. Bei der GitHub-Übergabe wurden ihre fehlenden Generator-Metadaten ergänzt; bestehende SQL-Dateien bleiben unverändert.

## Inhalte, Bilder und Zugänge

Industrielle Qualitäts-, Risiko- und Datenarbeit bleibt die Positionierung. Beispiele nicht als nachgewiesene Kundenergebnisse darstellen. Bei Bildern Quelle, Urheber, Rechteprüfung, Alternativtext und Prüfsumme dokumentieren. Logos nicht generativ rekonstruieren.

GitHub-Zugriff ist von Sites-/Provider-Zugriff getrennt. Produktivschlüssel nur im vorgesehenen Secret Store verwalten. Keine Geheimnisse oder realen Kontakt-/Reportdaten in PRs, Screenshots, Issues oder Protokolle kopieren.
