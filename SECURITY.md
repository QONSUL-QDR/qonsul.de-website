# Sicherheit

Sicherheitsprobleme vertraulich an **info@qonsul.de** melden. Keine öffentlichen Issues mit Kundendaten, Zugriffsschlüsseln oder internen Analysen erstellen. Betroffene Version, Auswirkungen und Reproduktion mit fiktiven Daten angeben. Keine aktiven Angriffe oder Lasttests ohne ausdrückliche Betreiberfreigabe.

Vorhandene Maßnahmen: separate Einwilligungen, serverseitige Validierung, begrenzte Payloads, Report-Schlüssel als Hash, keine öffentliche Kontakt-/Reportliste, Ablauf/Löschung, Vorschau-Modus und lokale Tests ohne externe Zustellung. CI erhält nur Leserechte und keine Produktivschlüssel.

Ignore-Regeln und Suche nach auffälligen Schlüsselformaten sind zusätzliche Kontrollen, **keine vollständige Sicherheitsprüfung**. Vor öffentlichem Betrieb sind Missbrauchsschutz, Provider-Konfiguration, Rechtsgrundlagen, Auftragsverarbeitung und Löschprozesse zu prüfen.

Bei einem veröffentlichten Geheimnis zuerst widerrufen/rotieren und betroffene Systeme prüfen. Das Löschen der aktuellen Datei entfernt es nicht aus der Git-Historie.
