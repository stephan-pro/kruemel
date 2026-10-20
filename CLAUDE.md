# Krümel – Hinweise für Claude

Haushalts-App für zwei Personen. **Name:** Der Anzeigename ist ab sofort „Krümel“ (Entscheidung des PO, 20.10.2026), im Code und in Dateinamen `kruemel`. Umgesetzt in E2-0b (20.10.2026): Repository `kruemel`, Adresse `/kruemel/`, Texte, Manifest, Seitentitel, Dateinamen der Sicherung. Der Projektordner heißt lokal noch `putzplan`; das Symbol bleibt bis E2-4 (dann `docs/design/kruemel-icon.svg`). **Bewusst unverändert** sind die Speicherschlüssel `putzplan:data`, `putzplan:device`, `putzplan-demo` (Browser-Speicher gehört zur Herkunft `stephan-pro.github.io`, die Daten der Geräte bleiben so sichtbar) und die Altlast-Bereinigung `putzplan-` im Service Worker; nicht ändern ohne Migration. Der Krümel (Figur) bleibt goldbraun und rund, nie blau oder zottelig. Preact + TypeScript (strict), Vite, läuft rein im Browser.
Anforderungen: `docs/ANFORDERUNGEN.md` · Plan und Arbeitspakete: `docs/PLAN.md` · Etappe 2 (gemeinsam, Supabase; Pakete `E2-0` bis `E2-5`): `docs/ETAPPE2-PLAN.md` und `docs/ETAPPE2.md` · Design: `docs/design/DESIGN.md` (die `entwurf-*.html` dort sind nur Referenz, nicht lauffähig).

## Befehle

- **Nach Änderungen `npm run check` ausführen und nur die Kurzausgabe lesen** (bei Erfolg eine Zeile, bei Fehlern nur die fehlgeschlagenen Tests mit Datei, Zeile und Meldung). Testdateien und Reports nicht komplett lesen; Traces und Berichte liegen nur auf der Platte (`test-results/`, `playwright-report/`).
- `npm run check` – alles prüfen (Biome → tsc → Vitest mit Abdeckung → Build → Playwright nur in Chromium/Desktop). Muss grün sein; läuft bei jedem Push in CI.
- `npm run check:full` – dasselbe, E2E in der vollen Matrix (zusätzlich `chromium-mobile`, `webkit-desktop`, `webkit-mobile`; dort nur `smoke`, `phone`, `pwa`, `install`, `design`, `accessibility`, Liste `CROSS_BROWSER_SPECS` in `playwright.config.ts`). CI: Workflow `check-full.yml` nachts und von Hand; vor einem Release ausführen. Neue Tests laufen nur in Chromium/Desktop, außer die Datei gehört in diese Liste (browser- oder größenabhängig). Die axe-Prüfung der Hauptseiten steht in `smoke.spec.ts`.
- `npm run dev` – Entwicklungsserver.
- `npm run demo` – App mit Beispieldaten (eigener Speicherbereich `putzplan-demo`) im Browser.
- `npm test` – Vitest im Beobachtungsmodus.
- `npm run e2e` – nur Playwright (braucht vorher `npm run build` und `npm run build:e2e`).
- `npm run build:e2e` – baut die App im Modus `e2e` (gemeinsamer Speicher gegen den Fake-Server) und den Fake-Server (Etappe 2).
- `npm run setup` – erstes Einrichten (Pakete + Playwright-Browser).
- `npm run icons` – zeichnet die PNG-App-Symbole in `public/` neu (nur nach Änderung des Symbols).

- `npm run check:db` – (Etappe 2, ab E2-1) Datenbank-Regeln und Anmeldung gegen eine lokale Supabase-Instanz in Docker. **Läuft nur in CI** (Job `db`); der PO hat kein Docker, lokal meldet der Befehl das und bricht ab.
- `/paket <Nummer oder E2-N> [Hinweise]` – Projekt-Skill (`.claude/skills/paket/SKILL.md`): setzt ein Arbeitspaket aus `docs/PLAN.md` (Pakete 1–13, R1, R2) bzw. `docs/ETAPPE2-PLAN.md` (E2-0 bis E2-5, E2-4a/E2-4b) komplett um, bis `npm run check` lokal und auf GitHub grün (ab E2-1 auch der Job `db`) und die Online-Version veröffentlicht ist.

## Aufbau

