# Putzplan – Design

Stand: 19.10.2026 (umgesetzt in Paket R1) · Ersetzt KERN UX (N1). Barrierefreiheit (N2) gilt unverändert und geht bei Widerspruch vor.

Visuelle Vorlagen in diesem Ordner (Quelltext eines Design-Tools, nicht lauffähig – nur als Referenz für Aufbau, Farben und Größen lesen):

- `entwurf-mobil-hell.html` – Wochenübersicht am Handy, hell
- `entwurf-mobil-dunkel.html` – dieselbe Ansicht im Dark Mode
- `entwurf-pc-hell.html` – Wochenübersicht am PC

## 1. Grundsätze

- Stil „Kachel-Board“: klare Kacheln mit großen Radien, kräftige Akzentflächen, viel Weißraum.
- Eine Akzentfarbe (Blau), eine Warnfarbe (Orange). Keine Verläufe, keine Emojis.
- Keine Hoheitszeichen, keine Behördenoptik.
- Alle Werte unten als CSS-Variablen (Design-Tokens) umsetzen; Komponenten verwenden nur Tokens, nie feste Farbwerte.

## 2. Farben

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `--bg` | #EEF1F5 | #0F1115 | Seitenhintergrund |
| `--surface` | #FFFFFF | #1A1D24 | Kacheln, Navigation |
| `--surface-2` | #EEF1F5 | #262A33 | Tagesfelder, Chips, Steuerflächen in Kacheln |
| `--text` | #111318 | #F3F5F8 | Haupttext |
| `--text-muted` | #4A5260 | #9AA3B2 | Metazeilen, Beschriftungen |
| `--control-border` | #7A8494 | #6E7789 | Rahmen des Abhak-Knopfs, der Eingabefelder und Auswahlkreise (Paket R1: dunkler als der erste Entwurf #C9CFD8 / #4A5160, weil Bedienelemente 3:1 zur Umgebung brauchen, WCAG 1.4.11) |
| `--accent` | #1F47D6 | #8FA8FF | Links, aktive Navigation, Fortschritt, Fokusrahmen |
| `--accent-tile` | #1F47D6 | #2B4FE0 | Fläche der Kachel „Stand“ und der Hauptknöpfe |
| `--on-accent-tile` | #FFFFFF | #FFFFFF | Text auf `--accent-tile` |
| `--warn-tile` | #FF6B2C | #FF6B2C | Fläche der Kachel „Überfällig“, Bestätigen beim Löschen |
| `--on-warn-tile` | #111318 | #111318 | Text und Fokusrahmen auf `--warn-tile` |
| `--warn-tile-action` / `--on-warn-tile-action` | #111318 / #FFFFFF | #111318 / #FFFFFF | Knöpfe auf der Kachel „Überfällig“ |
| `--warn-text` | #A03A0E | #FF8A65 | Warnhinweise und Fehlermeldungen als Text |
| `--inverse` | #111318 | #F3F5F8 | Aktiver Filter, aktiver Tag, Hauptknopf mobil, Hinweis „Rückgängig“ |
| `--on-inverse` | #FFFFFF | #0F1115 | Text auf `--inverse` |

Umsetzung: `src/ui/tokens.css`. `src/ui/tokens.test.ts` prüft jede verwendete Kombination in beiden Themes (Text 4,5:1, Bedienelemente und Symbole 3:1).

Symbolkacheln (Hintergrund / Symbolfarbe):

| Ton | Hell | Dunkel |
|---|---|---|
| Blau | #E3E9FF / #1F47D6 | #26304F / #A9BCFF |
| Grün | #DDF3E4 / #17703A | #1E3A2A / #8FE0A8 |
| Orange | #FFE9DC / #9A3A0B | #3D2418 / #FFB08A |

Alle Text-Kombinationen erreichen mindestens 4,5:1. Neue Kombinationen werden vor dem Einsatz geprüft.

Fokus: in beiden Themes deutlich sichtbar, 3 px Umriss in `--accent` mit 2 px Abstand.

