# Etappe 2 – Plan: gemeinsam nutzen auf mehreren Geräten

Stand: 20.10.2026 · Grundlage: CLAUDE.md, PLAN.md, ANFORDERUNGEN.md (inkl. „Sicherheit (Etappe 2)“), ETAPPE2.md, design/DESIGN.md (Version 2) und die Entscheidungen des PO vom 20.10.2026. Kein Code in dieser Sitzung; der PO arbeitet den Plan danach selbst in die Dokumente ein.

**App-Name (Entscheidung des PO, 20.10.2026):** Die App heißt ab sofort **Krümel**; im Code und in Dateinamen `kruemel`. Wo dieser Plan noch „Putzplan“ nennt, meint er den heutigen Stand von Etappe 1 (Adresse `/putzplan/`, Texte, Manifest, Dateinamen). Wann sich was ändert: das Repository und damit die Adresse in E2-3 (erster Schritt, Liste dort), die sichtbaren Texte, das Manifest, der Seitentitel, die Dateinamen und das App-Symbol in E2-4. Neue Namen (Supabase-Projekt, Gmail-Konto, Variablen) bekommen schon in E2-1 den neuen Namen.

## Kontext

Etappe 1 ist abgenommen: Die App läuft rein im Browser, die Daten liegen pro Gerät in `localStorage` hinter `AppStorage` (`src/storage/storage.ts`, asynchron, `load()`/`save(data)` ersetzen die ganzen Daten). Etappe 2 bringt dieselben Daten für zwei Personen auf alle Geräte: Supabase (Frankfurt, kostenlos), Anmeldung per E-Mail-Einmalcode, ein Haushalt mit Einladungslink, Echtzeit-Abgleich, offline weiter nutzbar. Danach kommt das Redesign „Persönlich“ mit Statistik. `npm run check` muss weiter ohne Claude, ohne Zugangsdaten und ohne Verbindung zu Supabase laufen.

## 1. Leitentscheidungen (Vorschlag)

**Fachlogik bleibt rein.** `src/domain/` ändert sich nur für das Datenmodell v3 (unten). Die Domänenfunktionen geben weiter ganze `AppData` zurück; der neue Speicher leitet die Änderungen daraus ab.

**Lokal zuerst, Server als Abgleich.** Jedes Gerät hält eine Kopie der Haushaltsdaten (wie heute im `localStorage`) und eine Warteschlange ausstehender Änderungen. Anzeigen und Speichern gehen immer sofort lokal, auch offline. Ein Abgleich schickt die Warteschlange in Reihenfolge an den Server und holt dann alles, was sich seit dem letzten Stand geändert hat. Echtzeit-Ereignisse von Supabase lösen nur einen Abruf aus. Die Daten selbst kommen immer über den Abruf, deshalb geht nichts verloren, wenn ein Ereignis ausbleibt (Handy im Hintergrund). Abgerufen wird zusätzlich beim Start, bei `online` und beim Wiedereinblenden (`visibilitychange`).

**Neue Schichten.**
- `src/sync/` (Abdeckung ≥ 90 % wie `src/domain/`):
  - `changes.ts` (rein): vergleicht alte und neue `AppData` und macht daraus Änderungen, z. B. Aufgabe speichern als geänderte Felder, Aufgabe löschen, abhaken (Erledigung plus Aufgabe), rückgängig, Namen, alles ersetzen.
  - `merge.ts` (rein): legt Serverstand und ausstehende Änderungen zusammen.
  - `outbox.ts`: die Warteschlange.
  - `syncedStorage.ts`: setzt `AppStorage` auf `Remote` plus lokale Kopie um.
  - `remote.ts`: die Schnittstelle `Remote` mit `pull(since)`, `push(change)` und `subscribe(hint)`.
  - `fakeRemote.ts`: In-Memory mit denselben Regeln wie der Server.
  - `supabaseRemote.ts`.
- `src/auth/` mit der Schnittstelle `Auth` (`session`, `requestCode`, `verifyCode`, `signOut`, `onChange`) und zwei Umsetzungen: Supabase und Fake.
- `AppStorage` bekommt zusätzlich `subscribe(listener)` (Daten vom anderen Gerät) und `syncStatus`. `load`/`save` bleiben, damit `App.tsx` und die Seiten kaum geändert werden.
- Die Umsetzung wird nach Modus gewählt (`src/backend.ts`): `supabase` für die echte App, `fake` für die E2E-Tests (Fake-Server, siehe Abschnitt 2) und `local` für `npm run demo` (die heutige `localStorage`-Umsetzung ohne Anmeldung, bleibt erhalten).

**Datenbank (Supabase, Schema `public`, alles per Migration im Repo unter `supabase/migrations/`).**
- `households` (id, Namen Person A/B, `schema_version`, `updated_at`)
- `household_members` (`user_id` PK → ein Haushalt pro Person, `household_id`, `role personA|personB`, eindeutig pro Haushalt und Rolle → höchstens 2 Mitglieder)
- `invites` (Token aus `gen_random_bytes`, gültig 7 Tage, nur einmal nutzbar)
- `tasks` (id, household_id, `data jsonb` = Aufgabe wie im Domänenmodell, `schema_version`, `updated_at` vom Server, `deleted_at`)
- `completions` (id, household_id, task_id, `previous_due_date`, `data jsonb`, `updated_at`, `deleted_at`; **eindeutig (task_id, previous_due_date) solange nicht gelöscht** → „gleichzeitiges Abhaken zählt einmal“)
- Row Level Security auf jeder Tabelle über `is_member(household_id)`. Schreiben nur über Postgres-Funktionen mit festem `search_path`, jeweils in einer Transaktion: `create_household`, `create_invite`, `accept_invite`, `save_task` (Felder zusammenführen), `delete_task`, `complete_task`, `undo_completion`, `replace_household_data`. `anon` bekommt keine Rechte. Die Tabellen kommen in die Publication `supabase_realtime`.
- Gelöschtes bleibt als Grabstein (`deleted_at`), damit Geräte, die offline waren, das Löschen mitbekommen.

