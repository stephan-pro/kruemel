# Krümel – Prüfliste für Etappe 2

Stand: 20.10.2026 (Abschluss Etappe 1, Entscheidungen eingetragen) · Grundlage: `ANFORDERUNGEN.md` (Abschnitt 3 „Etappen“, „Sicherheit (Etappe 2)“ S1–S6, Abschnitt 9) und `PLAN.md`; Vorgehen und Pakete: `ETAPPE2-PLAN.md`

Etappe 2 macht aus der lokalen App eine gemeinsame: eine Datenbank für beide Personen, Anmeldung, dieselben Daten auf allen Geräten. Diese Liste sammelt, was **vor** und **während** Etappe 2 zu entscheiden und zu prüfen ist. Haken setzen, wenn erledigt; zu jedem Punkt steht, wie er geprüft wird.

## 1. Entscheidungen vorab (Product Owner)

- [x] **Anbieter für Anmeldung und Datenbank** gewählt: Supabase, Region West EU (Paris, eu-west-3; Entscheidung des PO vom 20.10.2026 statt Frankfurt), Free Plan; Anmeldung per E-Mail-Einmalcode, Versand über ein eigenes Gmail-Konto nur für Krümel. Begründung in `PLAN.md` (Kapitel Etappe 2, neue Abhängigkeiten nur mit Begründung, N7). Der Nachweis der Region (S1) kommt in E2-1.
- [ ] **Vertrag zur Auftragsverarbeitung** (AVV) des Anbieters geprüft und abgeschlossen, soweit nötig (PO, E2-1).
- [ ] **Mailversand über das Gmail-Konto (offen aus E2-1):** Konto `kruemel.haushaltsapp@gmail.com` steht (2-Faktor an), das App-Passwort ließ sich am 20.10.2026 nicht erzeugen (Google: „We couldn't verify it's you“). Bis dahin verschickt Supabase die Anmeldemails selbst: nur an Mitglieder der Supabase-Organisation (also nur an den PO) und höchstens 2 Mails pro Stunde. **Muss erledigt sein, bevor die zweite Person sich anmeldet** (Einladungstest in E2-2/E2-3): App-Passwort erzeugen, im Dashboard unter Authentication → Emails → SMTP Settings eintragen (Werte in `docs/SUPABASE.md`), dann die Mailvorlagen mit `{{ .Token }}` setzen (vorher gesperrt: „Set up custom SMTP to edit templates“) und `npm run try:sign-in` mit Code wiederholen. Stand 20.10.2026: Anmeldung über den Link der Standardmail erfolgreich getestet; Code-Länge 6, Gültigkeit 600 s und Adressen sind eingestellt.
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
