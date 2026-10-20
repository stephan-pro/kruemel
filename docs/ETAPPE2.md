# Krümel – Prüfliste für Etappe 2

Stand: 20.10.2026 (Abschluss Etappe 1, Entscheidungen eingetragen) · Grundlage: `ANFORDERUNGEN.md` (Abschnitt 3 „Etappen“, „Sicherheit (Etappe 2)“ S1–S6, Abschnitt 9) und `PLAN.md`; Vorgehen und Pakete: `ETAPPE2-PLAN.md`

Etappe 2 macht aus der lokalen App eine gemeinsame: eine Datenbank für beide Personen, Anmeldung, dieselben Daten auf allen Geräten. Diese Liste sammelt, was **vor** und **während** Etappe 2 zu entscheiden und zu prüfen ist. Haken setzen, wenn erledigt; zu jedem Punkt steht, wie er geprüft wird.

## 1. Entscheidungen vorab (Product Owner)

- [x] **Anbieter für Anmeldung und Datenbank** gewählt: Supabase, Region West EU (Paris, eu-west-3; Entscheidung des PO vom 20.10.2026 statt Frankfurt), Free Plan; Anmeldung per E-Mail-Einmalcode, Versand über ein eigenes Gmail-Konto nur für Krümel. Begründung in `PLAN.md` (Kapitel Etappe 2, neue Abhängigkeiten nur mit Begründung, N7). Der Nachweis der Region (S1) kommt in E2-1.
- [x] **Vertrag zur Auftragsverarbeitung** (AVV) des Anbieters geprüft und abgeschlossen, soweit nötig (PO, E2-1). *Entscheidung des PO (20.10.2026): kein AVV nötig (private Nutzung).* Stand 20.10.2026 (Quelle: Supabase-Dashboard, Organization settings → Legal Documents): Das Data Processing Addendum ist Teil der Nutzungsbedingungen von Supabase und gilt für alle Organisationen automatisch, „No separate signed DPA is needed“; es gibt nur „View DPA“ und ein Transfer Impact Assessment (TIA). Kein eigenes Unterschreiben nötig. DSGVO-Einordnung: private Nutzung im Haushalt (Haushaltsausnahme), Daten in der EU (Region Paris).
- [x] **Mailversand (vorläufig, Runde 6, 20.10.2026):** Das Krümel-Konto `kruemel.haushaltsapp@gmail.com` ist von Google für bis zu 7 Tage gesperrt. Der Versand läuft deshalb **vorübergehend über die private Gmail-Adresse des PO** (App-Passwort „Krümel temporär“, nur im Supabase-Dashboard gespeichert). Die Vorlagen „Confirm signup“ und „Magic link“ sind auf den Code umgestellt (Text: `supabase/templates/code.html`), die Mail mit 6-stelligem Code kommt an. Einstellungen: Code-Länge 6, Gültigkeit 600 s, Adressen gesetzt (Referenz in `docs/SUPABASE.md`).
- [ ] **Offen: Mailversand endgültig umstellen:** SMTP auf `kruemel.haushaltsapp@gmail.com` (sobald entsperrt) oder eine eigene Domain, danach das App-Passwort „Krümel temporär“ im Google-Konto **widerrufen**. Muss erledigt sein, bevor die zweite Person sich anmeldet; `npm run try:sign-in` danach wiederholen.
- [ ] **Datenschutz:** Entschieden ist ein kurzer **Datenschutzhinweis** in den Einstellungen (E2-5).
- [ ] **Impressum (To-do, E2-5):** Entschieden ist ein einfaches **Impressum** (Entscheidung des PO, 20.10.2026), erreichbar aus den Einstellungen. Welche Angaben genau nötig sind (öffentliche Adresse, aber nur zwei Nutzer), klärt der PO; ob seine Anschrift im öffentlichen Repository stehen darf, entscheidet er ebenfalls. Nachweis: Seite in der App, E2E-Test mit axe.
- [x] **App-Name** ist „Krümel“ (Entscheidung des PO, 20.10.2026). [ ] Repository und Adresse umbenannt (E2-3, erster Schritt). [ ] Sichtbare Texte, Manifest, Seitentitel, Dateinamen der Sicherung und App-Symbol (`docs/design/kruemel-icon.svg`) umgestellt (E2-4).
- [x] **Ohne Internet:** Die App bleibt offline voll bedienbar, Änderungen werden nachgereicht (N3, `ANFORDERUNGEN.md` Abschnitt 9). Einspielen einer Sicherung geht nur online.
- [x] **Gleichzeitige Änderungen:** Pro Feld gewinnt die zuletzt beim Server angekommene Änderung, die Checkliste zählt als ein Feld; Löschen gewinnt gegen Bearbeiten; zweimal Abhaken desselben Durchgangs zählt einmal, die zweite Person sieht einen Hinweis (`ANFORDERUNGEN.md` Abschnitt 9).
- [x] **Umzug der Daten** aus Etappe 1: Der Haushalt startet leer. Wer Daten behalten will, lädt vorher „Sicherung herunterladen“ und spielt sie nach der ersten Anmeldung ein (F7); die README beschreibt das mit einem Satz (E2-5).