**Konfliktregeln (PO: „pro Aufgabe gewinnt die letzte Änderung; gleichzeitiges Abhaken zählt einmal“), präzisiert:**
- Bearbeiten schickt nur die **geänderten Felder** einer Aufgabe. Ändert A den Titel und hakt B ab, bleiben beide Änderungen erhalten. Ändern beide dasselbe Feld, gewinnt die Änderung, die **zuletzt beim Server ankommt** (Serverzeit, unabhängig von falsch gehenden Geräteuhren). Die Checkliste zählt dabei als ein Feld.
- Beim Abhaken prüft `complete_task` das Paar aus Aufgabe und Termin. Ist dieser Durchgang schon abgehakt, wird die zweite Erledigung verworfen. Das zweite Gerät übernimmt den Serverstand und zeigt den Hinweis „Hatte {Name} schon abgehakt.“
- Rückgängig geht nur, wenn die Erledigung auf dem Server noch die letzte der Aufgabe ist; sonst kommt ein Hinweis und der Serverstand gilt.
- Löschen gewinnt gegen gleichzeitiges Bearbeiten (eine gelöschte Aufgabe wird nicht wiederbelebt).
- Der Abruf überlappt um einige Sekunden und das Zusammenführen ist idempotent. So gehen keine Änderungen verloren, die eine länger laufende Transaktion verspätet festschreibt.

**Datenmodell v3 (`schemaVersion` 3), wird für die Statistik gebraucht und deshalb gleich mit dem neuen Speicher eingeführt:**
- Eine Erledigung bekommt `completedAt` (Zeitpunkt, für die Uhrzeit in „Heute“) und `assigneeAtCompletion` (wer zuständig war, für „N-mal füreinander übernommen“).
- Migration v2 → v3 lässt beide Felder weg; „unbekannt“ wird nicht gezählt bzw. ohne Uhrzeit gezeigt.
- Sicherungen aus Etappe 1 (v1/v2) bleiben einspielbar. Eine Datenübernahme ist nicht nötig, geht so aber nebenbei.

**Versionsschutz.** Liefert der Server eine Zeile mit höherer `schema_version`, als die App kennt (eine andere installierte App ist schon neuer), schreibt die App nichts mehr und zeigt „Neue Version verfügbar – Neu laden“.

**„Ich bin“ (F5)** kommt aus der Rolle in `household_members`. Darstellung und Installationshinweis bleiben Geräteeinstellungen.

**Sicherheit S1–S6.**
- Keys: Projekt-URL und Publishable Key (früher „anon key“) sind öffentlich und kommen über `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` in den Build (GitHub-Repository-Variablen; `.env.example` im Repo, `.env.local` in `.gitignore`). Der Service-Role-Key kommt nie ins Repo und nie in den Client.
- CSP als `<meta http-equiv>` in `index.html`: `connect-src` nur eigene Adresse plus `https://`/`wss://<ref>.supabase.co`. Das Farbschema-Skript wird dafür eine eigene Datei oder bekommt einen Hash.
- Der Service Worker fasst weiterhin nur eigene Adressen an (Test dazu).
- Der Einladungstoken steht im Hash (`#/einladung/<token>`) und landet deshalb in keinem Server-Log.

**Online-Version.** Ein Build-Schalter `VITE_BACKEND` sorgt dafür, dass GitHub Pages bis zum Ende von E2-3 weiter die Etappe-1-App ausliefert. Erst mit E2-3 stellt der Workflow `pages` auf `supabase` um. So stört kein Zwischenstand den täglichen Gebrauch (siehe Frage 5).

**Neue Abhängigkeiten (Begründung in PLAN.md):**
- `@supabase/supabase-js` (Laufzeit; Anmeldung, Datenbank-API, Realtime). Die Bündelgröße wird in E2-1 gemessen. Wird sie zu groß, nehmen wir die Einzelpakete `auth-js`/`postgrest-js`/`realtime-js`.
- `supabase` (Entwicklung; CLI für lokale Instanz und Migrationen).

Sonst nichts: Der Fake-Server ist eigener Code mit `node:http`, Diagramme sind eigenes SVG.

## 2. Teststrategie: wie `npm run check` ohne Supabase läuft

Drei Ebenen:

1. **`npm run check`** (wie bisher der eine Befehl; ohne Docker, ohne Internet, ohne Zugangsdaten)
   - Vitest: Fachlogik und `src/sync/` gegen `FakeRemote` in-memory. Die Konfliktregeln sind Tests, benannt nach den Regeln, z. B. „Konflikt: gleichzeitiges Abhaken zählt einmal“.
   - Playwright gegen einen Build im Modus `e2e`. Die App spricht dort mit einem **lokalen Fake-Server** (`scripts/fake-server.ts`, läuft mit Node per Type-Stripping, startet als `webServer` von Playwright). Er nutzt dieselbe Logik wie `FakeRemote`, kann einen Haushalt pro Test anlegen (parallel lauffähig) und meldet Änderungen per Server-Sent Events.
   - So lassen sich zwei Geräte (zwei Browser-Kontexte), offline (`context.setOffline`) und gleichzeitiges Abhaken echt im Browser durchspielen.
   - Fake-Anmeldung: Der Code steht für den Test über einen Test-Endpunkt bereit.
   - `startConfigured`/`storedData` in `tests/e2e/helpers.ts` füllen bzw. lesen dann den Fake-Server statt `localStorage`; die übrigen Tests bleiben möglichst unverändert.
   - Zusätzlich ein Produktions-Build mit Platzhalter-URL, damit auch dieser Weg kompiliert.
