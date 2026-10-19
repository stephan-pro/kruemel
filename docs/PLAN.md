# Putzplan – Plan für Etappe 1

Stand: 19.10.2026 · Grundlage: `ANFORDERUNGEN.md` (inkl. Abschnitt 9 „Entscheidungen“) und für die Oberfläche `design/DESIGN.md`

Spätere Sitzungen lesen nur diese Dateien und `CLAUDE.md`.

## 1. Technik-Stack

Grundsatz (N7): Jede Bibliothek muss begründet sein. Was sich mit wenig eigenem Code lösen lässt, wird selbst geschrieben.

| Bereich | Wahl | Begründung |
|---|---|---|
| Sprache | TypeScript, `strict` | Fehler werden vor dem Start erkannt (Q2). |
| Werkzeug-Laufzeit | Node.js, aktuelle LTS, Version in `.nvmrc` | Nur für Entwicklung und Build; die App läuft rein im Browser. |
| Oberfläche | Preact | Ca. 4 KB. Aktualisiert nur geänderte Teile der Seite, sodass Fokus und Screenreader-Position erhalten bleiben (N2). JSX über `tsconfig` (`jsxImportSource: "preact"`), kein Vite-Plugin. |
| Design | Eigenes CSS nach `docs/design/DESIGN.md`: Tokens in `src/ui/tokens.css` (hell und dunkel), Bausteine in `src/ui/app.css` | Vorgabe N1 (seit Paket R1; vorher KERN UX). Keine CSS-Bibliothek: Die wenigen Bausteine sind schneller selbst geschrieben als angepasst. |
| Schrift | `@fontsource-variable/archivo` (OFL-1.1) | DESIGN.md Abschnitt 4: Archivo selbst ausliefern, kein Google-Fonts-Abruf (DSGVO). Variable Schrift: eine Datei je Schriftsystem für alle Schnitte 400–800 (lateinisch ca. 35 KB). |
| Symbole | `lucide-preact` (ISC) | DESIGN.md Abschnitt 7. Preact-Komponenten, nur genutzte Symbole landen im Build (Tree-Shaking); setzt `aria-hidden` selbst, solange kein Name übergeben wird. |
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

Abhängigkeiten gesamt: 10. Laufzeit: `preact`, `lucide-preact`, `@fontsource-variable/archivo`. Entwicklung: `typescript`, `vite`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `@axe-core/playwright`, `@biomejs/biome`.

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
docs/             ANFORDERUNGEN.md, PLAN.md; design/ mit DESIGN.md und Entwürfen (nur Referenz).
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
- Oberfläche nach `docs/design/DESIGN.md`: nur Tokens aus `src/ui/tokens.css`, keine festen Farben; jede neue Farbkombination kommt in `src/ui/tokens.test.ts`. Neue Seiten und Dialoge prüft axe automatisch in beiden Farbschemata.

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
| 8 ✅ | Aufgaben verwalten F1/F3 | Formulare anlegen/bearbeiten/löschen (Löschen mit Rückfrage), erster Termin vorbelegt mit heute. | E2E-Tests grün. |
| 9 ✅ | Wochenübersicht F6 | Mo–So, heute hervorgehoben, Überfälliges oben, Blättern, vergangene Wochen mit Erledigtem ausgegraut und „erledigt von“, Filter, Abhaken mit Hinweis „Rückgängig“. | E2E-Tests grün. |
| R1 ✅ | Redesign und Dark Mode N1/N8 | KERN UX durch das eigene Design aus `docs/design/DESIGN.md` ersetzen: Tokens als CSS-Variablen für hell und dunkel, Archivo selbst ausgeliefert, Lucide-Symbole, `@kern-ux/native` entfernt. Alle Seiten der Pakete 7–9 umgebaut (Wochenübersicht als Kachel-Board). Einstellung „Darstellung“ Hell/Dunkel/Automatisch pro Gerät, ohne Aufblitzen. ANFORDERUNGEN: N1 ersetzt, N8 neu, F8 geplant, Abschnitt „Sicherheit (Etappe 2)“. | check grün; axe in beiden Themes auf jeder Seite. |
| R2 | Symbole pro Aufgabe F8 | Feste Liste von ca. 20 Haushaltssymbolen (Lucide) mit Farbton, Auswahl im Aufgabenformular, Anzeige in Woche und Aufgaben; Standardsymbol ohne Auswahl. Speicherformat `schemaVersion` 2 mit Migration bestehender Daten und alter Sicherungen. Plan siehe Abschnitt 9. | Unit-Tests der Migration und E2E-Tests grün (beide Themes). |
| 10 | Übernehmen und Checklisten-UI F4/F5 | Im neuen Design: Knopf „Übernehmen“ in der Zeile der Tageskachel und auf der Kachel „Überfällig“ (DESIGN.md Abschnitt 6), Dialog „nur dieses Mal / dauerhaft“ (Stil von `ConfirmDialog`, Auswahl als `RadioGroup`). Checklisten: Einträge als abhakbare Chips in der Zeile (am PC immer sichtbar, am Handy aufklappbar unter der Aufgabe), Hinzufügen und Löschen im Aufgabenformular. | E2E-Tests grün, axe hell und dunkel. |
| 11 | Erledigt, Export, Import | Erledigt-Liste als Kachel mit Zeilen im Stil der Tageskachel (Symbol, Titel, „Erledigt von … am …“, Knopf „Rückgängig“). Export-Download und Import mit Rückfrage und vorheriger Auto-Sicherung als Kachel „Sicherung“ unter Einstellungen; Format mit `schemaVersion` 2 (nach R2), alte Sicherungen über die Migration aus R2. | E2E-Tests grün, axe hell und dunkel. |
| 12 | PWA und Handy | Manifest mit `background_color`/`theme_color` aus den Tokens, `<meta name="theme-color">` je Farbschema, App-Symbol im Kachel-Stil (ohne Hoheitszeichen), Service Worker (offline, auch Schrift-Dateien), Safe-Area für Leiste unten und schwebenden Knopf; Installation auf Android und iPhone testen. | Installierbar, offline nutzbar. |
| 13 | Abschluss | Manuelle Prüfung Tastatur + NVDA in beiden Farbschemata und im Windows-Kontrastmodus, README für den PO (inkl. Darstellung), Prüfliste für Etappe 2 inkl. Sicherheit S1–S6. | Etappe 1 abgenommen. |

