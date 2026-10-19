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
| Speicher | localStorage hinter Schnittstelle `AppStorage` (asynchron; nicht `Storage`, damit der Browser-Typ nicht verdeckt wird) | Etappe 2 tauscht nur die Umsetzung aus. `navigator.storage.persist()` anfragen. |
| IDs, Validierung, Routing | `crypto.randomUUID()`, eigene Prüffunktionen, eigener Hash-Router (`#/woche` …) | Keine Abhängigkeiten. |

Abhängigkeiten gesamt: 9. Laufzeit: `preact`, `@kern-ux/native`. Entwicklung: `typescript`, `vite`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `@axe-core/playwright`, `@biomejs/biome`.

Einrichten: `npm run setup` (`scripts/setup.mjs`) führt `npm install` und `npx playwright install chromium webkit` aus. `npm run check` prüft vorab, ob die Browser vorhanden sind, und verweist sonst auf `setup`.

Schritte von `npm run check`:
1. `biome check` (lokal mit `--write`, in CI nur prüfen)
2. `tsc --noEmit`
3. `vitest run --coverage` (schlägt fehl, wenn keine Tests gefunden werden oder die Abdeckung unter 90 % liegt)
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
| 6 | Testdaten Q8 ✅ | `npm run demo` (`vite --mode demo`): App mit Beispieldaten in eigenem Speicherbereich `putzplan-demo`; `demoData(heute)` liefert dieselben Daten auch für die E2E-Tests. Vorhandene Demo-Daten bleiben beim Neuladen; `?demo=neu` setzt zurück. Bis Paket 7 zeigt die Seite nur einen Demo-Hinweis. | PO kann manuell ausprobieren. |
| 7 ✅ | App-Rahmen und Veröffentlichung | KERN UX, Navigation, Ersteinrichtung (zwei Namen), „Ich bin“, Seitentitel, Fokusführung; Deploy-Workflow für GitHub Pages. Meldet `load()` unlesbare Daten (`StorageError`), zeigt die App eine verständliche Meldung mit zwei Wegen: 1. Rohdaten als Datei herunterladen (für eine spätere Reparatur), 2. danach bewusst neu beginnen, mit Rückfrage. Dafür braucht `AppStorage` eine Methode für die Rohdaten und eine zum Verwerfen. | App unter GitHub-Pages-Adresse erreichbar (https://stephan-pro.github.io/putzplan/); axe grün. |
| 8 | Aufgaben verwalten F1/F3 | Formulare anlegen/bearbeiten/löschen (Löschen mit Rückfrage), erster Termin vorbelegt mit heute. | E2E-Tests grün. |
| 9 | Wochenübersicht F6 | Mo–So, heute hervorgehoben, Überfälliges oben, Blättern, vergangene Wochen mit Erledigtem ausgegraut und „erledigt von“, Filter, Abhaken mit Hinweis „Rückgängig“. | E2E-Tests grün. |
| 10 | Übernehmen und Checklisten-UI F4/F5 | Dialog „nur dieses Mal / dauerhaft“, Checklisten-Einträge hinzufügen/abhaken/löschen. | E2E-Tests grün. |
| 11 | Erledigt, Export, Import | Erledigt-Liste mit Rückgängig, Export-Download, Import mit Rückfrage und vorheriger Auto-Sicherung. | E2E-Tests grün. |
| 12 | PWA und Handy | Manifest, Icons, Service Worker (offline), responsives Feintuning; Installation auf Android und iPhone testen. | Installierbar, offline nutzbar. |
| 13 | Abschluss | Manuelle Prüfung Tastatur + NVDA, README für den PO, Prüfliste für Etappe 2. | Etappe 1 abgenommen. |

## 5. Umsetzung Paket 7 (Entscheidungen)

- **Bildschirme:** Die App lädt Daten und Gerät und zeigt dann genau einen von fünf Zuständen: Laden, Speicherproblem, Ersteinrichtung (keine Namen), „Wer benutzt dieses Gerät?“ (Namen da, „Ich bin“ fehlt, z. B. neues Gerät), eigentliche App mit Navigation. Die Ersteinrichtung fragt Namen **und** „Ich bin“ in einem Schritt; dasselbe Formular steht unter „Einstellungen“.
- **Namen (`checkPersonNames`, Fachlogik):** getrimmt, nicht leer, höchstens 30 Zeichen, beide verschieden (ohne Rücksicht auf Groß-/Kleinschreibung).
- **Fokusführung:** Jede Seite hat genau eine `h1` (`PageTitle`); beim Seitenwechsel setzt sie den Tab-Titel („Seite – Putzplan“) und nimmt den Fokus. Beim ersten Laden nicht, damit „Zum Inhalt springen“ der erste Tabulator-Stopp bleibt. „Zum Inhalt springen“ ist ein Button, kein `#inhalt`-Link, weil das den Hash-Router auslösen würde.
- **Unlesbare Daten:** `AppStorage.loadRaw()` liefert den gespeicherten Text unverändert, `discard()` löscht ihn. Die App zeigt die Meldung mit Fundstellen; Weg 1 lädt `putzplan-rohdaten-JJJJ-MM-TT.json` herunter; erst danach erscheint Weg 2 „Neu beginnen …“, der eine Rückfrage (`<dialog>`, Fokus zuerst auf „Abbrechen“) stellt. Ist der Browser-Speicher selbst gesperrt (auch schon der Zugriff auf `localStorage` wirft), gibt es keine Rohdaten und kein Löschen, nur „Erneut versuchen“. „Ich bin“ des Geräts bleibt beim Verwerfen erhalten.
- **Platzhalter:** Woche, Aufgaben und Erledigt zeigen „Diese Seite ist noch im Aufbau.“ bis zu den Paketen 8–11.
- **Veröffentlichung:** `.github/workflows/pages.yml` läuft nach erfolgreichem Workflow `check` auf `main` und veröffentlicht den Build (`dist`) über GitHub Pages; manuell startbar. Pages-Quelle „GitHub Actions“ muss einmalig im Repository aktiviert sein.
- **Neue Abhängigkeit:** `@kern-ux/native` (war im Stack vorgesehen, siehe Tabelle oben). Nur CSS und Fira Sans werden eingebunden, nicht die Kopfzeile (Bundesflagge) und kein KERN-JavaScript.
- **Browser-Besonderheiten in Tests:** Safari springt mit Tab nicht auf Links und fokussiert Buttons beim Klick nicht; die betreffenden Tastaturtests laufen daher nur in Chromium bzw. nutzen `focus()`.

## 6. Hinweise

- Safari auf dem iPhone löscht Website-Daten nach 7 Tagen ohne Nutzung, wenn die App nicht installiert ist. Export (F7) regelmäßig nutzen.
- Die Daten liegen pro Browser und Gerät getrennt; gemeinsame Daten erst ab Etappe 2.