2. **`npm run check:db`** (lokale Supabase-Instanz per Docker; braucht nach dem ersten Herunterladen der Images kein Internet)
   - `supabase start`, Migrationen frisch einspielen (`supabase db reset`), dann Vitest-Projekt `db`:
     - **S5-Tests mit direkten API-Anfragen:** zwei Benutzer in zwei Haushalten. Der fremde Haushalt ist weder lesbar noch änderbar noch löschbar, Einfügen in einen fremden Haushalt scheitert, Einladungen lassen sich nicht missbrauchen (abgelaufen, doppelt, Haushalt voll, schon Mitglied), ohne Anmeldung ist nichts lesbar.
     - **Vertragstests:** dieselbe Testreihe läuft gegen `FakeRemote` (in `check`) und gegen `SupabaseRemote` (hier), damit der Fake nicht von den SQL-Regeln abweicht.
     - **Anmeldung im Browser:** Den Einmalcode liest der Test aus dem Mail-Fänger der lokalen Instanz (Mailpit). Passkey nur in Chromium mit virtuellem Authenticator, sofern die lokale Instanz die Beta kennt.
   - Läuft **in CI als eigener Job** bei jedem Push (GitHub-Runner haben Docker, keine Secrets nötig). Der Workflow `pages` veröffentlicht nur, wenn beide Jobs grün sind.
3. **Echtes Projekt nur von Hand:** `npm run dev` mit `.env.local`, durch den PO. Nie automatische Tests gegen echte Daten.

Warum die lokale Instanz nicht in `npm run check` kommt: Sie braucht Docker Desktop, mehrere GB Images und 30–90 s Start. `check` soll auf jedem Rechner schnell und ohne Zusatzsoftware laufen. Die Vertragstests halten den Fake ehrlich.

**Was der PO installieren muss:**
- Für `npm run check`: nichts Neues (`npm install` holt die neuen Pakete, die Supabase-CLI kommt als devDependency, also `npx supabase`, keine globale Installation).
- Für `npm run check:db` lokal: **Docker Desktop für Windows** (WSL 2, für private Nutzung kostenlos; etwa 4 GB RAM frei und einige GB Platte). Der erste Lauf lädt die Images (einmal Internet). Optional: Ohne Docker läuft `check:db` nur in CI (siehe Frage 11).
- Konten: Supabase (kostenlos) und ggf. ein SMTP-Anbieter (Frage 1).

## 3. Arbeitspakete

Jedes Paket endet wie bisher mit grünem `npm run check` (lokal und auf GitHub) und einem Commit. Ab E2-1 muss auch `check:db` in CI grün sein.

### E2-0 Fundament ohne Server
Inhalt:
- Datenmodell v3 mit Migration und Tests (`migrate.ts`, `asVersion2` in `storage.fixtures.ts`). Die App setzt `completedAt` und `assigneeAtCompletion` beim Abhaken.
- `src/sync/` komplett gegen `FakeRemote`: Änderungen ableiten (Felder-Patch inkl. entfernter Felder), Warteschlange (im `localStorage`; mehrere Tabs über Web Locks `navigator.locks`), Zusammenführen, alle Konfliktregeln aus Abschnitt 1.
- `src/auth/` (Schnittstelle plus Fake), `src/backend.ts` mit den Modi `local`/`fake`/`supabase` (`supabase` noch ohne Umsetzung).
- Fake-Server-Skript und Playwright-`webServer`, Build-Modus `e2e`.

Für Nutzer ändert sich nichts; online und in der Demo bleibt `local`.

**Fertig, wenn:**
- Unit-Tests für jede Konfliktregel und für „offline: Änderungen werden nachgereicht“ sind grün.
- `src/sync/` hat ≥ 90 % Abdeckung, Migration v2 → v3 ist getestet (Laden und Import).
- Ein erster E2E-Test öffnet zwei Kontexte gegen den Fake-Server und sieht eine Änderung auf dem zweiten.
- `npm run check` ist grün, und die App verhält sich online unverändert.

### E2-1 Supabase einrichten
Inhalt:
- **PO:**
  - Projekt „kruemel“ anlegen, Region Frankfurt (eu-central-1), Free Plan. Bildschirmfoto der Region für S1.
  - AVV/DPA von Supabase prüfen und abschließen.
  - SMTP nach Frage 1 einrichten.
  - Auth: E-Mail-Anmeldung mit **Code statt Link** (Vorlage mit `{{ .Token }}`), Code-Gültigkeit 10 min, Rate-Limits ansehen.
  - Auth → URL-Konfiguration: Site URL `https://stephan-pro.github.io/kruemel/` (die Adresse nach der Umbenennung in E2-3; es muss sie noch nicht geben). Redirect-URLs zusätzlich `http://localhost:5173/putzplan/` (Entwicklung bis zur Umbenennung) und `http://localhost:5173/kruemel/`. In E2-3 fällt der Eintrag mit `putzplan` weg.
  - Projekt-URL und Publishable Key als GitHub-Repository-Variablen eintragen.
- **Repo:**
  - `supabase/config.toml`, Migration mit allen Tabellen, RLS, Funktionen und Realtime-Publication aus Abschnitt 1.
  - `npm run check:db` (Skript prüft zuerst, ob Docker läuft, und sagt sonst, was zu tun ist).
  - CI-Job `db`; `pages` wartet auf beide Jobs.
  - `.env.example`, CSP-Meta-Tag, Test „Service Worker fasst Supabase nicht an“.
  - Abhängigkeiten mit Begründung und gemessener Bündelgröße in PLAN.md.
- **Migration einspielen ins echte Projekt:** der PO im eigenen Terminal mit `npx supabase link` und `npx supabase db push` (Zugang bleibt beim PO, nicht im Repo, nicht in CI).
- **Doku (README, ANFORDERUNGEN):**
  - Kostenloser Tarif und seine Grenzen.
  - **Pausierung nach 7 Tagen ohne Nutzung:** Die App läuft dann offline weiter, Änderungen warten auf dem Gerät. Der PO stellt das Projekt im Dashboard wieder her, danach wird alles nachgereicht. Nach 90 Tagen Pause ist kein Wiederherstellen per Klick mehr möglich.
  - Der Free Plan hat keine herunterladbaren Backups, daher regelmäßig „Sicherung herunterladen“.

