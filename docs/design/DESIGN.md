# Krümel – Design

Stand: 20.10.2026 · Version 2 „Persönlich“ · Ersetzt Version 1 „Kachel-Board“.
Barrierefreiheit (N2) gilt unverändert. Umsetzung als Teil von Etappe 2 (Paket E2-4).
Die App heißt **Krümel** (Entscheidung des PO, 20.10.2026). In den Entwürfen und in der App steht bis E2-4 noch „Putzplan“; Abschnitt 9 beschreibt App-Symbol und Figur.

Visuelle Vorlagen in diesem Ordner (Quelltext eines Design-Tools, nicht lauffähig – nur als Referenz für Aufbau, Farben und Größen lesen):

- `entwurf-v2-heute-hell.html` – Startseite „Heute“, hell
- `entwurf-v2-heute-dunkel.html` – Startseite „Heute“, dunkel
- `entwurf-v2-statistik.html` – Seite „Statistik“, hell

Die Dateien `entwurf-mobil-*.html` und `entwurf-pc-hell.html` gehören zu Version 1 und gelten nur noch für die PC-Aufteilung (Seitenleiste links, Inhalt rechts).

## 1. Grundsätze

- Persönlich: Die App begrüßt mit Namen und zeigt zuerst, was für die angemeldete Person ansteht.
- Kooperativ: Statistiken zeigen gemeinsame Leistung und Teamwork, nie eine Rangliste.
- Weiche, große Formen; Violett als Hauptfarbe; im Dark Mode tiefes Blau mit leichtem Leuchten oben.
- Keine Emojis, keine Hoheitszeichen. Verläufe nur als Hintergrundleuchten im Dark Mode.
- Alle Werte als CSS-Variablen (Tokens); Komponenten nutzen nur Tokens.

## 2. Farben

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `--bg` | #F3F2F8 | #0B1022, oben radiales Leuchten #1E2C6B | Seitenhintergrund |
| `--surface` | #FFFFFF | rgba(255,255,255,0.07), Rahmen rgba(255,255,255,0.10) | Karten, Tagesfelder |
| `--text` | #15131F | #F2F3FA | Haupttext |
| `--text-muted` | #5A5670 | #A9B0D0 | Metazeilen, Labels |
| `--control-border` | #8E89A6 | #7C84AA | Abhak-Knopf, gestrichelte Tageskreise |
| `--accent` | #5530D9 | #6A4DF4 | Erledigt-Kreise, Fläche „Gemeinsam“, Statistik-Kachel (Text weiß) |
| `--accent-soft` | #EAE5FB | rgba(106,77,244,0.22) | Hintergrund erledigter Aufgaben |
| `--accent-strong` | #7B5CFF | #6A4DF4 + Leuchten | Plus-Knopf in der Navigation (nur Symbol) |
| `--inverse` | #15131F | #F2F3FA | Navigation (hell), aktiver Tag, aktiver Filter |
| `--on-inverse` | #FFFFFF | #0B1022 | Text auf `--inverse` |
| `--warn-text` | #A03A0E | #FF9A73 | „überfällig seit …“ |
| `--person-a` | #5530D9 | #8B6CFF | Person A in Statistiken |
| `--person-b` | #C2650A | #F2A33A | Person B in Statistiken |

Gemessene Kontraste (Auswahl): Text auf Hintergrund 16,5:1 · Metatext 6,3:1 · Weiß auf Akzent 7,5:1 (hell) / 5,3:1 (dunkel) · Rahmen Abhak-Knopf 3,3:1 · Person B auf Weiß 4,1:1. Glasflächen im Dark Mode vor der Umsetzung gegen den tatsächlichen Hintergrund nachrechnen; die Kontrasttests aus R1 werden um alle neuen Paare erweitert.

Symbolkacheln wie in Version 1 (Blau, Grün, Orange je hell/dunkel).

## 3. Schrift

- Archivo, selbst gehostet, Schnitte 400–900.
- Begrüßung und Seitentitel: 34–36 px, 900, Großbuchstaben per CSS (`text-transform`), Laufweite −0,03 em.
- Abschnittslabels: 13 px, 800, Großbuchstaben, Laufweite 0,06 em, `--text-muted`.
- Aufgabentitel 16 px (700) · Metazeile 13 px · große Zahlen 40–44 px (900).

## 4. Form und Abstände

- Radien: Karten 22–24 px · Symbolkacheln 14 px · Tagesfelder, Filter, Navigation, Abhak-Knöpfe 999 px.
- Seitenrand 16 px mobil; Abstand zwischen Karten 8–12 px.
- Tippflächen mindestens 44 × 44 px.
- Unten genug Abstand, damit die schwebende Navigation keinen Inhalt verdeckt.

## 5. Startseite „Heute“