## 5. Umsetzung Paket 7 (Entscheidungen)

- **Bildschirme:** Die App lädt Daten und Gerät und zeigt dann genau einen von fünf Zuständen: Laden, Speicherproblem, Ersteinrichtung (keine Namen), „Wer benutzt dieses Gerät?“ (Namen da, „Ich bin“ fehlt, z. B. neues Gerät), eigentliche App mit Navigation. Die Ersteinrichtung fragt Namen **und** „Ich bin“ in einem Schritt; dasselbe Formular steht unter „Einstellungen“.
- **Namen (`checkPersonNames`, Fachlogik):** getrimmt, nicht leer, höchstens 30 Zeichen, beide verschieden (ohne Rücksicht auf Groß-/Kleinschreibung).
- **Fokusführung:** Jede Seite hat genau eine `h1` (`PageTitle`); beim Seitenwechsel setzt sie den Tab-Titel („Seite – Putzplan“) und nimmt den Fokus. Beim ersten Laden nicht, damit „Zum Inhalt springen“ der erste Tabulator-Stopp bleibt. „Zum Inhalt springen“ ist ein Button, kein `#inhalt`-Link, weil das den Hash-Router auslösen würde.
- **Unlesbare Daten:** `AppStorage.loadRaw()` liefert den gespeicherten Text unverändert, `discard()` löscht ihn. Die App zeigt die Meldung mit Fundstellen; Weg 1 lädt `putzplan-rohdaten-JJJJ-MM-TT.json` herunter; erst danach erscheint Weg 2 „Neu beginnen …“, der eine Rückfrage (`<dialog>`, Fokus zuerst auf „Abbrechen“) stellt. Ist der Browser-Speicher selbst gesperrt (auch schon der Zugriff auf `localStorage` wirft), gibt es keine Rohdaten und kein Löschen, nur „Erneut versuchen“. „Ich bin“ des Geräts bleibt beim Verwerfen erhalten.
- **Platzhalter:** Woche, Aufgaben und Erledigt zeigen „Diese Seite ist noch im Aufbau.“ bis zu den Paketen 8–11 (Stand nach Paket 9: nur noch „Erledigt“).
- **Veröffentlichung:** `.github/workflows/pages.yml` läuft nach erfolgreichem Workflow `check` auf `main` und veröffentlicht den Build (`dist`) über GitHub Pages; manuell startbar. Pages-Quelle „GitHub Actions“ muss einmalig im Repository aktiviert sein.
- **Neue Abhängigkeit:** `@kern-ux/native` (war im Stack vorgesehen, siehe Tabelle oben). Nur CSS und Fira Sans werden eingebunden, nicht die Kopfzeile (Bundesflagge) und kein KERN-JavaScript. *In Paket R1 durch das eigene Design ersetzt und entfernt.*
- **Browser-Besonderheiten in Tests:** Safari springt mit Tab nicht auf Links und fokussiert Buttons beim Klick nicht; die betreffenden Tastaturtests laufen daher nur in Chromium bzw. nutzen `focus()`.