**Fertig, wenn:**
- `check:db` ist lokal (falls Docker da ist) und in CI grün, mit den S5-Tests aus Abschnitt 2.
- Im echten Projekt sind die Migrationen eingespielt und RLS ist für jede Tabelle an (Dashboard „Security Advisor“ ohne Warnung).
- `npm run check` ist ohne Docker unverändert grün.
- Im Repo steht kein Geheimnis (Durchsicht, ETAPPE2 S4).

### E2-2 Anmeldung
Inhalt:
- **Anmelden:** Seite „Anmelden“ (E-Mail) → „Code eingeben“ (`autocomplete="one-time-code"`, `inputmode="numeric"`, „Code erneut senden“ nach 60 s, Meldungen für falschen/abgelaufenen Code am Feld). Einmalcode statt Link ist wichtig für das iPhone: Ein Link würde in Safari statt in der installierten App öffnen.
- **Ohne Haushalt:** „Haushalt anlegen“ (eigener Name und Name der zweiten Person, Ersteller = Person A) oder Hinweis „Du hast eine Einladung? Öffne den Link.“
- **Einladen:** Kachel „Haushalt“ in den Einstellungen mit Mitgliedern und „Person einladen“. Es entsteht ein Link (7 Tage gültig, einmal nutzbar, neu erzeugen macht den alten ungültig) mit Kopieren, Teilen (`navigator.share`) und QR-Code (wiederverwendet `qrCode.ts`).
- **Einladung annehmen:** `#/einladung/<token>` merkt sich den Token, führt durch die Anmeldung und nimmt die Einladung an. Fehlerseiten für abgelaufen, schon benutzt, Haushalt voll und „du hast schon einen Haushalt“. Am iPhone darf das in Safari passieren; die installierte App braucht danach nur noch eine eigene Anmeldung.
- **„Ich bin“** aus der Rolle; die Geräteauswahl entfällt (außer im Modus `local`/Demo). Einstellungen: „Angemeldet als … · Abmelden“.
- **Passkey (Beta, nur zusätzlich):**
  - Zuerst ein kurzer Spike: Welche API bietet supabase-js dafür, kennt die lokale Instanz sie?
  - Bei „ja“: Kachel „Anmeldung“ → „Passkey einrichten“, auf der Anmeldeseite unter der E-Mail „Mit Passkey anmelden“.
  - Bei „nein“ oder instabil: aufschieben und den Grund in PLAN.md festhalten. Der Einmalcode bleibt immer der Hauptweg.
- Anmeldeseiten mit axe hell/dunkel, Tastatur, Kontrastmodus.

**Fertig, wenn:**
- E2E (Fake) grün: Anmelden mit Code, falscher/abgelaufener Code, Abmelden, Haushalt anlegen, Einladung im zweiten Kontext annehmen, alle Fehlerfälle, axe.
- `check:db` grün: Anmeldung gegen die lokale Instanz mit Code aus Mailpit; Einladung durch einen zweiten Benutzer angenommen.
- Der PO meldet sich mit `npm run dev` am echten Projekt per Code an.
- Passkey ist umgesetzt und in Chromium getestet **oder** begründet aufgeschoben.

