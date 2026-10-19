# Putzplan – Hinweise für Claude

Haushalts-App für zwei Personen. Preact + TypeScript (strict), Vite, läuft rein im Browser.
Anforderungen: `docs/ANFORDERUNGEN.md` · Plan und Arbeitspakete: `docs/PLAN.md` · Design: `docs/design/DESIGN.md` (die `entwurf-*.html` dort sind nur Referenz, nicht lauffähig).

## Befehle

- `npm run check` – alles prüfen (Biome → tsc → Vitest mit Abdeckung → Build → Playwright). Muss grün sein.
- `npm run dev` – Entwicklungsserver.
- `npm run demo` – App mit Beispieldaten (eigener Speicherbereich `putzplan-demo`) im Browser.
- `npm test` – Vitest im Beobachtungsmodus.
- `npm run e2e` – nur Playwright (braucht vorher `npm run build`).
- `npm run setup` – erstes Einrichten (Pakete + Playwright-Browser).

- `/paket <Nummer> [Hinweise]` – Projekt-Skill (`.claude/skills/paket/SKILL.md`): setzt ein Arbeitspaket aus `docs/PLAN.md` komplett um, bis `npm run check` lokal und auf GitHub grün und die Online-Version aktualisiert ist.

## Aufbau

- `src/domain/` – Fachlogik, reine Funktionen, Tests `*.test.ts` daneben, Abdeckung ≥ 90 %. `week.ts` (`weekView`: Wochenübersicht F6), `taskManagement.ts` (Liste, Löschen, `completeInData`/`undoInData`), `taskSymbols.ts` (feste Symbol-Liste F8 mit Ton; jede Aufgabe hat `symbol`, Standard `standard`).
- `src/storage/` – `AppStorage`-Schnittstelle, localStorage-Umsetzung, Prüfung (`parseAppData`), Export/Import. Tests daneben, Abdeckung ≥ 90 % wie `src/domain/`. `migrate.ts` (`migrateAppData`): bringt ältere `schemaVersion` auf den aktuellen Stand (jetzt 2), läuft als erster Schritt von `parseAppData`, also beim Laden und Import. Ändert sich das Speicherformat: `SCHEMA_VERSION` erhöhen, Migrationsschritt ergänzen, Tests mit alten Daten (`asVersion1` in `storage.fixtures.ts`).
- `src/demo/` – Beispieldaten relativ zu „heute“ (`demoData`), Befüllen des Demo-Speichers; nur im Modus `demo` geladen. Abdeckung ≥ 90 % wie `src/domain/`.
- `src/ui/` – Preact-Komponenten (`pages/`, `components/`), `App.tsx` (Laden, Zustände, Speichern, Farbschema, Rahmen), `route.ts` (Hash-Router, Seiten und Titel, auch `#/aufgaben/neu` und `#/aufgaben/bearbeiten/<id>`), `format.ts` (Datum, KW, Rhythmus, Zuständigkeit, Hinweistexte auf Deutsch), `useToday.ts` („heute“, rückt über Mitternacht weiter), `pages/WeekPage.tsx` (Wochenübersicht als Kachel-Board mit Abhaken/Rückgängig, Übernehmen, Checkliste und Detailansicht), `colorScheme.ts` (`data-theme`; dasselbe macht das Skript in `index.html` vor dem ersten Zeichnen). Jede Seite hat eine `PageTitle`-`h1` (setzt Tab-Titel, nimmt den Fokus; `heading` für eine abweichende Überschrift).
- Design: `tokens.css` (CSS-Variablen hell/dunkel nach DESIGN.md), `app.css` (alle Bausteine, nur Tokens, keine festen Farben). `tokens.test.ts` prüft die Kontraste jeder verwendeten Kombination in beiden Themes – neue Kombinationen dort eintragen. Symbole aus `lucide-preact` (einzeln importieren), Schrift `@fontsource-variable/archivo`. Klassen: `tile`, `btn btn--primary|secondary|quiet|warn`, `icon-btn`, `segmented`; Fehler über `components/Alert.tsx` (`ErrorAlert`).
- Formulare bauen auf `components/fields.tsx` (`TextField`, `TextAreaField`, `SelectField`, `RadioGroup`, `FieldGroup`): sichtbare Beschriftung, Meldung direkt am Feld, nach dem Absenden mit Fehlern Fokus auf das erste fehlerhafte Feld. Löschen immer über `DeleteTaskDialog` (Rückfrage). Symbole: Anzeige über `components/TaskSymbol.tsx` (`tile`/`small`/`plain`, Bildzuordnung `id → Lucide`), Auswahl über `components/SymbolField.tsx` (Raster mit 7/6/3 Spalten über `@container`, hängt an den 21 Symbolen: bei anderer Zahl Spalten neu wählen).
- Fenster: `components/Modal.tsx` (natives `<dialog>`, Escape → `onCancel`), darauf `ConfirmDialog` (Rückfrage, `tone`, `initialFocusId`), `DeleteTaskDialog`, `TakeOverDialog` (Übernehmen: nur dieses Mal / dauerhaft) und `TaskDetailDialog` (Detailansicht einer Aufgabe der Wochenübersicht). Den Knopf, der ein Fenster öffnet, merkt sich die Seite (`event.currentTarget`) und fokussiert ihn nach dem Schließen selbst (Safari fokussiert Knöpfe beim Klick nicht). Checkliste: `components/ChecklistToggles.tsx` (Kästchen in Zeile und Detailansicht), `components/ChecklistEditor.tsx` (Einträge im Aufgabenformular). Aufgaben in der Wochenübersicht sind Knöpfe (`data-task-open`, Name = ihr ganzer Text).
- `.github/workflows/` – `check.yml` (npm run check bei Push/PR), `pages.yml` (veröffentlicht `main` auf GitHub Pages nach grünem check): https://stephan-pro.github.io/putzplan/
- `tests/e2e/` – Playwright-Tests, jede Seite mit axe (`axe.ts`: `expectNoAccessibilityViolations` prüft hell und dunkel). `app.spec.ts`: Einrichtung, Navigation, Einstellungen, unlesbare Daten. `design.spec.ts`: Farbschema N8, Schrift, Navigation, Fokus, Tippflächen. Die Wochenübersicht heißt in der `h1` „Diese Woche“, der Tab-Titel bleibt „Wochenübersicht – Putzplan“. Der erste Start zeigt die Ersteinrichtung; für eine fertig eingerichtete App Daten vorher in den Speicher schreiben (siehe `startConfigured`).
- `tests/e2e/helpers.ts` – gemeinsame Hilfen (`startConfigured`, `storedData`, `goToPage`; für die Wochenübersicht `openWeek` mit eingefrorener Uhr auf Mi 21.10.2026, `tile`/`todayTile`/`overdueTile`, `notice`, `taskButton`, `chooseDay`, `detailDialog`, `detailValue`). Nach einem Seitenwechsel vor dem Tippen auf den Fokus der Überschrift warten (`goToPage`/`expectPageShown`), sonst nimmt der Fokussprung dem Test den Fokus. `tests/e2e/tasks.spec.ts`: Aufgaben anlegen, bearbeiten, löschen, Formularfehler.
- `tests/e2e/week.spec.ts` – Wochenübersicht; friert die Browser-Uhr auf Mi 21.10.2026 ein (`page.clock.setFixedTime`), damit `demoData(21.10.2026)` feste Wochentage hat (Überfälliges, nächste/letzte Woche).
- `tests/e2e/symbols.spec.ts` – Symbole F8 (Auswahl, Raster, Anzeige, alte Daten Version 1); das gezeigte Symbol steht in `data-symbol`.
- `tests/e2e/details.spec.ts` (Detailansicht F6), `takeover.spec.ts` (Übernehmen F5), `checklist.spec.ts` (Checkliste F4 in Zeile und Formular) – am Handy ist die Checkliste einer Zeile erst nach „Checkliste“ sichtbar (`showChecklist` in `checklist.spec.ts`).
- `tests/e2e/demo.spec.ts` – prüft den Demo-Modus; Playwright startet dafür einen zweiten Server (`vite --mode demo`, Port 4174). Spätere E2E-Tests nehmen `demoData(heute)` als Ausgangslage.
- `scripts/check.mjs` – Ablauf von `npm run check`.
- `.githooks/pre-commit` – Biome auf gestagte Dateien.

