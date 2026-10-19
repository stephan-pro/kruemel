# Putzplan – Plan für Etappe 1

Stand: 19.10.2026 · Grundlage: `ANFORDERUNGEN.md` (inkl. Abschnitt 9 „Entscheidungen“)

Spätere Sitzungen lesen nur diese beiden Dateien und `CLAUDE.md`.

## 1. Technik-Stack

Grundsatz (N7): Jede Bibliothek muss begründet sein. Was sich mit wenig eigenem Code lösen lässt, wird selbst geschrieben.

| Bereich | Wahl | Begründung |
|---|---|---|
| Sprache | TypeScript, `strict` | Fehler werden vor dem Start erkannt (Q2). |
| Werkzeug-Laufzeit | Node.js, aktuelle LTS, Version in `.nvmrc` | Nur für Entwicklung und Build; die App läuft rein im Browser. |
| Oberfläche | Preact | Ca. 4 KB. Aktualisiert nur geänderte Teile der Seite, sodass Fokus und Screenreader-Position erhalten bleiben (N2). JSX über `tsconfig` (`jsxImportSource: "preact"`), kein Vite-Plugin. |
| Design | `@kern-ux/native` | Vorgabe N1; reines CSS für natives HTML. |
| Build/Dev-Server | Vite | Standard, schnell, ohne Zusatz-Plugins nutzbar. |
| Format + Lint | Biome | Ein Werkzeug statt ESLint + Prettier + Plugins; enthält Regeln zur Barrierefreiheit. |
| Unit-Tests | Vitest + `@vitest/coverage-v8` | Schwelle 90 % für `src/domain/` (Q5). |
| E2E-Tests | `@playwright/test` + `@axe-core/playwright` | Chromium und WebKit, je Desktop und Handy (Q6); axe auf jeder Seite (Q7). |
| Pre-Commit | Eigener Git-Hook in `.githooks/`, aktiviert per `"prepare": "git config core.hooksPath .githooks"` | Keine Abhängigkeit (Q10). |
| `npm run check` | `scripts/check.mjs` | Läuft nacheinander, bricht beim ersten Fehler ab, meldet „✅ bestanden“ oder „❌ nicht bestanden in Schritt X“ (Q1). |
| CI | GitHub Actions, Dependabot (npm + github-actions, wöchentlich, gruppiert) | Q9, Q11. |
| Hosting | GitHub Pages über GitHub Actions | Kostenlos (N6), https für PWA. Vite-`base` = `/<repo-name>/`. |
| PWA | Eigenes `manifest.webmanifest` + eigener Service Worker | Spart das PWA-Plugin mit vielen Unterpaketen. |
| Datum | Eigenes Modul, Kalendertag als `"YYYY-MM-DD"` | Keine Uhrzeit, keine Zeitzonenfehler, keine Bibliothek. |
| Speicher | localStorage hinter Schnittstelle `Storage` (asynchron) | Etappe 2 tauscht nur die Umsetzung aus. `navigator.storage.persist()` anfragen. |
| IDs, Validierung, Routing | `crypto.randomUUID()`, eigene Prüffunktionen, eigener Hash-Router (`#/woche` …) | Keine Abhängigkeiten. |

Abhängigkeiten gesamt: 9. Laufzeit: `preact`, `@kern-ux/native`. Entwicklung: `typescript`, `vite`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `@axe-core/playwright`, `@biomejs/biome`.

Schritte von `npm run check`:
1. `biome check` (lokal mit `--write`, in CI nur prüfen)
2. `tsc --noEmit`
3. `vitest run --coverage`
4. `vite build`
5. `playwright test` (4 Projekte: chromium-desktop, chromium-mobile, webkit-desktop, webkit-mobile)

## 2. Ordnerstruktur

Projektwurzel ist `C:\Users\Anwender\Projekte\putzplan`.

```
.github/          Workflows (check, Pages-Deploy) und dependabot.yml.
.githooks/        pre-commit: Biome auf gestagte Dateien.
docs/             ANFORDERUNGEN.md, PLAN.md.
public/           Icons, Manifest, statische Dateien.
scripts/          check.mjs und weitere Hilfsskripte.
src/domain/       Fachlogik als reine Funktionen; Tests als *.test.ts daneben.
src/storage/      Storage-Schnittstelle, localStorage-Umsetzung, Export/Import.
src/ui/           Preact: pages/ (Woche, Aufgaben, Erledigt, Einstellungen) und components/.
src/demo/         Beispieldaten mit erfundenen Namen, relativ zum heutigen Datum.
src/main.tsx      Einstiegspunkt.
src/sw.ts         Service Worker.
tests/e2e/        Playwright-Tests mit axe.
CLAUDE.md         Aufbau, Befehle, Regeln, Wortliste.
README.md         Anleitung, Status-Badge der CI.
LICENSE           EUPL-1.2.
```

