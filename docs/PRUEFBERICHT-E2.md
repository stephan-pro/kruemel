# Krümel – Prüfbericht Etappe 2 (E2-5d)

Stand 23.10.2026, Commit `6069d72`. Drei unabhängige Prüf-Agenten (nur lesen) für Sicherheit, Barrierefreiheit und Texte; die Datenschutz-Liste hat der Hauptlauf erstellt. Statische Prüfung am Code, nichts geändert, keine Tests ausgeführt (außer `npm audit` und `scan-secrets`). Behebung im Korrekturpaket K2. Schwere: kritisch, hoch, mittel, niedrig. Aufwand: klein (S), mittel (M), groß (L).

## Zusammenfassung: die 10 wichtigsten Funde

Nichts ist kritisch. Datenbank-Regeln, Einladungen und Geheimnisse sind in Ordnung.

| # | Schwere | Bereich | Fund | Aufwand |
|---|---|---|---|---|
| 1 | hoch | Sicherheit | `pages.yml` startet auch nach einem grünen `check` eines fremden Pull Requests von einem Branch namens `main` und veröffentlicht dann fremden Code | S |
| 2 | hoch | Texte | „Auf anderem Gerät öffnen“ empfiehlt, Daten per Sicherung zu übertragen. Online ersetzt das die Daten für beide | S |
| 3 | hoch | Texte | Der iPhone-Hinweis in `InstallSteps` empfiehlt dasselbe | S |
| 4 | hoch | Texte | „Einladungslink erzeugen“ steht zweimal (Haushalt und Freunde). Ein falscher Link führt in einen leeren Haushalt | S |
| 5 | hoch | Barrierefreiheit | Am Handy und bei 200 % Zoom kann der Tastaturfokus unter der schwebenden Navigation verschwinden (WCAG 2.4.11) | S |
| 6 | mittel | Barrierefreiheit | Rückfragen lesen ihre Erklärung nicht vor (`aria-describedby` fehlt) | S |
| 7 | mittel | Barrierefreiheit | Ein Fehler am Feld wird nicht angesagt, wenn das Feld schon den Fokus hat (außer bei der Anmeldung) | S–M |
| 8 | mittel | Texte | Fachbegriffe und Rohtexte in Meldungen: „Server“, „JSON“, `schemaVersion`, `tasks[0].assignee`, englische Fehlertexte | M |
| 9 | mittel | Barrierefreiheit | Die Statuszeile des Abgleichs liest bei jeder Änderung alles neu vor | M |
| 10 | niedrig | Sicherheit | Der Server prüft den Aufbau der Aufgaben nicht. Ein böswilliges Mitglied kann das Gerät der anderen Person blockieren | M |

## 1. Sicherheit und Zugriffsregeln

