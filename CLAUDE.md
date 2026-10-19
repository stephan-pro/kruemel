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

## Aufbau

- `src/domain/` – Fachlogik, reine Funktionen, Tests `*.test.ts` daneben, Abdeckung ≥ 90 %.
- `src/storage/` – `AppStorage`-Schnittstelle, localStorage-Umsetzung, Prüfung (`parseAppData`), Export/Import. Tests daneben, Abdeckung ≥ 90 % wie `src/domain/`.
- `src/demo/` – Beispieldaten relativ zu „heute“ (`demoData`), Befüllen des Demo-Speichers; nur im Modus `demo` geladen. Abdeckung ≥ 90 % wie `src/domain/`.
- `src/ui/` – Preact-Komponenten (`pages/`, `components/`).
- `tests/e2e/` – Playwright-Tests, jede Seite mit axe.
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