## 2. Sicherheit S1–S6

| | Anforderung | Prüfen |
|---|---|---|
| **S1** | Anmeldung über einen etablierten Dienst mit Serverstandort in der EU, keine eigene Lösung. | [ ] Anbieter und Region im Vertrag/in der Konsole nachgewiesen (Bildschirmfoto in den Unterlagen). [ ] Im Code gibt es keine eigene Passwort- oder Sitzungsverwaltung (Durchsicht). |
| **S2** | Hauptweg der Anmeldung ist ein Einmalcode per E-Mail (Code eingeben, kein Link); kein Passwort, kein TOTP. | [ ] Anmeldung mit Code auf PC, Android und iPhone (Safari und installierte App) im Gerätetest. [ ] Falscher und abgelaufener Code zeigen eine Meldung am Feld (E2E). [ ] Code aus der lokalen Instanz im Test (Mailpit, `check:db`). [ ] Die E-Mail kommt vom Gmail-Konto für Krümel an (PO, E2-1). |
| **S3** | Passkey ist zusätzlich möglich (Beta), nie der einzige Weg. | [ ] Vorversuch (Spike) in E2-2 ausgewertet. [ ] Entweder: Passkey auf PC (Windows Hello), iPhone und Android im Gerätetest, in Chromium mit virtuellem Authenticator getestet. Oder: begründet aufgeschoben (Grund in `PLAN.md`). [ ] Ablauf, wenn ein Gerät verloren ist (Anmeldung mit Code auf einem neuen Gerät), ist in der README beschrieben. |
| **S4** | Keine Passwörter in der App, keine eigene Kryptografie. | [ ] Durchsicht: kein Speichern von Passwörtern, keine selbst geschriebene Verschlüsselung oder Signatur; nur die Bibliothek des Anbieters und Browser-Standards (WebAuthn). [ ] Schlüssel und Geheimnisse stehen nicht im Repository (öffentlich!); nur öffentliche Client-Kennungen im Code. |
| **S5** | Jeder Haushalt sieht nur seine Daten, erzwungen durch Zugriffsregeln in der Datenbank. | [ ] Zugriffsregeln (z. B. Row Level Security) für jede Tabelle eingeschaltet. [ ] **Automatischer Test** gegen die Datenbank: Ein zweiter Test-Haushalt kann Daten des ersten weder lesen noch ändern noch löschen, auch nicht mit direkten Anfragen an die Schnittstelle (nicht nur über die App). [ ] Ohne Anmeldung ist nichts lesbar. |
| **S6** | Datensparsamkeit: nur Nötiges speichern, keine Analyse- oder Werbedienste, keine Abrufe bei Drittanbietern. | [ ] Gespeicherte Felder entsprechen dem Datenmodell aus Etappe 1 (Namen, Aufgaben, Erledigungen) plus Anmeldedaten beim Anbieter. [ ] E2E-Test: Die App lädt nichts von fremden Adressen außer dem gewählten Anbieter (wie `design.spec.ts` für die Schrift). [ ] Keine Analyse-Skripte, keine Cookies außer für die Anmeldung. |

## 3. Technik