## Regeln

- Code-Namen englisch, Oberfläche deutsch.
- Keine echten Personennamen; intern `personA`/`personB`, Zuständigkeit `personA | personB | both`.
- Fachlogik kennt weder DOM noch Speicher; „heute“ kommt als Parameter (`"YYYY-MM-DD"`).
- Jedes Akzeptanzkriterium ist mindestens ein Test, benannt nach dem Kriterium.
- Neue Abhängigkeiten nur mit Begründung in `docs/PLAN.md`.
- Gespeicherte Daten und Export tragen `schemaVersion`.
- Dateien immer mit dem Write- oder Edit-Werkzeug anlegen und ändern, nie per Shell-Befehl (kein `echo >`, Heredoc, `sed -i`, `node -e` o. Ä.).
- Entwicklungsumgebung ist Windows mit PowerShell; Shell-Befehle nur zum Ausführen (npm, git, gh), in PowerShell-Syntax.

## Wortliste

| Oberfläche | Code |
|---|---|
| Aufgabe | task |
| wiederkehrend / einmalig | recurring / oneOff |
| Rhythmus | recurrence |
| fällig am | dueDate |
| abhaken / Erledigung | complete / completion |
| erledigt von | completedBy |
| Rückgängig | undo |
| zuständig / Zuständigkeit | assignee |
| beide | both |
| übernehmen (nur dieses Mal / dauerhaft) | takeOver (once / permanently) |
| Checkliste / Eintrag | checklist / checklistItem |
| Wochenübersicht | weekView |
| Ich bin | currentPerson |
| Export / Import | exportData / importData |
| Gerät (nicht in der Sicherung) | device (`DeviceSettings`) |
| Darstellung / Farbschema (Hell, Dunkel, Automatisch) | colorScheme (`light`, `dark`, `auto`) |
| Stand (erledigt / fällig) | progress (`done`, `due`) |
| Symbol (einer Aufgabe, ab R2) | symbol |
| Detailansicht (einer Aufgabe) | taskDetail (`TaskDetailDialog`) |