- **Abdeckung:** ≥ 90 % (Vitest-Schwelle) für `src/domain/`, `src/storage/`, `src/demo/`, `src/sync/`, `src/auth/`, `src/backend.ts`. Für `src/ui/` keine Prozentvorgabe; dort zählen E2E-Szenarien für die wichtigen Abläufe. Keine Zahlenfüller-Tests (triviale Getter, doppelte Fälle): Fälle in einem Test bündeln statt neuer Tests für denselben Zweig.
- `src/domain/` – Fachlogik, reine Funktionen, Tests `*.test.ts` daneben, Abdeckung ≥ 90 %. `week.ts` (`weekView`: Wochenübersicht F6), `taskManagement.ts` (Liste, Löschen, `completeInData`/`undoInData`), `taskSymbols.ts` (feste Symbol-Liste F8 mit Ton; jede Aufgabe hat `symbol`, Standard `standard`).
- `src/storage/` – `AppStorage`-Schnittstelle, localStorage-Umsetzung, Prüfung (`parseAppData`), Export/Import (`exportData`, `importData`, Dateinamen, `importSizeError`). Tests daneben, Abdeckung ≥ 90 % wie `src/domain/`. `migrate.ts` (`migrateAppData`): bringt ältere `schemaVersion` auf den aktuellen Stand (jetzt 3), läuft als erster Schritt von `parseAppData`, also beim Laden und Import. Ändert sich das Speicherformat: `SCHEMA_VERSION` erhöhen, Migrationsschritt ergänzen, Tests mit alten Daten (`asVersion1`, `asVersion2`, `withoutVersion3Fields` in `storage.fixtures.ts`). `AppStorage` (`storage.ts`) hat seit E2-0 zusätzlich `subscribe` und `syncStatus`; `save` gibt die anzuzeigenden Daten zurück.
- `src/demo/` – Beispieldaten relativ zu „heute“ (`demoData`), Befüllen des Demo-Speichers; nur im Modus `demo` geladen. Abdeckung ≥ 90 % wie `src/domain/`.
- `src/ui/` – Preact-Komponenten (`pages/`, `components/`), `App.tsx` (Laden, Zustände, Speichern, Farbschema, Rahmen), `route.ts` (Hash-Router, Seiten und Titel, auch `#/aufgaben/neu` und `#/aufgaben/bearbeiten/<id>`), `format.ts` (Datum, KW, Rhythmus, Zuständigkeit, Hinweistexte auf Deutsch), `useToday.ts` („heute“, rückt über Mitternacht weiter), `pages/WeekPage.tsx` (Wochenübersicht als Kachel-Board mit Abhaken/Rückgängig, Übernehmen, Checkliste und Detailansicht), `colorScheme.ts` (`data-theme`; dasselbe macht das Skript in `index.html` vor dem ersten Zeichnen). Jede Seite hat eine `PageTitle`-`h1` (setzt Tab-Titel, nimmt den Fokus; `heading` für eine abweichende Überschrift).
- Design: `tokens.css` (CSS-Variablen hell/dunkel nach DESIGN.md), `app.css` (alle Bausteine, nur Tokens, keine festen Farben). `tokens.test.ts` prüft die Kontraste jeder verwendeten Kombination in beiden Themes – neue Kombinationen dort eintragen. Symbole aus `lucide-preact` (einzeln importieren), Schrift `@fontsource-variable/archivo`. Klassen: `tile`, `btn btn--primary|secondary|quiet|warn`, `icon-btn`, `segmented`; Fehler über `components/Alert.tsx` (`ErrorAlert`).
- Formulare bauen auf `components/fields.tsx` (`TextField`, `TextAreaField`, `SelectField`, `RadioGroup`, `FieldGroup`): sichtbare Beschriftung, Meldung direkt am Feld, nach dem Absenden mit Fehlern Fokus auf das erste fehlerhafte Feld. Löschen immer über `DeleteTaskDialog` (Rückfrage). Symbole: Anzeige über `components/TaskSymbol.tsx` (`tile`/`small`/`plain`, Bildzuordnung `id → Lucide`), Auswahl über `components/SymbolField.tsx` (Raster mit 7/6/3 Spalten über `@container`, hängt an den 21 Symbolen: bei anderer Zahl Spalten neu wählen).
- Fenster: `components/Modal.tsx` (natives `<dialog>`, Escape → `onCancel`), darauf `ConfirmDialog` (Rückfrage, `tone`, `initialFocusId`), `DeleteTaskDialog`, `TakeOverDialog` (Übernehmen: nur dieses Mal / dauerhaft) und `TaskDetailDialog` (Detailansicht einer Aufgabe der Wochenübersicht). Den Knopf, der ein Fenster öffnet, merkt sich die Seite (`event.currentTarget`) und fokussiert ihn nach dem Schließen selbst (Safari fokussiert Knöpfe beim Klick nicht). Checkliste: `components/ChecklistToggles.tsx` (Kästchen in Zeile und Detailansicht), `components/ChecklistEditor.tsx` (Einträge im Aufgabenformular). Aufgaben in der Wochenübersicht sind Knöpfe (`data-task-open`, Name = ihr ganzer Text). `pages/DonePage.tsx` („Erledigt“: Kachel mit Zeilen `done-row`, „Rückgängig: Titel“ nur beim letzten Durchgang einer Aufgabe, Hinweis `section` „Hinweis“ mit Fokus) und `components/BackupTile.tsx` (Kachel „Sicherung“ in den Einstellungen: Download, Einspielen über verborgenes `<input type="file">`, `ConfirmDialog`, automatische Kopie `putzplan-vor-import-…json` vor dem Ersetzen; Fehler mit Fundstelle, Daten bleiben unberührt).
- PWA (Paket 12): `public/` (Manifest, Symbole; PNGs zeichnet `npm run icons` aus `icon.svg`), `src/sw.ts` (Service Worker; das Vite-Plugin `serviceWorker()` in `vite.config.ts` baut ihn als `sw.js` und trägt die Dateiliste ein; ändert sich eine Datei in `public/`, `PUBLIC_FILES` dort nachführen), `src/registerServiceWorker.ts` (nur im echten Build), `colorScheme.ts` (`THEME_COLORS`, `applyThemeColor`: Farbe der Leiste, die Hex-Werte stehen zusätzlich in `index.html` und im Manifest, `pwa.test.ts` prüft sie gegen `tokens.css`). Seitenränder über `--gutter-left/-right` (Aussparung). Wochenübersicht: `.week-board` ist ein Raster, „Überfällig“ ist die erste Kachel (am Handy ohne Scrollen im Bild, `phone.spec.ts`).
- Installieren und Version (Paket 13): `install.ts` (`installWay` rein: `installed | prompt | ios | firefoxAndroid | other`; `watchInstallPrompt` in `main.tsx` fängt `beforeinstallprompt`; `useInstallWay`), `components/InstallHint.tsx` (Hinweis „Krümel als App“ am Ende der Woche, × speichert `installHintDismissed` in `DeviceSettings`), `InstallSteps.tsx` (bebilderte Anleitung), Kacheln `InstallTile`, `OtherDeviceTile` (QR-Code über `qrCode.ts` mit `uqr`, per `import()` nachgeladen), `VersionTile` (`appInfo.ts`: `__APP_BUILD__` aus `vite.config.ts`, Commit über `APP_COMMIT` im Workflow `pages`; `appAddress`). Windows-Kontrastmodus: Block `@media (forced-colors: active)` am Ende von `app.css`.
- `.github/workflows/` – `check.yml` (npm run check bei Push/PR), `pages.yml` (veröffentlicht `main` auf GitHub Pages nach grünem check): https://stephan-pro.github.io/kruemel/
- `tests/e2e/` – Playwright-Tests, jede Seite mit axe (`axe.ts`: `expectNoAccessibilityViolations` prüft hell und dunkel). `app.spec.ts`: Einrichtung, Navigation, Einstellungen, unlesbare Daten. `design.spec.ts`: Farbschema N8, Schrift, Navigation, Fokus, Tippflächen. Die Wochenübersicht heißt in der `h1` „Diese Woche“, der Tab-Titel bleibt „Wochenübersicht – Krümel“. Der erste Start zeigt die Ersteinrichtung; für eine fertig eingerichtete App Daten vorher in den Speicher schreiben (siehe `startConfigured`).
- `tests/e2e/helpers.ts` – gemeinsame Hilfen (`startConfigured`, `storedData`, `goToPage`; für die Wochenübersicht `openWeek` mit eingefrorener Uhr auf Mi 21.10.2026, `tile`/`todayTile`/`overdueTile`, `notice`, `taskButton`, `chooseDay`, `detailDialog`, `detailValue`). Nach einem Seitenwechsel vor dem Tippen auf den Fokus der Überschrift warten (`goToPage`/`expectPageShown`), sonst nimmt der Fokussprung dem Test den Fokus. `tests/e2e/tasks.spec.ts`: Aufgaben anlegen, bearbeiten, löschen, Formularfehler.
- `tests/e2e/week.spec.ts` – Wochenübersicht; friert die Browser-Uhr auf Mi 21.10.2026 ein (`page.clock.setFixedTime`), damit `demoData(21.10.2026)` feste Wochentage hat (Überfälliges, nächste/letzte Woche).
- `tests/e2e/symbols.spec.ts` – Symbole F8 (Auswahl, Raster, Anzeige, alte Daten Version 1); das gezeigte Symbol steht in `data-symbol`.
- `tests/e2e/details.spec.ts` (Detailansicht F6), `takeover.spec.ts` (Übernehmen F5), `checklist.spec.ts` (Checkliste F4 in Zeile und Formular) – am Handy ist die Checkliste einer Zeile erst nach „Checkliste“ sichtbar (`showChecklist` in `checklist.spec.ts`).
- `tests/e2e/done.spec.ts` (Erledigt F3, Rückgängig F2) und `backup.spec.ts` (Sicherung F7: Dateiwähler über `chooseBackup`/`textFile` aus `helpers.ts`, Downloads über `waitForEvent("download")`, Inhalt per `fetch(download.url())` im Browser lesen).
- `tests/e2e/pwa.spec.ts` (Manifest, Leistenfarbe, Service Worker, Betrieb ohne Netz mit `context.setOffline`; `startInstalled` wartet auf `navigator.serviceWorker.ready`, sonst verwirft WebKit die Installation) und `phone.spec.ts` (Wochenübersicht bei 360 × 640 und 390 × 844, Raster am PC). `docs/GERAETETEST.md` – Checkliste für echte Geräte (iPhone, Android) mit Ergebnis von Etappe 1. `docs/ETAPPE2.md` – Prüfliste für Etappe 2 (S1–S6).
- `tests/e2e/install.spec.ts` (Installationshilfe, QR-Code, Version; spielt den Browser: `offerInstall` löst `beforeinstallprompt` aus, `test.use({ userAgent })` für iPhone/Firefox, `navigator.standalone` per Init-Skript) und `accessibility.spec.ts` (nur Chromium: Tastatur-Ablauf mit `tabTo`, Kontrastmodus über `emulateMedia({ forcedColors: "active" })`). Im Projekt webkit-mobile (iPhone-Kennung) steht der Installationshinweis unter jeder Woche.
- `tests/e2e/demo.spec.ts` – prüft den Demo-Modus; Playwright startet dafür einen zweiten Server (`vite --mode demo`, Port 4174). Spätere E2E-Tests nehmen `demoData(heute)` als Ausgangslage.
- **Etappe 2 (seit E2-0 teilweise da, der Rest entsteht mit E2-1 bis E2-5):**
  - `src/sync/` (Abdeckung ≥ 90 % wie `src/domain/`): `changes.ts` (`Change`, `diffData` leitet aus alten und neuen `AppData` Änderungen ab, `applyChange` führt eine aus und sagt, ob der Server sie annähme; Gerät **und** Fake-Server nutzen dieselbe Funktion, hier stehen die Konfliktregeln), `merge.ts` (`mergeDelta`, `viewOf`), `outbox.ts` (`SyncStateStore`: Kopie, Abrufstand und Warteschlange in einem `localStorage`-Eintrag `kruemel:sync`), `locks.ts` (Web Locks / im Tab), `triggers.ts` (online, sichtbar, Speicher-Ereignis), `remote.ts` (Schnittstelle `Remote`, `RemoteError`), `fakeHousehold.ts` (Server eines Haushalts im Speicher), `fakeRemote.ts`, `fakeServer.ts`, `fakeHttpRemote.ts`, `syncedStorage.ts` (`createSyncedStorage`: lokal zuerst, `sync()`, `start()`, `replaceAll`), `browserFake.ts` (nur Modus `e2e`, nicht in der Abdeckung). `supabaseRemote.ts` folgt in E2-3. Testhilfen: `sync.fixtures.ts` (`household()` mit zwei Geräten), `remote.contract.ts` (`describeRemoteContract`: eine Testreihe für jedes `Remote`).
  - `src/auth/`: Schnittstelle `Auth`, `FakeAuth` im Speicher (`lastCode` statt E-Mail). Die Umsetzung für Supabase folgt in E2-2.
  - `src/backend.ts`: `backendMode` (`local | fake | supabase`, `VITE_BACKEND`; sonst Build-Modus `e2e` → `fake`). `vite.config.ts` macht daraus `__BACKEND__`, `main.tsx` verzweigt darauf, der Code der anderen Modi steht nicht im Build.
  - `scripts/fake-server.ts` (HTTP vor `FakeServer`, Port 4180) und `npm run build:e2e` (App im Modus `e2e` nach `dist-e2e`, Port 4175; Fake-Server als SSR-Build nach `dist-fake`, weil die Quelldateien ohne Dateiendung importieren). `npm run e2e` braucht zusätzlich zum Build `npm run build:e2e`. `scripts/node-http.d.ts` tippt das eine Node-Modul, statt `@types/node` zu holen.
  - E2E gegen den Fake-Server: `tests/e2e/fakeserver.spec.ts` (zwei Browser als zwei Geräte über `openDevice`: Geheimnis der Person steht unter `kruemel-fake:session` im Browser-Speicher, Haushalt per `POST /test/household`), Adressen in `tests/e2e/shared.ts`. Die übrigen E2E-Tests laufen noch gegen den Modus `local` (Umstellung auf den Fake-Server in E2-3).
  - Ausstehend: `supabase/` (`config.toml`, `migrations/`), `check:db`, die Anmeldeseiten.
  - `npm run check` braucht weder Docker noch Internet noch Zugangsdaten; die Datenbank-Tests laufen nur in CI (`check:db`). Der Service-Role-Key, das App-Passwort des Gmail-Kontos und der Zugang zum Projekt kommen nie ins Repo; öffentlich sind nur `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY`. Die Online-Version bleibt bis zum Ende von E2-3 bei Etappe 1 (`VITE_BACKEND=local`).