- [ ] **Nur die Speicher-Schnittstelle tauschen:** neue Umsetzung von `AppStorage` (`src/storage/storage.ts`) für die Datenbank; Fachlogik (`src/domain/`) und Seiten bleiben unverändert. Die Schnittstelle ist schon asynchron.
- [ ] **„Ich bin“ (F5)** kommt aus der Anmeldung statt aus der Geräteauswahl; die Geräteeinstellungen (Darstellung, Hinweis „Putzplan als App“, ab E2-4 „Krümel als App“) bleiben lokal.
- [x] **`schemaVersion`** und Migration (`src/storage/migrate.ts`) gelten weiter, auch für Sicherungen aus Etappe 1 (Version 1 und 2): Datenmodell Version 3 mit Migration, getestet für Laden und Import (E2-0: `migrate.test.ts`, `localStorage.test.ts`, `exportImport.test.ts`).
- [ ] **Service Worker** (`src/sw.ts`): Anfragen an die Datenbank und den Anmeldedienst nie zwischenspeichern (heute bearbeitet er nur eigene Dateien; so lassen).
- [ ] **Content Security Policy** festlegen (GitHub Pages erlaubt keine eigenen Header: als `<meta http-equiv>` in `index.html`), mit den Adressen des Anbieters.
- [ ] **Tests:** Unit-Tests mit einer Fake-Umsetzung der neuen Speicher-Schnittstelle; E2E gegen einen lokalen Fake-Server (`scripts/fake-server.ts`), die Datenbank-Regeln (S5) und die Anmeldung gegen eine lokale Supabase-Instanz in `npm run check:db`, das nur auf GitHub läuft; nie gegen echte Daten. `npm run check` bleibt der eine Befehl und läuft weiter ohne Docker und ohne Zugangsdaten (`ETAPPE2-PLAN.md` Abschnitt 2). *Stand nach E2-0:* Unit-Tests gegen `FakeRemote` und E2E gegen den Fake-Server stehen und laufen in `check`; die Datenbank-Regeln (S5) und die Anmeldung in `check:db` folgen in E2-1 und E2-2.
- [ ] **CI:** Projekt-URL und Publishable Key sind öffentlich und stehen als GitHub-Repository-Variablen; echte Geheimnisse (Service-Role-Key, App-Passwort des Gmail-Kontos, Zugang zum Projekt) kommen nie ins Repo und nie in CI. Workflows für Pull Requests aus fremden Forks bekommen keine Secrets. Job `db` braucht keine Geheimnisse; `pages` wartet auf `check` und `db`.

## 4. Barrierefreiheit und Geräte

- [ ] Neue Seiten (Anmeldung, Code, Passkey, Haushalt, Einladung, Fehler) mit axe in hell und dunkel, Tastatur und Kontrastmodus wie in Etappe 1 (`tests/e2e/accessibility.spec.ts`).
- [x] Anmeldung mit Screenreader (VoiceOver, TalkBack, NVDA): **bewusst nicht von Hand geprüft** (Entscheidung des PO am 20.10.2026, wie in Etappe 1; GERAETETEST.md, Abschnitt 5 optional). Die automatischen Prüfungen bleiben. Passkey-Dialoge kommen vom System und sind nicht automatisch prüfbar; das ist bekannt.
- [ ] Gerätetest (`docs/GERAETETEST.md`) um Anmeldung, Abmelden, zwei Geräte gleichzeitig und Betrieb ohne Internet erweitern.

## 5. Offen aus Etappe 1 (bekannt, kein Fehler)

- iPhone: Wie Downloads aus der installierten App ankommen, hängt von iOS ab; im Gerätetest am 20.10.2026 funktionierten Download und Einspielen. Ein eigener Hinweis „Zuerst Sicherung herunterladen“ wurde deshalb nicht gebaut.
- Android zeigt beim Start der installierten App kurz hellen Hintergrund, auch im Dark Mode (das Manifest kennt nur eine Farbe).
- Installierte Apps holen eine neue Version erst beim Neustart mit Internet (Einstellungen → Version → „Neu laden“ erzwingt es).

## E2-2 Plan

Stand 20.10.2026. Inhalt und „Fertig, wenn“: `ETAPPE2-PLAN.md`, E2-2. Jeder Teilschritt endet mit grünem `npm run check` (ab b auch Job `db`) und einem Commit; die Online-Version bleibt im Modus `local`.