### E2-3 Gemeinsamer Speicher
Inhalt:
- **Schritt 0, zuerst: Repository in „kruemel“ umbenennen** (vor dem Umstellen auf Supabase). Warum jetzt: Mit der Umstellung müssen ohnehin alle die App neu installieren und sich anmelden; so passiert das nur einmal. Claude nennt dem PO zu Beginn von E2-3 die Schritte und wartet auf sein „umbenannt“, bevor er Code ändert (nach der Umbenennung liefert die alte Adresse nichts mehr aus, deshalb gehören Umbenennung und Code-Änderung zeitlich zusammen).
  - **Was sich mit der Adresse ändert:**
    - **GitHub Pages:** Die Seite liegt dann unter `https://stephan-pro.github.io/kruemel/`. Die alte Adresse `…/putzplan/` zeigt danach „404“, GitHub leitet Pages-Adressen nicht weiter (die Repository-Adresse und `git push` auf die alte Adresse werden weitergeleitet). Der Workflow `pages` braucht keine Änderung (er nimmt die Adresse von GitHub); die Einstellung Pages → Source „GitHub Actions“ bleibt, wird aber nach der Umbenennung geprüft.
    - **Code:** `base` in `vite.config.ts` wird `/kruemel/`; ebenso die Adressen in `playwright.config.ts` und in allen Tests, die `/putzplan/` fest schreiben (`pwa.spec.ts`, `app.spec.ts`, `design.spec.ts`, `demo.spec.ts`, `appInfo.test.ts`, `qrCode.test.ts`). Zum Schluss darf die Suche nach `/putzplan/` im Code nichts mehr finden. Die Entwicklungsadresse wird `http://localhost:5173/kruemel/`.
    - **Manifest:** `start_url`, `scope` und `id` sind relativ (`./`) und brauchen keine Änderung; `pwa.test.ts` prüft das schon so. Der Name im Manifest bleibt bis E2-4 „Putzplan“.
    - **Service Worker:** Er leitet seine Adresse aus seinem Standort ab und fasst weiter nur eigene Adressen an; nichts zu ändern. Die alte App unter `/putzplan/` bleibt auf Geräten, die sie installiert haben, als toter Zwischenspeicher zurück (sie zeigt den Stand von Etappe 1 oder eine Fehlerseite). Deshalb vor dem Löschen der Daten auf eine Sicherung achten und die alte App deinstallieren (unten). Der neue Service Worker löscht beim Aktivieren auch alte `putzplan-…`-Zwischenspeicher derselben Herkunft.
    - **Supabase:** Site URL und Redirect-URLs (Dashboard → Authentication → URL Configuration) auf `https://stephan-pro.github.io/kruemel/` und `http://localhost:5173/kruemel/`; der Eintrag mit `putzplan` aus E2-1 wird gelöscht. Die CSP ändert sich nicht (`connect-src` nennt nur Supabase und die eigene Herkunft). Supabase braucht keine CORS-Einstellung.
    - **Passkey-Herkunft (WebAuthn):** Maßgeblich ist die Herkunft `https://stephan-pro.github.io` (Domain `stephan-pro.github.io` als RP-ID), nicht der Pfad. Ein Passkey, der vor der Umbenennung eingerichtet wurde, gilt danach weiter. Verlangt Supabase oder `supabase-js` eine Angabe zur erlaubten Herkunft/RP-ID, wird dort nur die Domain eingetragen, kein Pfad (im Spike in E2-2 prüfen und in `PLAN.md` festhalten). Zieht die App später auf eine eigene Domain um, sind Passkeys neu einzurichten.
    - **Browser-Speicher:** Er gehört zur Herkunft, nicht zum Pfad. Im Browser sieht die neue Adresse die Etappe-1-Daten der alten daher noch; installierte Apps (vor allem auf dem iPhone, Safari und Home-Bildschirm getrennt) haben eigenen Speicher. Vor dem Umzug deshalb auf jedem Gerät „Sicherung herunterladen“.
    - **Dokumentation und Hilfen:** `README.md` (Abzeichen, Online-Adresse, Entwicklungsadresse), `CLAUDE.md`, `docs/GERAETETEST.md`, `docs/PLAN.md`, `ANFORDERUNGEN.md` und `.claude/skills/paket/SKILL.md` (Adresse in Schritt 3.4) nennen die neue Adresse; die Hinweise „bis zur Umbenennung“ in diesen Dokumenten fallen weg. Lokale Git-Adresse: `git remote set-url origin https://github.com/stephan-pro/kruemel.git`.
  - **Was der PO dafür tut** (in dieser Reihenfolge):
    1. Auf allen Geräten in der App „Sicherung herunterladen“ (Einstellungen), besonders auf dem iPhone.
    2. Auf GitHub: Repository → Settings → General → „Repository name“ auf `kruemel` ändern → „Rename“. Oder im eigenen Terminal `gh repo rename kruemel`. Dann Claude „umbenannt“ sagen.
    3. Im eigenen Terminal im Projektordner `git remote set-url origin https://github.com/stephan-pro/kruemel.git`. Den Projektordner `C:\Users\Anwender\Projekte\putzplan` kann der PO danach in `kruemel` umbenennen; er öffnet das Projekt dann in Claude Code neu (der Ordnername gehört zu den Sitzungsdaten, offene Sitzungen enden).
    4. Im Supabase-Dashboard die URL-Konfiguration anpassen (siehe oben).
    5. Nach dem Veröffentlichen auf jedem Gerät die alte App vom Home-Bildschirm entfernen und `https://stephan-pro.github.io/kruemel/` öffnen, anmelden und neu installieren. Hinweis: Auf dem iPhone ändern sich Name und Symbol einer schon angelegten App nicht von selbst. Weil E2-4 beides ändert, ist es am bequemsten, die Handys erst nach E2-4 neu zu installieren; bis dahin genügt der Browser.
    6. Optional: Ein kleines neues Repository `putzplan` mit einer Seite „Die App heißt jetzt Krümel“ und einem Link auf die neue Adresse, damit alte Lesezeichen nicht ins Leere führen.
- **Verbindung zu Supabase:**
  - `SupabaseRemote`: Abruf per PostgREST mit Überlappung, Änderungen über die RPCs, Realtime als Anstoß.
  - Vertragstests gegen die lokale Instanz.
  - `SyncedStorage` in `App.tsx` einhängen: Daten sofort aus der lokalen Kopie, dann abgleichen; `subscribe` zeichnet neu.
- **Anzeige:**
  - Abgleichsstand in Kopf/Seitenleiste und Einstellungen, ohne Dauer-Ansagen: „Alles übertragen“ / „Offline – N Änderungen warten“ / „Server nicht erreichbar“.
  - Konflikt-Hinweise („Hatte {Name} schon abgehakt.“).
  - Versionsschutz.
  - Die Seite „unlesbare Daten“ passt sich an: Eine kaputte lokale Kopie wird vom Server neu geholt; nur eine kaputte Warteschlange zeigt den bisherigen Weg mit Rohdaten-Download.
- **Abmelden** warnt bei ausstehenden Änderungen und löscht dann lokale Kopie und Warteschlange.
- **Sicherung** arbeitet auf den Haushaltsdaten:
  - Herunterladen geht auch offline (lokale Kopie).
  - **Einspielen nur online**: per `replace_household_data` in einer Transaktion, die Rückfrage nennt „ersetzt die Daten für euch beide“, die automatische Kopie vorher bleibt.
- **Umstellen:**
  - Workflow `pages` auf `VITE_BACKEND=supabase` umstellen.
  - Nach dem Veröffentlichen legen PO und zweite Person ihren Haushalt im echten Projekt an.

**Fertig, wenn:**
- E2E `sync.spec.ts` (zwei Kontexte, Fake) ist grün:
  - Änderung auf A erscheint auf B ohne Neuladen.
  - A offline ändert und abhakt, nach dem Wiederverbinden sieht B alles.
  - Beide haken denselben Durchgang offline ab → genau ein Eintrag in „Erledigt“.
  - Titel gleichzeitig geändert → letzte gewinnt; Löschen gegen Bearbeiten.
  - Statusanzeige, Abmelden mit Warnung, Einspielen offline abgelehnt, axe.
- Alle bisherigen E2E-Tests laufen grün über den Fake-Server.
- `check:db` mit den Vertragstests für `SupabaseRemote` ist grün.
- Die Online-Version nutzt Supabase; zwei echte Geräte sehen dieselben Daten.
- Das Repository heißt `kruemel`, die App läuft unter `https://stephan-pro.github.io/kruemel/`; im Code kommt `/putzplan/` nirgends mehr vor, die Supabase-URL-Konfiguration nennt die neue Adresse.