## 6. Umsetzung Paket 8 (Entscheidungen)

- **Seiten:** „Aufgaben“ listet alle offenen Aufgaben in zwei Gruppen (wiederkehrend, einmalig), je nach Fälligkeit und Titel sortiert, als Karten mit Bearbeiten und Löschen. Neu: `#/aufgaben/neu` und `#/aufgaben/bearbeiten/<id>`; beide gehören in der Navigation zu „Aufgaben“ (`aria-current="true"`, die Seite selbst hat `"page"` nur bei den vier Hauptseiten). Eine Adresse zu einer unbekannten Aufgabe zeigt „Aufgabe nicht gefunden“. Erledigte einmalige Aufgaben stehen nicht in der Liste, sondern in „Erledigt“ (Paket 11).
- **Formular:** Feste Felder in dieser Reihenfolge: Art (nur beim Anlegen; später nicht änderbar), Titel, Rhythmus (Abstand und Einheit, nur wiederkehrend), Termin, Zuständig, Notiz. Der Termin ist beim Anlegen heute; „Zuständig“ ist mit „Ich bin“ vorbelegt (sichtbar und änderbar), damit niemand eine fremde Zuständigkeit übersieht, die man erst wählen müsste.
- **Prüfung (`checkTaskForm`, Fachlogik):** Titel getrimmt, nicht leer, höchstens 80 Zeichen; Notiz höchstens 500; Abstand ganze Zahl 1–365; Termin ein echter Tag zwischen 2000 und 2100 (verhindert Tippfehler und Überläufe der Datumsrechnung). Jede Meldung steht am Feld.
- **Barrierefreie Formulare:** Alle Felder entstehen aus `fields.tsx` (`TextField`, `TextAreaField`, `SelectField`, `RadioGroup`): sichtbares `<label>`/`<legend>`, Hinweis und Fehler direkt am Feld, `aria-describedby`, `aria-invalid`. Nach dem Absenden mit Fehlern landet der Fokus auf dem ersten fehlerhaften Feld (Reihenfolge `TASK_FORM_FIELD_ORDER`); die Meldung eines Feldes verschwindet, sobald man es ändert. Die Ersteinrichtung nutzt dieselben Bausteine.
- **Bearbeiten:** `updateTask` ändert Titel, Termin, Notiz, Rhythmus und feste Zuständigkeit. Eine geänderte feste Zuständigkeit beendet eine Übernahme „nur dieses Mal“ (F5); bleibt sie gleich, bleibt die Übernahme. Checkliste, Erledigungen und der erledigt-Zustand bleiben.
- **Löschen:** Immer über `DeleteTaskDialog` (native `<dialog>`, Fokus zuerst auf „Abbrechen“). Die Rückfrage nennt die Zahl der Einträge in „Erledigt“, die mit verschwinden. Entscheidung: Die Historie wird mit gelöscht (wie in ANFORDERUNGEN.md, F3 Löschen), weil ein Eintrag ohne Aufgabe weder angezeigt noch rückgängig gemacht werden kann; `parseAppData` lehnt verwaiste Erledigungen ohnehin ab. Löschen geht aus der Liste und aus dem Bearbeiten-Formular.
- **Rückmeldung:** Nach Anlegen, Speichern und Löschen steht auf „Aufgaben“ eine Meldung in einem Bereich mit `role="status"` (wird vorgelesen). Nach einem Löschen in der Liste, wo die Schaltfläche verschwindet, springt der Fokus auf die Überschrift.
- **Speicherfehler:** Schlägt das Speichern fehl, bleibt man im Formular, die Eingaben bleiben stehen und eine Meldung „Nicht gespeichert“ erscheint; beim Löschen „Nicht gelöscht“.
- **Schaltflächen in der Liste:** Sichtbarer Text „Bearbeiten“/„Löschen“, zugänglicher Name „Bearbeiten: Titel“ (`aria-label`; der Name beginnt mit dem sichtbaren Text). Text, der nur für Screenreader da ist, wäre in Chromium mit Leerzeichen eingefügt worden.
- **Tests:** E2E-Tests warten nach einem Seitenwechsel, bis die Überschrift den Fokus hat (`goToPage`, `expectPageShown` in `tests/e2e/helpers.ts`), bevor sie tippen oder Tasten drücken. Der Fokussprung läuft nach dem Zeichnen und nahm vorher in WebKit unter Last gelegentlich einem zu früh gestarteten Test den Fokus (ein bestehender Test war dadurch in etwa 5 % der Läufe rot).

