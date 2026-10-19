# Putzplan – Hinweise für Claude

Haushalts-App für zwei Personen. Preact + TypeScript (strict), Vite, läuft rein im Browser.
Anforderungen: `docs/ANFORDERUNGEN.md` · Plan und Arbeitspakete: `docs/PLAN.md`.

## Befehle

- `npm run check` – alles prüfen (Biome → tsc → Vitest mit Abdeckung → Build → Playwright). Muss grün sein.
- `npm run dev` – Entwicklungsserver.
- `npm run demo` – App mit Beispieldaten (eigener Speicherbereich `putzplan-demo`) im Browser.
- `npm test` – Vitest im Beobachtungsmodus.
- `npm run e2e` – nur Playwright (braucht vorher `npm run build`).
- `npm run setup` – erstes Einrichten (Pakete + Playwright-Browser).

- `/paket <Nummer> [Hinweise]` – Projekt-Skill (`.claude/skills/paket/SKILL.md`): setzt ein Arbeitspaket aus `docs/PLAN.md` komplett um, bis `npm run check` lokal und auf GitHub grün und die Online-Version aktualisiert ist.

## Aufbau

- `src/domain/` – Fachlogik, reine Funktionen, Tests `*.test.ts` daneben, Abdeckung ≥ 90 %. `week.ts` (`weekView`: Wochenübersicht F6), `taskManagement.ts` (Liste, Löschen, `completeInData`/`undoInData`).
- `src/storage/` – `AppStorage`-Schnittstelle, localStorage-Umsetzung, Prüfung (`parseAppData`), Export/Import. Tests daneben, Abdeckung ≥ 90 % wie `src/domain/`.
- `src/demo/` – Beispieldaten relativ zu „heute“ (`demoData`), Befüllen des Demo-Speichers; nur im Modus `demo` geladen. Abdeckung ≥ 90 % wie `src/domain/`.
- `src/ui/` – Preact-Komponenten (`pages/`, `components/`), `App.tsx` (Laden, Zustände, Speichern von Aufgaben, Rahmen), `route.ts` (Hash-Router, Seiten und Titel, auch `#/aufgaben/neu` und `#/aufgaben/bearbeiten/<id>`), `format.ts` (Datum, Rhythmus, Zuständigkeit, Hinweistexte auf Deutsch), `useToday.ts` („heute“, rückt über Mitternacht weiter), `pages/WeekPage.tsx` (Wochenübersicht mit Abhaken/Rückgängig), `app.css` (nur Rahmen; sonst KERN-Klassen). Jede Seite hat eine `PageTitle`-`h1` (setzt Tab-Titel, nimmt den Fokus).
- Formulare bauen auf `components/fields.tsx` (`TextField`, `TextAreaField`, `SelectField`, `RadioGroup`): sichtbare Beschriftung, Meldung direkt am Feld, nach dem Absenden mit Fehlern Fokus auf das erste fehlerhafte Feld. Löschen immer über `DeleteTaskDialog` (Rückfrage).
- `.github/workflows/` – `check.yml` (npm run check bei Push/PR), `pages.yml` (veröffentlicht `main` auf GitHub Pages nach grünem check): https://stephan-pro.github.io/putzplan/
- `tests/e2e/` – Playwright-Tests, jede Seite mit axe (`axe.ts`: `expectNoAccessibilityViolations`). `app.spec.ts`: Einrichtung, Navigation, Einstellungen, unlesbare Daten. Der erste Start zeigt die Ersteinrichtung; für eine fertig eingerichtete App Daten vorher in den Speicher schreiben (siehe `startConfigured`).
- `tests/e2e/helpers.ts` – gemeinsame Hilfen (`startConfigured`, `storedData`, `goToPage`). Nach einem Seitenwechsel vor dem Tippen auf den Fokus der Überschrift warten (`goToPage`/`expectPageShown`), sonst nimmt der Fokussprung dem Test den Fokus. `tests/e2e/tasks.spec.ts`: Aufgaben anlegen, bearbeiten, löschen, Formularfehler.
- `tests/e2e/week.spec.ts` – Wochenübersicht; friert die Browser-Uhr auf Mi 21.10.2026 ein (`page.clock.setFixedTime`), damit `demoData(21.10.2026)` feste Wochentage hat (Überfälliges, nächste/letzte Woche).
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