### E2-4 Redesign „Persönlich“ und Statistik (DESIGN.md Version 2)
Inhalt, in zwei Commits:
- **E2-4a Tokens, Navigation, „Heute“:**
  - Neue Tokens (Violett, dunkles Blau mit Leuchten, Glasflächen).
  - `tokens.test.ts` lernt Alpha-Mischung, damit Kontraste von Glas gegen den echten Hintergrund gerechnet werden; alle neuen Paare kommen hinein.
  - Archivo 400–900 (die variable Schrift deckt das ab).
  - Navigation „Heute · Woche · [Plus] · Statistik · Einstellungen“ (schwebend am Handy, Seitenleiste am PC). „Aufgaben“ und „Erledigt“ sind aus „Woche“ und den Einstellungen erreichbar.
  - Startseite „Heute“: Kopf mit Avatar, Begrüßung nach Tageszeit, Satz zur Zusammenfassung, „Deine Woche“ mit 7 Tagesfeldern, Kacheln „Deine Woche“/„Gemeinsam“ mit Ring, „Heute für dich“ mit Filter. Überfälliges zuerst und **bei 360 × 640 ohne Scrollen sichtbar**; Erledigtes mit Uhrzeit (`completedAt`).
  - Die Seite „Woche“ übernimmt die bisherige Wochenübersicht im neuen Stil.
  - Leistenfarben, Manifest und `pwa.test.ts` anpassen.
  - **Umbenennung in „Krümel“ (sichtbar):**
    - Seitentitel (`index.html`, `PageTitle`: „Seite – Krümel“), Name und Kurzname im Manifest, Installationshinweis „Krümel als App“ und Fenster „Krümel installieren“, alle weiteren Texte mit dem alten Namen (Suche nach „Putzplan“ in `src/` und `tests/`).
    - Dateinamen der Sicherung: `kruemel-JJJJ-MM-TT.json`, `kruemel-vor-import-…`, `kruemel-rohdaten-…`; Sicherungen mit den alten Namen bleiben einspielbar.
    - Technische Namen auf `kruemel`: `package.json`, Zwischenspeicher-Präfix des Service Workers (alte `putzplan-…`-Speicher werden dabei gelöscht), Speicherbereich der Demo (`kruemel-demo`), Plugin-Name in `vite.config.ts`. Die Geräteeinstellungen unter dem Schlüssel `putzplan:device` werden einmal gelesen und unter dem neuen Schlüssel gespeichert; ein Test mit alten Daten sichert das ab (Muster `asVersion1`). Die Adresse selbst ist schon in E2-3 geändert.
  - **App-Symbol** (Frage 12, entschieden): Vorlage `docs/design/kruemel-icon.svg` (Keks-Krümel mit Gesicht und Besen auf violetter Kachel).
    - `public/icon.svg` wird die Vorlage; `npm run icons` erzeugt daraus wie bisher alle PNG-Größen, auch das maskierbare Symbol und das Apple-Touch-Symbol.
    - Prüfen: Gesicht und Besen liegen in der sicheren Zone maskierbarer Symbole (Kreis mit 80 % des Durchmessers, mittig). Wenn nicht, wird der Abstand angepasst (Motiv kleiner in die Kachel), das Motiv bleibt unverändert. Ein Test oder Hilfsskript hält das Ergebnis fest.
    - Der Krümel bleibt in allen Varianten goldbraun und rund, nie blau oder zottelig (Abstand zu geschützten Figuren).
    - Der Satz „blaue Kachel mit weißem Haus“ in `ANFORDERUNGEN.md` (N3 App auf dem Home-Bildschirm) wird ersetzt, `pwa.test.ts` und die Leistenfarben passen zum neuen Violett.
  - **Optional:** Der Krümel darf in der App auftauchen, z. B. bei „Alles erledigt“ oder auf leeren Seiten. Nur als Bild mit passendem Alternativtext oder als Schmuck mit `aria-hidden`, nie als einziger Träger einer Information; die Bewegungsregeln aus DESIGN.md Abschnitt 8 gelten.
- **E2-4b Statistik:**
  - Reine Funktionen in `src/domain/statistics.ts`: Zeitraum Woche/Monat/Jahr, gemeinsam erledigt, Vergleich zum Vorzeitraum, Serie (Wochen mit allem Fälligen erledigt, gleiche Zählung wie „Stand“), Balken pro Tag, Teamwork A/B, „N-mal füreinander übernommen“ (`completedBy ≠ assigneeAtCompletion`, „beide“ zählt nicht), Top 3 pro Aufgaben-ID.
  - Seite „Statistik“ mit SVG-Diagrammen (`role="img"`, vollständige Textbeschreibung), ohne Rangliste und ohne Gewinner-Wörter.
  - Bewegung unter 200 ms, aus bei `prefers-reduced-motion`.

**Fertig, wenn:**
- Unit-Tests für Statistik, Begrüßung und Zusammenfassungssatz sind grün (benannt nach den DESIGN-Regeln).
- Alle E2E-Tests sind auf die neue Navigation umgestellt und grün, `phone.spec.ts` prüft „Heute“ bei 360 × 640 und 390 × 844.
- axe hell und dunkel auf jeder Seite, Kontrasttests für alle neuen Paare, Kontrastmodus-Tests grün.
- In der App und im Manifest steht kein „Putzplan“ mehr; die Symbolgrößen stammen aus der Krümel-Vorlage und die sichere Zone maskierbarer Symbole ist geprüft.

### E2-5 Gerätetest und Abschluss
Inhalt:
- `docs/GERAETETEST.md` erweitern um:
  - Anmeldung per Code am PC, auf Android (Redmi/Firefox) und am iPhone (Safari **und** installierte App, getrennt angemeldet).
  - Einladung über den Link und QR-Code.
  - Passkey (Windows Hello, iPhone, Android), falls umgesetzt.
  - Zwei Geräte gleichzeitig (Echtzeit), offline ändern und wieder online, gleichzeitig abhaken.
  - Abmelden und Update der installierten App.