- `scripts/check.mjs` – Ablauf von `npm run check`.
- `.githooks/pre-commit` – Geheimnis-Suche (`scripts/scan-secrets.mjs`, nur die gestagten Änderungen, Bruchteil einer Sekunde; nie über den Verlauf) und Biome auf gestagte Dateien.
- **Doku-Aufwand:** Ein Paket ändert in `docs/PLAN.md` nur eine Zeile (Status + Datum). `docs/ETAPPE2.md`, `docs/ANFORDERUNGEN.md` und die „Umsetzung Paket“-Abschnitte werden nur am Ende einer Etappe ausführlich nachgeführt (Ausnahmen im `/paket`-Skill, Abschnitt 4).

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
| Export / Import (Sicherung herunterladen / einspielen) | exportData / importData |
| automatische Sicherung (vor dem Einspielen) | autoBackup (`autoBackupFileName`) |
| Erledigt (Liste) | done (`doneEntries`, `DonePage`) |
| Gerät (nicht in der Sicherung) | device (`DeviceSettings`) |
| Darstellung / Farbschema (Hell, Dunkel, Automatisch) | colorScheme (`light`, `dark`, `auto`) |
| Stand (erledigt / fällig) | progress (`done`, `due`) |
| Symbol (einer Aufgabe, ab R2) | symbol |
| Detailansicht (einer Aufgabe) | taskDetail (`TaskDetailDialog`) |
| App installieren / Hinweis „Krümel als App“ | install (`installWay`), installHint (`installHintDismissed`) |
| Auf anderem Gerät öffnen (QR-Code) | otherDevice (`OtherDeviceTile`, `qrPicture`, `appAddress`) |
| Version (Stand) | build (`APP_BUILD`, `formatBuild`) |
| Krümel (App-Name und Figur, ab E2-3/E2-4) | kruemel |
| Haushalt (Etappe 2) | household |
| Einladung | invite |
| Anmeldung / Abmelden | signIn / signOut |
| Einmalcode (per E-Mail) | code (`otp` nur in Namen der Anmeldebibliothek) |
| Abgleich | sync |
| ausstehende Änderungen (Warteschlange) | outbox / pending |
| Abgleichsstand (Alles übertragen / Offline …) | syncStatus |
| Statistik (Seite, Berechnung) | statistics |