| Schwere | Fundstelle | Beschreibung | Empfehlung | Aufwand |
|---|---|---|---|---|
| hoch | `.github/workflows/pages.yml:5-8, 24, 34` | `workflow_run` filtert nur nach dem Branch-Namen. Ein Fork-PR aus einem Branch `main` löst nach grünem `check` die Veröffentlichung aus, und zwar mit `head_sha` des Forks. Fremder Code könnte dann die Anmeldung aus dem Browser-Speicher lesen. Einzige Hürde: die Freigabe von Fork-Läufen | `if:` zusätzlich `workflow_run.event == 'push'` und `head_repository.full_name == github.repository`. PO: Actions → „Require approval for all outside collaborators“ | S |
| niedrig ✅ K2c (Migration von dir einzuspielen) | `20261020120000_household.sql:758-759` | Realtime schickt Lösch-Ereignisse ohne Zeilenschutz an alle Angemeldeten. Betroffen sind nur zufällige IDs. `household_members` wird von der App gar nicht abonniert (`supabaseRemote.ts:134`). Bestätigt den Vermerk aus E2-5a | Neue Migration: `household_members` aus der Publikation nehmen. Der Rest ist vertretbar | S |
| niedrig | `household.sql:233ff., 519ff.`; `sync.sql:226ff.` | Aufgaben werden nur als JSON-Objekt geprüft (64 KB), bei `replace_household_data` nicht einmal das. Die Anzahl ist unbegrenzt. Ein Mitglied kann per direktem Aufruf kaputte Aufgaben einspielen; `mergeDelta` übernimmt sie, und beim nächsten Laden meldet das andere Gerät „Kopie beschädigt“. Datenbank füllen ist ebenfalls möglich | Zeilen in `mergeDelta` einzeln prüfen und ungültige verwerfen; serverseitige Obergrenzen je Haushalt | M |
| niedrig | `friend_invites.sql:118-141`, `supabaseAuth.ts:167` | An der Antwort lässt sich erkennen, ob eine Adresse ein Konto hat (`invite_required` gegenüber Code verschickt). Bekannt; für zwei Personen vertretbar | Akzeptieren, im README nennen | – |
| niedrig ✅ K2c (Prüfliste, Schritt 5) | Dashboard, `SUPABASE.md:27` | Ein 6-stelliger Code ist nur über die Rate Limits des Projekts gegen Durchprobieren geschützt | PO: „Token verifications“ ansehen und in `SUPABASE.md` notieren | S |
| niedrig | `friend_invites.sql:65-77` | Grenzen gelten je Person. Die Zahl der Konten kann über Freundesketten trotzdem unbegrenzt wachsen. Ein Freundes-Link ist schon beim Anfordern des Codes verbraucht | Akzeptieren oder globale Obergrenze. Verbrauch erst beim Einlösen prüfen | M |
| niedrig | `.gitignore:10-11` | `.env` und `.env.production` sind nicht ignoriert. Nur der pre-commit-Hook schützt, und der gilt nur auf diesem Rechner | `.env` und `.env.*` ignorieren, `!.env.example` | S |
| niedrig ✅ K2c | alle Workflows | Actions sind per Tag angeheftet, nicht per SHA (nur Actions von GitHub) | Optional SHA oder Dependabot für Actions | S |
| niedrig | `src/csp.ts` (Hauptlauf) | Eine CSP im `<meta>`-Tag kann kein `frame-ancestors` setzen, GitHub Pages erlaubt keine Header. Die App ließe sich also einbetten (Clickjacking) | Akzeptieren; optional Frame-Busting per Skript | S |
| zu prüfen ✅ K2c (Prüfliste, Schritt 11) | Dashboard Realtime | Steht „Allow public access“ für Broadcast/Presence an? | PO: auf „private channels only“ prüfen | S |

**In Ordnung:** RLS auf allen 6 Tabellen, nur SELECT für Mitglieder, Schreiben nur über Funktionen. Alle `security definer` haben `search_path = ''` und kein dynamisches SQL. Rechte sind je Migration explizit gesetzt, `anon` darf nur `ping` aufrufen, den Hook nur `supabase_auth_admin`. `remove_member`, `leave_household` und `delete_account` betreffen nur `auth.uid()` bzw. den eigenen Haushalt. Einladungen haben 192 Bit Zufall, laufen nach 7 Tagen ab, gelten einmal (`for update`) und liegen im Hash der Adresse (kein Referrer, per `replaceState` entfernt). Klartext in der Tabelle ist bei RLS vertretbar. Geheimnisse: `scan-secrets` und Suche in der Historie ohne Fund, nie eine `.env` eingecheckt. `checkPublishableKey` lässt nur `sb_publishable_` zu. Die CSP ist ohne `unsafe-*`. Der Service Worker cached nur Build-Dateien. Abmelden und Konto löschen entfernen Sitzung, Kopie und Warteschlange. Kein `innerHTML`; Import mit 5 MB Grenze und ohne Prototype Pollution. Workflows mit `contents: read`, kein `pull_request_target`. `npm audit`: 0 Funde.

## 2. Barrierefreiheit (WCAG 2.1 AA laut N2, dazu 2.2 wo sinnvoll)