- PO führt den Test durch; Funde einarbeiten.
- `docs/ETAPPE2.md` abhaken mit Nachweisen S1–S6 (Region-Bildschirmfoto, Code-Durchsicht S4, S5-Tests, E2E „nur eigene Adressen und Supabase“ S6).
- Datenschutzhinweis nach Frage 8 und **ein einfaches Impressum** (To-do, Entscheidung des PO vom 20.10.2026):
  - Eine kleine Seite oder ein Abschnitt unter den Einstellungen, von dort verlinkt; Inhalt: Name und Anschrift des Betreibers, E-Mail-Adresse, Hinweis auf den privaten, nicht gewerblichen Zweck.
  - Welche Angaben genau Pflicht sind, ist eine rechtliche Frage, die der PO verbindlich klärt; Claude baut die Seite mit den vom PO gelieferten Angaben und erfindet keine. Das Repository ist öffentlich: Der PO entscheidet, ob seine Anschrift dort stehen darf.
  - Mit axe hell/dunkel geprüft wie jede Seite.
- README für den PO (Anmeldung, Einladung, Pausierung, Sicherung), ggf. Neuanmeldungen abschalten (Frage 2), erste Sicherung der Haushaltsdaten herunterladen.

**Fertig, wenn:**
- Der Gerätetest ist bestanden, die Ergebnis-Tabelle steht in GERAETETEST.md.
- ETAPPE2.md ist vollständig abgehakt.
- Datenschutzhinweis und Impressum sind in der App erreichbar.
- `check` und `check:db` sind grün, und der PO nimmt Etappe 2 ab.

## 4. Was sich in den Dokumenten ändern muss (für die Sitzung des PO)

- **ANFORDERUNGEN:**
  - S2/S3 neu: Einmalcode per E-Mail als Hauptweg, Passkey zusätzlich, kein TOTP und kein Passwort.
  - F5: „Ich bin“ kommt aus der Anmeldung.
  - F7: Import ersetzt Haushaltsdaten für beide und geht nur online.
  - N3: offline mit Nachreichen.
  - Abschnitt 8: Statistik ist jetzt drin.
  - Neue Entscheidungen: Konfliktregeln, Einladung, Haushalt startet leer, Pausierung.
- **DESIGN.md Zeile 4:** „nach Etappe 2“ → „Teil von Etappe 2 (E2-4)“.
- **ETAPPE2.md Abschnitt 1:** Anbieter, Offline, Konflikte und Umzug sind entschieden; S2/S3-Zeilen anpassen.
- **PLAN.md:** neues Kapitel Etappe 2 (Stack, Abschnitte 1–3 dieses Plans).
- **CLAUDE.md:**
  - `npm run check:db`, `src/sync/`, `src/auth/`, `supabase/`, `scripts/fake-server.ts`.
  - Wortliste: Haushalt = household, Einladung = invite, Anmeldung = signIn, Einmalcode = code/otp, Abgleich = sync, ausstehende Änderungen = outbox/pending, Abgleichsstand = syncStatus.
- **`.claude/skills/paket/SKILL.md`:** zusätzlich `check:db` in CI grün.

## 5. Risiken

- **Passkeys sind Beta:** Die API kann sich ändern. Deshalb nur zusätzlich, mit Spike und Ausstieg in E2-2.
- **E-Mail-Versand:** Der eingebaute SMTP von Supabase schickt nur an Adressen von Team-Mitgliedern und nur sehr wenige Mails pro Stunde. Ohne eigenen SMTP kann sich die zweite Person praktisch nicht anmelden (Frage 1).
- **Pausierung und keine Backups im Free Plan:** wird dokumentiert, die Sicherung bleibt wichtig.
- **Checkliste als ein Feld:** Hakt man gleichzeitig auf zwei Geräten verschiedene Einträge ab, kann ein Häkchen verloren gehen (selten; Frage 3).
- **Bündelgröße** durch supabase-js; wird gemessen.
- **Tests:** Der Umbau der E2E-Hilfen auf den Fake-Server berührt alle Tests; daher passiert er früh (E2-0/E2-3) und zentral in `helpers.ts`.

## 6. Fragen an den PO und Entscheidungen

Die Antworten des PO vom 20.10.2026 stehen jeweils unter der Frage. Sie gehen dem übrigen Plan vor, wo sie abweichen, und sind zusätzlich in `ANFORDERUNGEN.md` Abschnitt 9 eingetragen. Zeilen mit „Folge“ nennen, was die Entscheidung für die Pakete heißt.

1. **E-Mail-Versand:** eigener SMTP nötig (siehe Risiken). Brevo (Frankreich, kostenlos ca. 300 Mails/Tag, AVV) oder das eigene Postfach per SMTP mit App-Passwort? *Empfehlung: Brevo, damit kein Passwort eines privaten Postfachs bei Supabase liegt.*
   - **Entscheidung:** Ein eigenes, neues Gmail-Konto nur für Krümel, per SMTP mit App-Passwort. Kein privates Postfach. Brevo scheidet aus, weil es eine eigene Domain verlangt.
   - Folge: E2-1 richtet den SMTP-Versand von Supabase mit diesem Konto ein. Das App-Passwort steht nur im Supabase-Dashboard, nie im Repo. Google verlangt für App-Passwörter die Zwei-Faktor-Anmeldung am Gmail-Konto.
2. **Wer darf sich anmelden?** Die Adresse ist öffentlich; jeder könnte einen eigenen Haushalt anlegen (sicher getrennt, verbraucht aber den kostenlosen Tarif). *Empfehlung: Neuanmeldungen im Dashboard abschalten, sobald beide Konten bestehen.*
   - **Entscheidung:** Neuanmeldungen im Dashboard abschalten, sobald beide Konten bestehen (E2-5).