## 3. Farbschema-Einstellung (N8)

- Einstellungen → „Darstellung“: Hell / Dunkel / Automatisch.
- Standard: Automatisch (folgt `prefers-color-scheme` des Geräts).
- Gespeichert pro Gerät (wie „Ich bin“), nicht im Export.
- Kein Aufblitzen des falschen Themes beim Laden.

## 4. Schrift

- Archivo, Schnitte 400, 500, 600, 700, 800.
- **Selbst gehostet** (z. B. über ein npm-Paket mit den Schriftdateien). Kein Abruf bei Google Fonts: Das überträgt die IP-Adresse an Google und ist nach DSGVO problematisch.
- Größen: Seitentitel 30 px mobil / 34 px PC (800) · Kacheltitel 19–20 px (800) · Aufgabentitel 16 px (600) · Metazeile 13 px (400) · Kachel-Label 13 px Großbuchstaben, Laufweite 0,06 em (800).

## 5. Form und Abstände

- Radien: Kacheln 22 px · Knöpfe, Symbolkacheln, Abhak-Knopf 14 px · Chips 10–12 px · Pillen 999 px.
- Abstände: Seitenrand 16 px mobil, am PC `clamp(16px, 3vw, 40px)` · zwischen Kacheln 12 px mobil, 16 px PC · Kachel-Innenabstand 16 px mobil, 20 px PC.
- Tippflächen mindestens 44 × 44 px.

## 6. Bausteine

- **Wochenkopf:** Label „KW 43 · 19.–25. OKTOBER“, darunter Titel „Diese Woche“, daneben Knöpfe „Vorherige Woche“ / „Nächste Woche“ (Pfeil-Symbole mit `aria-label`).
- **Filter:** Segment-Schalter „Alle / Nur meine“ mit `aria-pressed`.
- **Heute-Kachel:** je Aufgabe eine Zeile: Symbolkachel 44 px · Titel + Metazeile („Person · Rhythmus“, bei Checklisten „Person · 3 von 5“ plus Fortschrittsbalken) · Abhak-Knopf 44 px rechts. Am PC Checklisten-Einträge direkt in der Zeile abhakbar; „Übernehmen“ als Knopf in der Zeile.
- **Überfällig-Kachel:** dringendste überfällige Aufgabe, darunter „Übernehmen“ (und am PC „Erledigt“). Mehrere überfällige: Hinweis „+ N weitere“ mit Link zur Liste. Keine überfälligen: Kachel entfällt.
- **Stand-Kachel:** „erledigt / fällig“ für die angezeigte Woche (fällig = alle Durchgänge mit Termin in dieser Woche, erledigte eingeschlossen) mit Fortschrittsbalken.
- **Rest der Woche:** mobil 7 Tagesfelder mit Anzahl (Link zum Tag); am PC 7 Spalten mit allen Aufgaben als Chips, in einem waagerecht scrollbaren Bereich, falls der Platz nicht reicht.
- **Navigation:** mobil Leiste unten (Woche, Aufgaben, Erledigt, Einstellungen), am PC Seitenleiste links. „Woche“ nutzt ein Kalender-Symbol.
- **Neue Aufgabe:** mobil schwebender Knopf unten rechts, am PC Knopf im Wochenkopf.
- **Rückgängig:** nach dem Abhaken kurz eine Meldung mit Knopf „Rückgängig“ (`role="status"`).

## 7. Symbole

- Bibliothek: Lucide (Lizenz ISC, verträglich mit EUPL-1.2). Nur genutzte Symbole einbinden.
- Navigations- und Bediensymbole aus derselben Bibliothek.
- Symbol pro Aufgabe (F8, eigenes Paket): Auswahl aus einer festen Liste von etwa 20 Haushaltssymbolen mit Farbton, Standardsymbol für Aufgaben ohne Auswahl.

## 8. Bewegung

- Kurze, dezente Übergänge (unter 200 ms), zum Beispiel beim Abhaken.
- Bei `prefers-reduced-motion: reduce` keine Animationen.
