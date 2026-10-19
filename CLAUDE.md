# Putzplan – Hinweise für Claude

Haushalts-App für zwei Personen. Preact + TypeScript (strict), Vite, läuft rein im Browser.
Anforderungen: `docs/ANFORDERUNGEN.md` · Plan und Arbeitspakete: `docs/PLAN.md`.

## Befehle

- `npm run check` – alles prüfen (Biome → tsc → Vitest mit Abdeckung → Build → Playwright). Muss grün sein.
- `npm run dev` – Entwicklungsserver.
- `npm test` – Vitest im Beobachtungsmodus.
- `npm run e2e` – nur Playwright (braucht vorher `npm run build`).
- Erstes Einrichten: `npm install` und `npx playwright install chromium webkit`.

## Aufbau

- `src/domain/` – Fachlogik, reine Funktionen, Tests `*.test.ts` daneben, Abdeckung ≥ 90 %.
- `src/storage/` – Storage-Schnittstelle und localStorage-Umsetzung.
- `src/ui/` – Preact-Komponenten (`pages/`, `components/`).
- `tests/e2e/` – Playwright-Tests, jede Seite mit axe.
- `scripts/check.mjs` – Ablauf von `npm run check`.
- `.githooks/pre-commit` – Biome auf gestagte Dateien.

## Regeln

- Code-Namen englisch, Oberfläche deutsch.
- Keine echten Personennamen; intern `personA`/`personB`, Zuständigkeit `personA | personB | both`.
- Fachlogik kennt weder DOM noch Speicher; „heute“ kommt als Parameter (`"YYYY-MM-DD"`).
- Jedes Akzeptanzkriterium ist mindestens ein Test, benannt nach dem Kriterium.
- Neue Abhängigkeiten nur mit Begründung in `docs/PLAN.md`.
- Gespeicherte Daten und Export tragen `schemaVersion`.

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