3. **„Letzte Änderung“:** Gilt die zuletzt beim Server angekommene (Empfehlung) oder die zuletzt auf einem Gerät gemachte (hängt an der Geräteuhr)? Ist es in Ordnung, dass Bearbeitungen feldweise zusammengeführt werden und die Checkliste dabei als ein Feld zählt?
   - **Entscheidung:** Es gilt die zuletzt beim Server angekommene Änderung. Feldweises Zusammenführen mit der Checkliste als ein Feld ist in Ordnung.
4. **Löschen gegen Bearbeiten:** Löschen gewinnt? *Empfehlung: ja.*
   - **Entscheidung:** Löschen gewinnt gegen Bearbeiten.
5. **Online-Version:** bleibt bis zum Ende von E2-3 Etappe 1 (Empfehlung) oder wird schon mit E2-2 umgestellt?
   - **Entscheidung:** Die Online-Version bleibt bis zum Ende von E2-3 bei Etappe 1.
6. **Daten aus Etappe 1:** Nicht nötig, aber per „Sicherung einspielen“ möglich. Soll das in der README als Weg beschrieben werden? *Empfehlung: ja, ein Satz.*
   - **Entscheidung:** Ja, ein Satz in der README (E2-5).
7. **Pausierung:** nur dokumentieren (Empfehlung; tägliche Nutzung hält das Projekt wach) oder zusätzlich ein täglicher Abruf per GitHub Actions?
   - **Entscheidung:** Zusätzlich ein täglicher Abruf per GitHub Actions, damit das Projekt nie pausiert. Ohne Geheimnisse, nur mit dem öffentlichen Publishable Key. In E2-1 einplanen.
   - Folge, offen für E2-1: Der Abruf braucht ein Ziel, das ohne Anmeldung antwortet und keine Daten preisgibt (z. B. eine Funktion `ping`, die nur `true` liefert; die einzige Ausnahme zu „`anon` bekommt keine Rechte“). Ob eine Anfrage mit Fehlerantwort als Aktivität zählt, ist unsicher und wird in E2-1 geprüft. GitHub schaltet geplante Workflows in öffentlichen Repositories nach 60 Tagen ohne Aktivität im Repository ab; das kommt mit in die README.
8. **Datenschutzhinweis/Impressum** (ETAPPE2.md): Soll die App einen kurzen Datenschutzhinweis bekommen (Supabase, SMTP-Anbieter, was gespeichert wird)? Das ist eine rechtliche Frage, die ich nicht verbindlich beantworten kann. *Empfehlung: kurzer Hinweis in den Einstellungen.*
   - **Entscheidung:** Ja, ein kurzer Datenschutzhinweis in den Einstellungen (E2-5).
   - Folge: Zusätzlich kommt ein einfaches Impressum (Entscheidung des PO, 20.10.2026; To-do in E2-5 und in `ETAPPE2.md` Abschnitt 1).
9. **Konto löschen / Haushalt verlassen:** in der App bauen oder von Hand durch den PO im Dashboard (dokumentiert)? *Empfehlung: von Hand, bei zwei Personen.*
   - **Entscheidung:** Von Hand durch den PO, dokumentiert (README, E2-5). Die App bekommt keine Funktion dafür.
10. **Screenreader-Prüfung der Anmeldung von Hand** (in ETAPPE2.md empfohlen, weil Passkey-Dialoge vom System kommen): durchführen oder wie in Etappe 1 bewusst weglassen?
    - **Entscheidung:** Keine Screenreader-Prüfung von Hand, wie in Etappe 1. Die automatischen Prüfungen (axe, Tastatur, Fokus, Kontrastmodus) sichern die Barrierefreiheit.
11. **Docker Desktop lokal:** installieren (dann `check:db` auch lokal) oder `check:db` nur in CI laufen lassen?
    - **Entscheidung:** Kein Docker Desktop lokal; `check:db` läuft nur in CI.
    - Folge: „Fertig, wenn“ in E2-1 bis E2-3 gilt für `check:db` nur auf GitHub. Fehler dort zeigen sich erst nach dem Hochladen; der Skill `/paket` wartet deshalb auf den Job `db`. `npm run check:db` bleibt als Befehl für CI erhalten und sagt lokal ohne Docker, dass er nur in CI läuft.
12. **App-Symbol:** bleibt blau oder wird im Violett des neuen Designs neu gezeichnet?
    - **Entscheidung (20.10.2026, endgültig):** Das Symbol ist der Keks-Krümel mit Gesicht und Besen auf violetter Kachel; Vorlage `docs/design/kruemel-icon.svg`. Es wird nicht neu entworfen.
    - Folge: In E2-4 entstehen daraus alle Größen (`public/icon.svg`, `npm run icons`, maskierbar, Apple-Touch-Symbol), Manifest und `pwa.test.ts` werden angepasst; die sichere Zone maskierbarer Symbole wird geprüft (Abstand anpassen, Motiv nicht ändern). Der Satz „blaue Kachel mit weißem Haus“ in `ANFORDERUNGEN.md` (N3 App auf dem Home-Bildschirm) wird dann in E2-4a ersetzt. Der Krümel bleibt in allen Varianten goldbraun und rund, nie blau oder zottelig.
13. **App-Name:** „Putzplan“ oder neu?
    - **Entscheidung (20.10.2026):** Die App heißt **Krümel** (Code und Dateien: `kruemel`). Das Repository wird als erster Schritt von E2-3 in `kruemel` umbenannt (Liste der Folgen dort); die sichtbaren Texte, das Manifest, der Seitentitel und die Dateinamen der Sicherung folgen in E2-4.

## 7. Prüfung dieses Plans

- Nach jedem Paket: `npm run check` lokal und auf GitHub grün, ab E2-1 auch Job `db`.
- E2-3 und E2-5 prüft der PO zusätzlich auf zwei echten Geräten gegen das echte Projekt; E2-5 ist der volle Gerätetest.