| Schwere | Fundstelle | Beschreibung | Empfehlung | Aufwand |
|---|---|---|---|---|
| hoch | `app.css:302-316` | Die Navigation (`position: fixed`, rund 86 px) verdeckt beim Tabben Knöpfe am unteren Rand (2.4.11) | `scroll-padding-bottom` auf `html`, solange die Leiste da ist | S |
| mittel | `Modal.tsx:60-64`, `ConfirmDialog.tsx:37-58` | Der Fokus steht auf „Abbrechen“. Die Erklärung im Fenster wird nicht vorgelesen (1.3.1) | `aria-describedby` auf `.dialog__body` | S |
| mittel | `DeleteAccountDialog.tsx:46`, `HouseholdPage.tsx:47, 64`, `HouseholdNamesForm.tsx:84`; zu prüfen `TaskForm`, `NamesForm` | Ein neuer Feldfehler wird nicht angesagt, wenn der Fokus schon im Feld ist (3.3.1, 4.1.3) | Das Muster aus `SignInPage` (verborgene Statuszeile) als Hook in `fields.tsx` | S–M |
| mittel | `SyncNotices.tsx:100-127` | Eine Statuszeile für alles: Jede Änderung liest Warten, Abgewiesen und Konflikte neu vor; offline bei jedem Häkchen (4.1.3) | Nur die neue Meldung ansagen; die Wartezahl nur beim Wechsel zu offline | M |
| niedrig ✅ K2c | `App.tsx:887` | „Neue Version“ wird mitsamt `role=status` eingefügt und deshalb oft nicht angesagt | Leere Statuszeile vorab anlegen | S |
| niedrig ✅ K2c (Regel `.btn[aria-disabled]`; „Einen Moment …“ sagte K2b an) | `AccountTile.tsx:106, 128`, `HouseholdLeave.tsx:70, 151` | `aria-disabled` sieht nicht anders aus, „Einen Moment …“ wird nicht angesagt | Regel `[aria-disabled="true"]`, `aria-busy` oder Statuszeile | S |
| niedrig ✅ K2c | `SignInPage.tsx:229-238` | „Code erneut senden“ erscheint nach 60 s ohne Ansage | In die Statuszeile schreiben | S |
| niedrig | `app.css:2305` u. a. | Feste Höhen (`.day-field__mark` 30 px) und `font-size` in px. Textabstand und Schriftgröße des Browsers greifen schlecht (1.4.12) | Von Hand prüfen, `min-*` statt fester Werte | S |
| niedrig ✅ K2c | `tests/e2e/axe.ts:15`, `design.spec.ts:208` | axe ohne `wcag22aa`; die 44-px-Messung läuft nur auf der Startseite | `wcag22aa` dazu, Messung auch auf den Einstellungen und in Fenstern | S |

**In Ordnung:** `lang="de"`, Zoom erlaubt, Sprunglink. `PageTitle` auf allen Seiten inklusive Anmeldung, Einladung, Haushalt. Fokus sichtbar (auch im Kontrastmodus). Fokus nach Fenstern zurück auf den Auslöser. Felder mit Label, `aria-describedby`/`aria-invalid` und Symbol. `autocomplete` `email`/`one-time-code`. Zeitlimits angekündigt (10 min, 7 Tage). Krümel `aria-hidden`, still bei reduzierter Bewegung und per Schalter. `tokens.test.ts` deckt alle Farbpaare ab. Tippflächen ≥ 44 px (außer Fließtext-Links). **axe findet nicht:** verdeckten Fokus, doppelte oder fehlende Ansagen (Screenreader, in Etappe 1 bewusst nicht von Hand), Textabstand, Tippflächen außerhalb der Startseite, automatisches Einsetzen des Codes am Handy (Gerätetest E2-5).

## 3. Texte und Verständlichkeit