Reihenfolge von oben:
1. **Kopfzeile:** Avatar mit Initiale (Farbe der Person), Datum, rechts Wochenwahl „‹ KW 43 ›“.
2. **Begrüßung:** tageszeitabhängig „Guten Morgen / Hallo / Guten Abend, {Name}!“.
3. **Zusammenfassung in einem Satz:** „Heute stehen 3 Aufgaben für dich an. Eine davon ist überfällig.“ (Varianten für 0 Aufgaben, alles erledigt usw.).
4. **Deine Woche:** 7 Tagesfelder Mo–So. Erledigter Tag: gefüllter Akzentkreis mit Haken. Heute: invertiert mit „erledigt/gesamt“. Kommende Tage: gestrichelter Kreis mit Anzahl. Freier Tag: „–“. Jedes Feld mit vollständigem `aria-label`; Tipp öffnet den Tag.
5. **Zwei Kacheln:** „Deine Woche x / y“ und „Gemeinsam“ mit Fortschrittsring (Prozent im Ring, Text daneben).
6. **Heute für dich:** Filter „Meine / Alle“, darunter Aufgabenkarten (Symbolkachel, Titel, Metazeile, runder Abhak-Knopf rechts). Überfällige zuerst mit Warnhinweis. Erledigte unten in `--accent-soft`, durchgestrichen, mit Uhrzeit.

Die bisherige Überfällig-Regel aus F6 bleibt erfüllt: Überfällige Aufgaben stehen in „Heute für dich“ ganz oben und sind ohne Scrollen sichtbar (360 × 640 prüfen).

## 6. Seite „Statistik“

- Zeitraum: Woche / Monat / Jahr.
- **Gemeinsam erledigt:** große Zahl, Vergleich zum Vorzeitraum, Serie („4 Wochen in Folge“ = alle fälligen Aufgaben einer Woche erledigt), Balken pro Tag. Diagramm mit `role="img"` und vollständiger Textbeschreibung.
- **Euer Teamwork:** geteilter Balken Person A / Person B mit Namen und Zahlen, darunter „N-mal habt ihr füreinander übernommen“. Keine Rangliste, keine Gewinner-Formulierungen.
- **Am häufigsten erledigt:** Top 3 Aufgaben mit Symbol und Anzahl.
- Gezählt wird pro Aufgabe (ID), nicht pro Titel.

## 7. Navigation

- Mobil: schwebende Leiste unten (16 px Rand, Höhe 68 px, Radius 999 px). Hell `--inverse`, dunkel Glasfläche. Einträge: Heute · Woche · [Plus] · Statistik · Einstellungen. Aktiver Eintrag als helle Pille mit Text, übrige nur Symbol mit `aria-label`.
- Die Seite „Woche“ übernimmt die bisherige Wochenübersicht (Tagesansicht, Blättern); „Aufgaben“ und „Erledigt“ sind von dort und aus den Einstellungen erreichbar.
- PC: Seitenleiste links wie in Version 1, mit denselben Einträgen.

## 8. Bewegung

- Abhaken: kurzer Übergang des Kreises (unter 200 ms); Ring und Zahlen zählen sanft hoch.
- Bei `prefers-reduced-motion: reduce` keine Animationen.

## 9. App-Symbol und Figur „Krümel“

- **Vorlage:** `kruemel-icon.svg` in diesem Ordner: ein goldbrauner, runder Keks-Krümel mit Gesicht und Besen auf einer violetten Kachel (Hintergrund #5530D9, Scheibe dahinter #6A4DF4, Krümel #F2B661 mit Sprenkeln #C98A3A, Kontur und Besenstiel #15131F, Besenborsten #FFD166). Die Farben passen zum Violett der Tokens.
- **Symbolgrößen (E2-4):** Aus der Vorlage entstehen alle Größen mit `npm run icons` wie bisher, auch das maskierbare Symbol (`maskable`) und das Symbol für den Apple-Home-Bildschirm. Bei maskierbaren Symbolen schneidet das Gerät außen zu; Gesicht und Besen müssen in der sicheren Zone liegen (Kreis mit 80 % des Durchmessers, mittig). Passt das nicht, wird der Abstand angepasst (Motiv kleiner in die Kachel setzen), das Motiv selbst bleibt unverändert.
- **Figur in der App (optional, E2-4):** Der Krümel darf auftauchen, z. B. bei „Alles erledigt“ oder auf leeren Seiten. Entweder als Bild mit passendem Alternativtext oder als reiner Schmuck mit `aria-hidden="true"`; nie als einziger Träger einer Information. Keine Bewegung über das Maß aus Abschnitt 8 hinaus.
- **Leitplanke für alle Varianten:** Der Krümel bleibt goldbraun und rund, nie blau und nie zottelig (Abstand zu geschützten Figuren). Neue Posen und Gesichter sind erlaubt, solange diese Gestalt erkennbar bleibt.
