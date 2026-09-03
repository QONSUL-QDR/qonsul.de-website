# Bilder, Logos und Design

Alle Bilddateien liegen unter `public/`. `assets-manifest.json` enthält Pfad, Größe, SHA-256 und dokumentierte Herkunft; `pnpm check:repository` prüft Vollständigkeit/Integrität.

## Logos

- `qonsul-logo-selected.png`: hochgeladenes Website-Original; `app/brand.tsx` blendet nur transparenten Exportrand im CSS aus.
- `qonsul-logo-pdf.png`: hinterlegtes Drucklogo.
- `lib/qonsul-logo-pdf.ts`: abgeleitetes JPEG als Base64 für synchronen Download ohne weitere Bildanfrage.
- `qonsul-logo-print.jpg`, `qonsul-logo.png`: übernommener Projektbestand; Verweise vor Löschung prüfen.

Nach freigegebenem Logo-Austausch:

```sh
python -m pip install Pillow
python scripts/build-pdf-logo.py
pnpm pdf:sample
pnpm test:pdf
```

PDF rendern/öffnen und Logo, A4, Druckränder, lange Texte, 30 Ursachen, Wasserzeichen und Pfeil prüfen. Logo nicht generativ rekonstruieren. Quelle und Ableitung zusammen versionieren.

## Branchenmotive / Rechte

Zwölf Fotografien, jeweils Desktop/Mobil. Urheber und Quellseiten: `lib/hero-slides.ts`, Inventar und Impressum. Illustrative Branchenmotive, keine QONSUL-Kundenreferenzen. Quellen: Unsplash; Lizenzinformationen: https://unsplash.com/license.

Quellnachweis ersetzt keine Prüfung zusätzlich betroffener Marken-/Persönlichkeitsrechte. Abhängigkeitslizenzen gelten nicht automatisch für Logos/Bilder. Diese Übergabe erklärt keine zusätzliche Open-Source-Lizenz für QONSUL-Material.

`public/og.png` ist die vorhandene Social-Preview-Grafik. Herkunft/Freigabe vor neuer externer Verwendung beim Betreiber bestätigen.

## Gestaltung / Änderungen

Marineblau #012542, mittleres Blau #234F70, Stahlblau #527B99, Silbergrau #718393, kühles Weiß #F4F6F7. Strukturreferenz https://helsing.ai/; keine Texte, Marken oder Militärbilder übernommen.

Bei bewusstem Asset-Wechsel Prüfsumme/Größe des Eintrags neu berechnen, Herkunft ergänzen und im PR begründen. Nicht unbekannte Abweichungen durch pauschales Aktualisieren aller Prüfsummen verdecken.