## 7. Umsetzung Paket 9 (Entscheidungen)

- **Fachlogik `src/domain/week.ts`:** `weekView({ tasks, completions, shownDay, today, filter, person })` liefert `position` (`past | current | future`), sieben Tage (`days`, je mit `isToday` und `entries`) und `overdue`. Ein Eintrag ist `open` (mit `daysOverdue`) oder `done` (mit der Erledigung, daraus „erledigt von“). Reine Funktion, „heute“ und die gezeigte Woche kommen als Parameter.
- **Regeln:** Eine Aufgabe steht an ihrem Fälligkeitstag; wiederkehrende haben nur einen (den nächsten), also keine Vorschau. Überfälliges (Termin vor heute) steht nur in der **laufenden** Woche im Block „Überfällig“ (älteste zuerst) und nicht zusätzlich an seinem alten Tag; in vergangenen Wochen bleibt eine unerledigte Aufgabe an ihrem Tag und ist als überfällig markiert, künftige Wochen haben nichts Überfälliges. Erledigtes erscheint **nur in vergangenen Wochen**, und zwar an dem Tag, an dem die Aufgabe fällig war (`previousDueDate`), mit „Erledigt von … am …“; in der laufenden und in künftigen Wochen ist abgehakt = weg (F3). Innerhalb eines Tages stehen offene vor erledigten Einträgen, jeweils nach Titel.
- **Filter:** „Nur meine“ nutzt `isMine` (aktuelle Zuständigkeit samt Übernahme „nur dieses Mal“, „beide“ zählt für beide) auf die Aufgabe, auch bei erledigten Einträgen. Der Filter ist Zustand der Seite (nicht gespeichert) und beginnt mit „Alle Aufgaben“.
- **Abhaken und Rückgängig in den Daten:** `completeInData` und `undoInData` (`taskManagement.ts`) wenden `completeTask`/`undoCompletion` auf die gesamten App-Daten an. Die App (`App.tsx`) vergibt die Erledigungs-ID (`crypto.randomUUID()`), setzt „heute“ und „erledigt von“ = „Ich bin“ und speichert über `saveData`; schlägt das Speichern fehl, bleibt die Anzeige unverändert und die Seite zeigt „Nicht gespeichert“.
- **Seite `WeekPage`** (Aufbau in Paket R1 ersetzt, siehe Abschnitt 8): `h1` „Wochenübersicht“; darunter Wochenwechsel (Vorherige Woche / Diese Woche / Nächste Woche als Buttons in einer `nav`), Filter als `RadioGroup` („Anzeigen“), eine Zeile `role="status"` mit der gezeigten Woche („Diese Woche: …“, „Vergangene Woche vom …“, „Woche vom …“; wird beim Blättern vorgelesen). Überfällig und jeder Tag sind `section`s mit `h2` (Tage: „Mi, 21.10.2026 (heute)“, heute zusätzlich `aria-current="date"` und kräftiger Balken); leere Tage sagen „Keine Aufgaben.“. Die Woche ist ein Abstand in Wochen zur laufenden (nicht ein fester Tag), damit „diese Woche“ nach Mitternacht mitwandert.
- **Heute:** `useToday()` (`src/ui/useToday.ts`) prüft jede Minute und beim Wiedereinblenden des Tabs, ob der Tag gewechselt hat, sodass eine über Nacht offene Seite weiterrückt.
- **Hinweis nach dem Abhaken:** Ein `section`-Bereich „Hinweis“ mit Text („… ist abgehakt. Nächster Termin: …“ bzw. „… steht jetzt unter „Erledigt““) und der Schaltfläche „Rückgängig“ bekommt den Fokus (die gedrückte Schaltfläche ist verschwunden; so wird der Text vorgelesen und Tab führt zu „Rückgängig“ und zur nächsten Aufgabe). Bewusst keine `role="status"`, um doppelte Ansagen zu vermeiden, und kein Zeitablauf (WCAG 2.2.1). Es gibt nur den Hinweis zur zuletzt abgehakten Aufgabe; ältere Erledigungen macht man ab Paket 11 über „Erledigt“ rückgängig. Nach „Rückgängig“ erscheint eine Bestätigung ohne weitere Schaltfläche.
- **Kleinste Lösung statt späterer Pakete:** Ohne Aufgaben zeigt die Seite statt der Wochen nur „Es gibt noch keine Aufgaben.“ mit Link „Erste Aufgabe anlegen“. „Erledigt“ bleibt Platzhalter bis Paket 11. Übernehmen und Checklisten-Bedienung folgen in Paket 10; die Wochenübersicht zeigt sie nicht an.
- **Tests:** Die E2E-Tests der Woche (`tests/e2e/week.spec.ts`) frieren die Uhr des Browsers auf Mittwoch, 21.10.2026, ein (`page.clock.setFixedTime`) und nutzen `demoData` für diesen Tag, damit Wochentage und Überfälligkeit fest sind; der Test zur Mitternacht nutzt `page.clock.install` und `runFor`.