## 3. Leitlinien für den Code

- Keine echten Personennamen in Code, Tests oder Beispieldaten. Personen sind intern `personA`/`personB`; Namen stehen in den Einstellungen. Zuständigkeit: `personA | personB | both`.
- Fachlogik in `src/domain/` kennt weder DOM noch Speicher; sie bekommt „heute“ als Parameter.
- Jedes Akzeptanzkriterium aus ANFORDERUNGEN.md ist mindestens ein Test, benannt nach dem Kriterium.
- Exportformat und gespeicherte Daten tragen eine `schemaVersion`.
- Eine Aufgabe pro Sitzung (T2); vor Fragen an Claude erst `npm run check` (T3).

## 4. Arbeitspakete

Jedes Paket endet mit grünem `npm run check` und einem Commit.

| # | Paket | Inhalt | Fertig, wenn |
|---|---|---|---|
| 1 | Projektgerüst | `git init`, `.gitignore`, LICENSE EUPL-1.2, `package.json` (`"license": "EUPL-1.2"`), `.nvmrc`, TS strict, Biome, Vitest mit Schwelle, Vite, Playwright-Rauchtest mit axe, `check.mjs`, Pre-Commit-Hook, Workflow `check`, Dependabot, kurze `CLAUDE.md`, README. Vorab prüfen: Node.js, Git, GitHub-Konto. | Leere Seite „Putzplan“; check lokal und auf GitHub grün. |
| 2 | Datums-Modul | Kalendertag-Typ, Tage/Wochen/Monate addieren (Monatsende-Regel), Wochenbeginn Montag, Wochen blättern. | Volle Testabdeckung. |
| 3 | Terminberechnung F2 | Datenmodell Aufgabe/Rhythmus/Erledigung, nächster Termin ab Abhaktag, Rückgängig nur für das letzte Abhaken. | Alle F2-Kriterien als Tests grün. |
| 4 | Restliche Fachlogik F3–F5 | Einmalige Aufgaben, Übernehmen (dieses Mal/dauerhaft; bei einmaligen direkt umweisen), „erledigt von“, Filter „nur meine“ inkl. `both`, Checklisten (Häkchen-Reset bei wiederkehrenden Aufgaben), Erledigt-Liste. | Fachlogik komplett, ≥ 90 %. |
| 5 | Speicher und F7 | `Storage`-Schnittstelle, localStorage-Umsetzung, Export, Import mit Prüfung und `schemaVersion`. | Tests mit Fake-Speicher grün. |
| 6 | Testdaten Q8 | `npm run demo`: App mit Beispieldaten in eigenem Speicherbereich; dieselben Daten nutzen die E2E-Tests. | PO kann manuell ausprobieren. |
| 7 | App-Rahmen und Veröffentlichung | KERN UX, Navigation, Ersteinrichtung (zwei Namen), „Ich bin“, Seitentitel, Fokusführung; Deploy-Workflow für GitHub Pages. | App unter GitHub-Pages-Adresse erreichbar; axe grün. |
| 8 | Aufgaben verwalten F1/F3 | Formulare anlegen/bearbeiten/löschen (Löschen mit Rückfrage), erster Termin vorbelegt mit heute. | E2E-Tests grün. |
| 9 | Wochenübersicht F6 | Mo–So, heute hervorgehoben, Überfälliges oben, Blättern, vergangene Wochen mit Erledigtem ausgegraut und „erledigt von“, Filter, Abhaken mit Hinweis „Rückgängig“. | E2E-Tests grün. |
| 10 | Übernehmen und Checklisten-UI F4/F5 | Dialog „nur dieses Mal / dauerhaft“, Checklisten-Einträge hinzufügen/abhaken/löschen. | E2E-Tests grün. |
| 11 | Erledigt, Export, Import | Erledigt-Liste mit Rückgängig, Export-Download, Import mit Rückfrage und vorheriger Auto-Sicherung. | E2E-Tests grün. |
| 12 | PWA und Handy | Manifest, Icons, Service Worker (offline), responsives Feintuning; Installation auf Android und iPhone testen. | Installierbar, offline nutzbar. |
| 13 | Abschluss | Manuelle Prüfung Tastatur + NVDA, README für den PO, Prüfliste für Etappe 2. | Etappe 1 abgenommen. |

## 5. Hinweise

- Safari auf dem iPhone löscht Website-Daten nach 7 Tagen ohne Nutzung, wenn die App nicht installiert ist. Export (F7) regelmäßig nutzen.
- Die Daten liegen pro Browser und Gerät getrennt; gemeinsame Daten erst ab Etappe 2.