| Schwere | Fundstelle | Beschreibung | Empfehlung | Aufwand |
|---|---|---|---|---|
| hoch | `OtherDeviceTile.tsx:24-25` | „Die Daten kommen nicht mit … Übertragen lassen sie sich mit ‚Sicherung‘.“ Online falsch; Einspielen ersetzt die Daten beider | Nach Modus: „Melde dich dort mit derselben E-Mail-Adresse an, dann sind eure Daten da.“ „Code“ → „QR-Code“ | S |
| hoch | `InstallSteps.tsx:33-35` | Der iPhone-Hinweis empfiehlt, Daten per Sicherung von Safari in die App zu bringen. Online falsch | Nach Modus: „Melde dich in der App einmal an, dann sind eure Daten da.“ | S |
| hoch | `householdTexts.ts:73, 95` | Zweimal „Einladungslink erzeugen“ in zwei Kacheln untereinander | „Link für die zweite Person erzeugen“ und „Link für Freunde erzeugen“ | S |
| mittel | `accountTexts.ts:21-24` + `SignInPage.tsx:161-168` | „Melde dich mit deiner E-Mail-Adresse an.“ steht doppelt (bestätigt) | Einladungstext: „… Nach der Anmeldung trittst du dem Haushalt bei.“ | S |
| mittel | `auth/household.ts:72`, `householdTexts.ts:147-155` | „Server“ für Nutzer; daneben „nicht erreichbar“ und „Anmeldedienst“ | „Keine Verbindung zu Krümel. Prüf dein Internet …“; „neu aus dem Haushalt laden“ | S |
| mittel | `syncedStorage.ts:417` | Unklarer Satz zum Einspielen ohne Internet | „Einspielen geht erst, wenn alle Änderungen übertragen sind. …“ | S |
| mittel | `migrate.ts:37, 50`, `exportImport.ts:78`, `localStorage.ts:79`, `outbox.ts:100`, `validate.ts` | „JSON“, `schemaVersion`, `tasks[0].assignee …` direkt sichtbar; kein nächster Schritt | „Die Datei ist keine Krümel-Sicherung.“; Fundstelle unter „Details für die Fehlersuche“ | M |
| mittel | `AccountTile.tsx:79`, `HouseholdNamesForm.tsx:112`, `BackupTile.tsx:130` | Rohe (ggf. englische) Fehlertexte | Feste deutsche Meldung mit nächstem Schritt | S |
| mittel | `auth/household.ts:61, 66` | „Du gehörst schon zu einem Haushalt.“ / „… schon zwei Personen.“ ohne nächsten Schritt | Weg nennen (Einstellungen → Haushalt verlassen; nachfragen) | S |
| niedrig ✅ K2c | `HouseholdPage.tsx:69`, `route.ts:120` | Ein Freundes-Link im Feld „Einladungslink“ führt zu „Das ist kein Einladungslink.“ | Fall erkennen und erklären | S |
| niedrig ✅ K2c teilweise (erledigt: „exportieren“, „man“, Kachel „Konto“, „Keine Verbindung“ doppelt, „24 Stunden“, „diese E-Mail“; offen: „Rohdaten“, „Teamwork“, gemischter Imperativ, im Backlog) | verschiedene | „Sicherung exportieren“ (`localStorage.ts:45`), „man“ (`VersionTile.tsx:19`), gemischt Infinitiv und Imperativ (`auth.ts`, `household.ts`), „In einer Minute“ fest (`accountTexts.ts:36`), Kachel „Anmeldung“ mit „Konto löschen“ (→ „Konto“), „am Tag“ gegenüber „24 Stunden“, Punkt bei „Gültig bis“, „Keine Verbindung“ doppelt (`HouseholdPage.tsx:148-150`), „Rohdaten“/„Kopie“ und „Browser“/„Gerät“ (`StorageProblemPage`), „Teamwork“, „diese Mail“ (`code.html`) | Bündeln, einheitlich du-Imperativ und Wortliste | S |

**In Ordnung:** durchgängig du-Form, typografisch sauber. Code (10 min, 6 Ziffern) und Einladung (7 Tage, einmal) stimmen überall überein. Die Texte zu Entfernen, Verlassen und Konto löschen sind ehrlich (was geht, was bleibt, endgültig, Sicherung). Die Abgleichs-Hinweise sind ohne Fachwörter, kein „Backup/Login/Account/Sync“. **Verstreute Texte (Englisch):** zentral sind `accountTexts`, `householdTexts`, `appearanceTexts`, `auth.ts`, `household.ts`. Verstreut sind rund 450 Texte: `format.ts` (~60), Seiten (Woche ~30, Heute ~20, StorageProblem ~15, übrige ~45), Komponenten (TaskForm ~25, BackupTile ~20, InstallSteps ~15, TaskDetail ~12, übrige ~60), `App.tsx`/`route.ts` (~20), `domain/` (~33), `storage/` (~40), `sync/` (~9), Mail und Betreff.