| Schritt | Ziel | Ordner | Größe | Modell | Tests |
|---|---|---|---|---|---|
| **E2-2a** Auth-Anbindung | `SupabaseAuth` (supabase-js `signInWithOtp`/`verifyOtp`, Fehler → `AuthFailure`, Sitzung aus dem Speicher auch offline), `FakeAuth` per HTTP am Fake-Server samt Client | `src/auth/`, `scripts/fake-server.ts`, `supabase/tests/` | mittel | Opus High | `describeAuthContract` für Fake (Vitest) und lokale Instanz mit Code aus Mailpit (`check:db`) |
| **E2-2b** Haushalt-Schnittstelle | `HouseholdApi`: anlegen, Mitglieder, Einladung erzeugen/annehmen, Fehlerarten (abgelaufen, benutzt, voll, schon Mitglied); Fake und RPC | `src/auth/` (oder `src/household/`), `src/sync/fake*`, `supabase/tests/` | mittel | Opus Medium | Vertragstest für Fake und RPC, Einladung durch zweiten Benutzer |
| **E2-2c** Anmeldeseiten | Gate in `App.tsx` (nur `fake`/`supabase`): „Anmelden“ → „Code eingeben“ (`one-time-code`, erneut senden nach 60 s, Meldung am Feld), Laden ohne Netz mit gemerkter Sitzung | `src/ui/pages/`, `src/ui/App.tsx`, `tests/e2e/` | viele | Sonnet High | E2E (Fake): Code richtig/falsch/abgelaufen, zu viele Versuche, offline, axe |
| **E2-2d** Haushalt und Einladung | „Haushalt anlegen“, Kachel „Haushalt“ (Link, Kopieren, Teilen, QR über `qrCode.ts`), `#/einladung/<token>` mit vier Fehlerseiten | `src/ui/`, `tests/e2e/` | viele | Sonnet Medium | E2E (Fake) mit zwei Kontexten, alle Fehlerfälle, axe |
| **E2-2e** Rolle und Abmelden | „Ich bin“ aus der Rolle; Einstellung „Ich bin“ und „Ich bin: <Name>“ entfallen (außer `local`/Demo), „Angemeldet als <Name> · Abmelden“ | `src/ui/`, `tests/e2e/` | mittel | Sonnet Medium | E2E Abmelden (mit Rückfrage), Anzeige; bestehende Tests im Modus `local` unverändert grün |
| **E2-2f** Passkey-Spike | Prüfen, ob supabase-js und lokale Instanz Passkeys tragen; Ergebnis und Entscheidung in `PLAN.md` | `docs/` | wenige | Sonnet Medium | keine (nur Doku) |

**Reihenfolge:** a → b → c → d → e; f unabhängig, jederzeit. c braucht a, d braucht b und c, e braucht c. Ohne endgültigen Mailversand testbar: alles in Vitest und E2E gegen den Fake (`lastCode` statt Mail) und `check:db` (Mailpit der lokalen Instanz). Am echten Projekt reicht der vorläufige Versand für den PO allein (`npm run dev` nach c); nur die Anmeldung der zweiten Person braucht den endgültigen Absender.

**Entscheidungen des PO** (Empfehlung in Klammern; am 20.10.2026 alle fünf so entschieden):
1. Lokale Daten bei der ersten Anmeldung (Ersteller-Gerät bietet „Bisherige Aufgaben übernehmen“ an, vorher automatische Sicherung; umgesetzt in E2-3, E2-2 lässt die lokalen Daten unberührt).
2. Passkey (aufschieben, Spike f nur als Notiz; der Code reicht für zwei Personen).
3. Abmelden (löscht die Kopie auf dem Gerät nach Rückfrage, warnt bei ausstehenden Änderungen).
4. Online-Version (bleibt bis Ende E2-3 im Modus `local`).
5. Einladungstest mit der zweiten Person (erst mit endgültigem Absender, nicht über die private Adresse).

**Risiken:** Sitzung läuft ab oder Gerät startet offline → gemerkte Sitzung weiter nutzen, Auffrischen still im Hintergrund, Anmeldeseite erst bei endgültiger Ablehnung. Code falsch/abgelaufen oder Mail-Limit erreicht → eigene Meldung am Feld; alte lokale Daten dürfen bei der ersten Anmeldung weder verloren gehen noch doppelt in den Haushalt kommen.

**Aufwand:** Teuerster Schritt ist **E2-2c** (Gate, Sitzung offline, viele E2E-Fälle): **mittel**, etwa halb so groß wie E2-4a. a und b sind kleiner, aber sicherheitskritisch (Opus).