## 8. Umsetzung Paket R1 (Entscheidungen)

- **Tokens und Themes:** Alle Farben, Radien und Abstände aus DESIGN.md stehen als CSS-Variablen in `src/ui/tokens.css`; `app.css` nutzt nur diese. Hell ist der Grundwert. Dunkel gilt bei `prefers-color-scheme: dark` ohne Wahl „Hell“ und bei Wahl „Dunkel“ (`data-theme` an `<html>`). Die dunklen Werte stehen deshalb zweimal (kein `light-dark()`, weil iPhones vor iOS 17.5 es nicht kennen); `tokens.test.ts` prüft, dass beide Blöcke gleich sind, und rechnet für jede verwendete Farbkombination in beiden Themes den Kontrast nach (Text 4,5:1, Rahmen, Fokus und Symbole 3:1). Neue Kombinationen kommen dort in die Liste. Vitest liest dafür `tokens.css?raw` (`test.css.include` in `vite.config.ts`).
- **Abweichung vom Entwurf:** `--control-border` ist dunkler (#7A8494 / #6E7789 statt #C9CFD8 / #4A5160), weil Bedienelemente 3:1 zur Umgebung brauchen (WCAG 1.4.11); DESIGN.md ist angepasst. Ergänzt sind `--on-accent-tile`, `--on-warn-tile`, `--warn-tile-action`/`--on-warn-tile-action` (Knöpfe auf Orange in beiden Themes dunkel mit weißer Schrift, wie im Entwurf) und `--backdrop`, `--shadow-float`. Hauptknöpfe nutzen `--accent-tile` mit weißer Schrift, weil Weiß auf dem hellen Dunkel-Akzent #8FA8FF zu schwach wäre.
- **Farbschema N8:** `DeviceSettings.colorScheme` (`light | dark | auto`, fehlt = `auto`), gespeichert mit „Ich bin“ unter `putzplan:device`, also nicht im Export. `loadDevice` prüft beide Werte einzeln; ein unlesbarer Wert fällt weg, der andere bleibt. `applyColorScheme` (`src/ui/colorScheme.ts`) setzt oder entfernt `data-theme`. Gegen das Aufblitzen setzt ein kleines Skript in `index.html` das Attribut vor dem ersten Zeichnen; den Speicherbereich wählt es über `%MODE%` (Vite ersetzt das, `demo` → `putzplan-demo`). Die Einstellung steht als zweite Kachel „Darstellung“ auf der Seite Einstellungen und wirkt sofort beim Wählen; scheitert das Speichern, bleibt das alte Farbschema und die Auswahl springt zurück.
- **Schrift und Symbole:** `@fontsource-variable/archivo/wght.css` in `main.tsx`; Vite liefert die woff2-Dateien mit aus. Symbole aus `lucide-preact`, je Stelle einzeln importiert. Der JS-Build wuchs dadurch auf ca. 68 KB (23 KB gzip).
- **Rahmen:** Ein DOM für Handy und PC, das CSS ordnet um (keine doppelten Inhalte für Screenreader). Unter 900 px: oben Name und „Ich bin“, die Navigation als feste Leiste unten (Symbol + Text), `main` mit Platz nach unten. Ab 900 px: Spalte links (Name, Navigation, „Ich bin“ unten), aktive Seite invers. Die Skip-Schaltfläche bleibt der erste Tabulator-Stopp.
- **Bausteine:** Klassen `tile`, `btn` (`--primary`, `--secondary` auf Kacheln, `--quiet` auf dem Seitenhintergrund, `--warn` für Bestätigen beim Löschen, `--text-warn`), `icon-btn`, `segmented`, Felder `field`/`input`/`choices`. Fehlermeldungen über `components/Alert.tsx` (`ErrorAlert`, `role="alert"`). Radio-Kreise werden aus den Tokens gezeichnet (3:1 in beiden Themes); im Windows-Kontrastmodus (`forced-colors`) zeigt der Browser seine eigenen. Fokus: 3 px `--accent` mit 2 px Abstand, auf Orange und auf dem dunklen Hinweis in der jeweiligen Textfarbe.
- **Wochenübersicht als Kachel-Board:** `PageTitle` hat dafür `heading`: Die `h1` nennt die Woche („Diese Woche“, „Nächste Woche“, „Letzte Woche“, „In/Vor N Wochen“, `weekTitle`), der Tab-Titel bleibt „Wochenübersicht“ und der Fokus springt beim Blättern nicht. Darüber steht die Kalenderwoche (`formatWeekLabel`, ISO-Woche aus `isoWeek` in `date.ts`) als `role="status"`, wird also beim Blättern vorgelesen; im DOM steht sie nach der `h1`. Kacheln: Tageskachel (ein Tag mit Symbol, Titel, „Person · Rhythmus“, Fortschritt der Checkliste, Abhak-Knopf 44 px), „Überfällig“ (älteste sichtbar, „+ N weitere anzeigen“ mit `aria-expanded` klappt die übrigen auf, am Handy dann über die ganze Breite), „Stand“ (`weekView(...).progress`, sichtbar „6 / 14“, vorgelesen „6 von 14“) und „Woche im Überblick“ (sieben Tagesknöpfe mit `aria-pressed`, heute mit `aria-current="date"`; Name z. B. „Mi 21. 2 Aufgaben“). Ein gewählter Tag nimmt den Fokus auf die Überschrift der Tageskachel. Ab 900 px stehen unter jedem Tagesknopf die Aufgaben als Chips, in einem waagerecht scrollbaren Bereich (mind. 840 px). Tagesknöpfe sind mindestens 44 px breit; auf sehr schmalen Handys scrollt die Tagesleiste.
- **Filter:** Statt Radio-Gruppe ein Segment-Schalter „Alle / Nur meine“ aus zwei Schaltflächen mit `aria-pressed` in einem `fieldset` (Legende „Aufgaben filtern“, nur für Screenreader), wie im Entwurf.
- **„Neue Aufgabe“:** ein einziger Link, am PC Knopf im Wochenkopf, am Handy schwebender Knopf (60 px, fest über der Leiste, Text nur für Screenreader).
- **Hinweis nach dem Abhaken:** bleibt wie in Paket 9 (Fokus, kein Zeitablauf, kein `role="status"`), jetzt als dunkler Streifen über den Kacheln. DESIGN.md wünscht „kurz“ und `role="status"`; wegen WCAG 2.2.1 und weil die gedrückte Schaltfläche verschwindet, bleibt es beim Fokus (in ANFORDERUNGEN Abschnitt 9 bestätigt).
- **Symbol pro Aufgabe:** `components/TaskSymbol.tsx` zeigt bis R2 für alle Aufgaben das Standardsymbol (Haus, Ton Blau).
- **Bewegung:** nur kurze Übergänge (Hinweis 160 ms, Abhak-Symbol bei Hover/Fokus, Drücken), alles aus bei `prefers-reduced-motion`. Keine Farbübergänge, damit ein Themewechsel sofort vollständig ist.
- **Tests:** `expectNoAccessibilityViolations` (`tests/e2e/axe.ts`) prüft jede Seite nacheinander im hellen und im dunklen Farbschema (über `emulateMedia`) und schaltet dabei Animationen ab. Neu `tests/e2e/design.spec.ts` (Farbschema, kein Aufblitzen, Schrift ohne Drittanbieter, Navigation unten/links, Fokusrahmen, Tippflächen ≥ 44 px); `week.spec.ts` auf das Kachel-Board umgeschrieben. Biome prüft jetzt auch HTML; die Entwürfe in `docs/design/` sind davon ausgenommen.

## 9. Plan Paket R2 „Symbole pro Aufgabe“ (F8)

Noch nicht umgesetzt. Keine neue Abhängigkeit (Lucide ist da).

- **Liste:** `src/domain/taskSymbols.ts` mit ca. 20 Einträgen `{ id, label, tone }`, z. B. Mülleimer, Pflanze, Einkaufswagen, Badewanne, Dusche, Waschmaschine, Hemd, Bett, Kochtopf, Besteck, Kühlschrank, Sprühflasche, Besen, Recycling, Paket, Geschenk, Telefon, Pfote, Auto, Werkzeug, dazu „Standard“ (Haus). Fachlogik kennt nur `id`, `label` und `tone` (`blue | green | orange`); die Zuordnung `id → Lucide-Komponente` liegt in `src/ui/`. Die Farbtöne stehen in `tokens.css` und `tokens.test.ts`.
- **Datenmodell:** jede Aufgabe trägt `symbol: TaskSymbolId`. `checkTaskForm`/`taskFromForm`/`updateTask` nehmen das Symbol auf; unbekannte IDs lehnt `parseAppData` mit Fundstelle ab.
- **schemaVersion 2 und Migration:** `SCHEMA_VERSION = 2`. Neue reine Funktion `migrateAppData(raw)` vor `parseAppData`: Version 1 → 2 setzt bei jeder Aufgabe `symbol: "standard"` und ändert sonst nichts; Version 2 bleibt; fehlende, ungültige oder neuere Versionen werden wie bisher mit Meldung abgelehnt. Gilt beim Laden aus dem Speicher (gespeichert wird beim nächsten Speichern als Version 2, die Rohdaten bleiben bis dahin unverändert) und beim Import alter Sicherungen; Export schreibt Version 2. `demoData` liefert Version 2 mit passenden Symbolen.
- **Oberfläche:** neues Feld „Symbol“ im Aufgabenformular nach dem Titel: Radio-Gruppe mit sichtbarer Legende, je Symbol eine 44-px-Kachel mit Symbol und zugänglichem Namen (Bezeichnung als Text, nicht nur Bild), Vorbelegung „Standard“, Pfeiltasten wie bei Radios. `TaskSymbol` zeigt das gewählte Symbol in Tageskachel, Überfällig-Kachel (rechts oben, wie im Entwurf), Chips und Aufgabenliste.
- **Tests:** Unit: Migration 1 → 2 (Symbol gesetzt, alles andere gleich, zweimal migrieren ändert nichts), Version 2 unverändert, neuere und fehlende Version abgelehnt, unbekanntes Symbol mit Fundstelle abgelehnt, Import einer Sicherung der Version 1, Laden von Version-1-Daten aus dem Speicher, Formularprüfung mit Symbol; Liste: eindeutige IDs, jeder Ton hat Token-Farben. E2E: Symbol wählen (Maus und Tastatur), Anzeige in Woche und Liste, Bearbeiten ändert das Symbol, alte Daten (Version 1) im Speicher laden und zeigen das Standardsymbol, axe in beiden Themes.
- **Doku:** ANFORDERUNGEN F8 von „geplant“ auf umgesetzt, Abschnitt 9 nur mit nutzerrelevanten Entscheidungen; `CLAUDE.md` (Migration, Symbol-Liste).

## 10. Hinweise

- Safari auf dem iPhone löscht Website-Daten nach 7 Tagen ohne Nutzung, wenn die App nicht installiert ist. Export (F7) regelmäßig nutzen.
- Die Daten liegen pro Browser und Gerät getrennt; gemeinsame Daten erst ab Etappe 2.