## 4. Liste für Datenschutzerklärung und Impressum (E2-5c, keine Rechtsberatung)

- **Daten:** E-Mail-Adresse (Konto, `auth.users`); Namen der Personen (max. 30 Zeichen) und optional der Haushaltsname; Aufgaben, Checklisten, Erledigungen (wer, wann); Einladungen (Ersteller, Zeitpunkte, keine Adresse); technische Daten bei Supabase (Anmeldezeitpunkte, IP in Auth-Logs); Sitzung, Kopie der Daten, Warteschlange und Geräteeinstellungen im Browser-Speicher.
- **Orte:** Supabase-Projekt in der Region Paris (eu-west-3); Browser-Speicher des Geräts (`kruemel:*`, Altbestand `putzplan:*`); GitHub Pages liefert nur die App-Dateien aus (Zugriffsprotokolle bei GitHub, USA); Mails mit dem Code über Gmail-SMTP (Google).
- **Dienstleister:** Supabase (DPA in den Nutzungsbedingungen, TIA vorhanden); GitHub (Pages, Actions); Google (Gmail-Versand, derzeit private Adresse des PO, Umstellung offen); später ggf. Resend oder Brevo (AVV prüfen). Keine Analyse, keine Cookies, keine fremden Abrufe (CSP).
- **Speicherdauer:** Konto bis zur Löschung; gelöschte Aufgaben bleiben als Grabstein ohne Inhalt; `applied_changes` 60 Tage; Freundes-Einladungen 30 Tage, Haushalts-Einladungen bis zur nächsten oder bis der Haushalt gelöscht ist; Auth-Logs nach Supabase-Vorgabe; Browser-Speicher bis zum Abmelden oder Löschen.
- **Löschwege:** „Konto löschen“ (eigene Zeile in `auth.users`; als Letzte geht der Haushalt mit); „Haushalt verlassen“ / „Person entfernen“ (Daten bleiben im Haushalt); Abmelden löscht die Kopie auf dem Gerät; „Sicherung herunterladen“ als Auskunft und Datenübertragbarkeit.
- **Rechte:** Auskunft, Berichtigung (Namen in der App), Löschung, Übertragbarkeit (Sicherung), Widerspruch, Beschwerde bei der Aufsichtsbehörde (NRW: LDI). Hinweis auf die Haushaltsausnahme prüfen, sobald Freunde eingeladen werden.
- **Impressum:** Name und ladungsfähige Anschrift des PO, E-Mail; prüfen, ob eine private, nicht geschäftsmäßige Seite impressumspflichtig ist.

## 5. Vorschlag Korrekturpaket K2

- **K2a – hoch (klein, ca. 1 Sitzung):** Workflow `pages` absichern; Texte zu „Anderes Gerät“, zum iPhone und zu den beiden Einladungsknöpfen; `scroll-padding` unter der Navigation; dazu `.env` ignorieren. Mit E2E für die Texte (Modus `supabase`/`e2e`) und einem Test für den Fokus über der Leiste.
- **K2b – mittel (mittel, 1–2 Sitzungen):** Dialog-Beschreibung, Feldfehler-Ansage als gemeinsamer Hook, Statuszeile des Abgleichs; Meldungen ohne Fachwörter und Rohtexte (Import, Server, englische Fehler); doppelter Anmeldesatz; nächste Schritte auf der Einladungsseite; Prüfung der Zeilen in `mergeDelta` samt serverseitigen Obergrenzen (Migration).
- **K2c – niedrig (klein bis mittel):** Realtime-Publikation ohne `household_members` (Migration); `aria-disabled`-Darstellung und Ansagen „Neue Version“ und „Code erneut senden“; `wcag22aa` und Tippflächen-Messung auf weiteren Seiten; Kleinkram in Texten; Actions per SHA; Dashboard-Liste für den PO (Token verifications, Realtime nur private Kanäle, Approval für Fork-PRs). Bewusst offen lassen: erkennbare Konten, Clickjacking, unbegrenzte Freundesketten.
