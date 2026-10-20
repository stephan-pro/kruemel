# Putzplan – Prüfliste für Etappe 2

Stand: 20.10.2026 (Abschluss Etappe 1) · Grundlage: `ANFORDERUNGEN.md` (Abschnitt 3 „Etappen“, „Sicherheit (Etappe 2)“ S1–S6, Abschnitt 9) und `PLAN.md`

Etappe 2 macht aus der lokalen App eine gemeinsame: eine Datenbank für beide Personen, Anmeldung, dieselben Daten auf allen Geräten. Diese Liste sammelt, was **vor** und **während** Etappe 2 zu entscheiden und zu prüfen ist. Haken setzen, wenn erledigt; zu jedem Punkt steht, wie er geprüft wird.

## 1. Entscheidungen vorab (Product Owner)

- [ ] **Anbieter für Anmeldung und Datenbank** gewählt, Serverstandort in der EU (S1), kostenlos im Rahmen der zu erwartenden Nutzung (N6: zwei Personen, wenige Hundert Aufgaben). Ergebnis mit Begründung in `PLAN.md` (neue Abhängigkeiten nur mit Begründung, N7).
- [ ] **Vertrag zur Auftragsverarbeitung** (AVV) des Anbieters geprüft und abgeschlossen, soweit nötig.
- [ ] Klären, ob die App eine **Datenschutzerklärung** und ein **Impressum** braucht (öffentliche Adresse, aber nur zwei Nutzer).
- [ ] **Ohne Internet:** Bleibt die App offline bedienbar (Änderungen werden später übertragen) oder nur lesbar? Etappe 1 ist voll offline-fähig (N3); eine Einschränkung muss bewusst entschieden und in Abschnitt 9 eingetragen werden.
- [ ] **Gleichzeitige Änderungen:** Was gilt, wenn beide Personen dieselbe Aufgabe fast gleichzeitig abhaken oder bearbeiten? (Vorschlag: zuerst Gespeichertes gewinnt, die zweite Person sieht einen Hinweis; zweimal Abhaken desselben Durchgangs darf nicht zwei Erledigungen ergeben.)
- [ ] **Umzug der Daten** aus Etappe 1: Weg festlegen (Vorschlag: „Sicherung herunterladen“ auf dem Hauptgerät, nach der ersten Anmeldung „Sicherung einspielen“; F7 ist dafür gebaut).

## 2. Sicherheit S1–S6

| | Anforderung | Prüfen |
|---|---|---|
| **S1** | Anmeldung über einen etablierten Dienst mit Serverstandort in der EU, keine eigene Lösung. | [ ] Anbieter und Region im Vertrag/in der Konsole nachgewiesen (Bildschirmfoto in den Unterlagen). [ ] Im Code gibt es keine eigene Passwort- oder Sitzungsverwaltung (Durchsicht). |
| **S2** | Passkeys sind der Hauptweg der Anmeldung. | [ ] Anmeldung mit Passkey auf PC (Windows Hello), iPhone und Android im Gerätetest. [ ] Die Anmeldeseite bietet Passkey zuerst an. |
| **S3** | Rückfallebene: Code aus einer Authenticator-App (TOTP). | [ ] Einrichten und Anmelden mit TOTP auf einem Gerät ohne Passkey. [ ] Ablauf, wenn beides verloren ist (Wiederherstellung) ist beschrieben. |
| **S4** | Keine Passwörter in der App, keine eigene Kryptografie. | [ ] Durchsicht: kein Speichern von Passwörtern, keine selbst geschriebene Verschlüsselung oder Signatur; nur die Bibliothek des Anbieters und Browser-Standards (WebAuthn). [ ] Schlüssel und Geheimnisse stehen nicht im Repository (öffentlich!); nur öffentliche Client-Kennungen im Code. |
| **S5** | Jeder Haushalt sieht nur seine Daten, erzwungen durch Zugriffsregeln in der Datenbank. | [ ] Zugriffsregeln (z. B. Row Level Security) für jede Tabelle eingeschaltet. [ ] **Automatischer Test** gegen die Datenbank: Ein zweiter Test-Haushalt kann Daten des ersten weder lesen noch ändern noch löschen, auch nicht mit direkten Anfragen an die Schnittstelle (nicht nur über die App). [ ] Ohne Anmeldung ist nichts lesbar. |
| **S6** | Datensparsamkeit: nur Nötiges speichern, keine Analyse- oder Werbedienste, keine Abrufe bei Drittanbietern. | [ ] Gespeicherte Felder entsprechen dem Datenmodell aus Etappe 1 (Namen, Aufgaben, Erledigungen) plus Anmeldedaten beim Anbieter. [ ] E2E-Test: Die App lädt nichts von fremden Adressen außer dem gewählten Anbieter (wie `design.spec.ts` für die Schrift). [ ] Keine Analyse-Skripte, keine Cookies außer für die Anmeldung. |

## 3. Technik

- [ ] **Nur die Speicher-Schnittstelle tauschen:** neue Umsetzung von `AppStorage` (`src/storage/storage.ts`) für die Datenbank; Fachlogik (`src/domain/`) und Seiten bleiben unverändert. Die Schnittstelle ist schon asynchron.
- [ ] **„Ich bin“ (F5)** kommt aus der Anmeldung statt aus der Geräteauswahl; die Geräteeinstellungen (Darstellung, Hinweis „Putzplan als App“) bleiben lokal.
- [ ] **`schemaVersion`** und Migration (`src/storage/migrate.ts`) gelten weiter, auch für Sicherungen aus Etappe 1 (Version 2).
- [ ] **Service Worker** (`src/sw.ts`): Anfragen an die Datenbank und den Anmeldedienst nie zwischenspeichern (heute bearbeitet er nur eigene Dateien; so lassen).
- [ ] **Content Security Policy** festlegen (GitHub Pages erlaubt keine eigenen Header: als `<meta http-equiv>` in `index.html`), mit den Adressen des Anbieters.
- [ ] **Tests:** Unit-Tests mit einer Fake-Umsetzung der neuen Speicher-Schnittstelle; E2E gegen eine lokale Test-Instanz oder einen Emulator des Anbieters, nie gegen echte Daten; `npm run check` bleibt der eine Befehl und läuft weiter ohne Zugangsdaten.
- [ ] **CI:** Geheimnisse nur als GitHub-Secrets; Workflows für Pull Requests aus fremden Forks bekommen keine Secrets.

## 4. Barrierefreiheit und Geräte

- [ ] Neue Seiten (Anmeldung, Passkey, TOTP, Fehler) mit axe in hell und dunkel, Tastatur und Kontrastmodus wie in Etappe 1 (`tests/e2e/accessibility.spec.ts`).
- [ ] Anmeldung mit Screenreader (VoiceOver, TalkBack, NVDA): wurde in Etappe 1 nicht von Hand geprüft (GERAETETEST.md, Abschnitt 5 optional). Für die Anmeldung empfohlen, weil Passkey-Dialoge vom System kommen und nicht automatisch prüfbar sind.
- [ ] Gerätetest (`docs/GERAETETEST.md`) um Anmeldung, Abmelden, zwei Geräte gleichzeitig und Betrieb ohne Internet erweitern.

## 5. Offen aus Etappe 1 (bekannt, kein Fehler)

- iPhone: Wie Downloads aus der installierten App ankommen, hängt von iOS ab; im Gerätetest am 20.10.2026 funktionierten Download und Einspielen. Ein eigener Hinweis „Zuerst Sicherung herunterladen“ wurde deshalb nicht gebaut.
- Android zeigt beim Start der installierten App kurz hellen Hintergrund, auch im Dark Mode (das Manifest kennt nur eine Farbe).
- Installierte Apps holen eine neue Version erst beim Neustart mit Internet (Einstellungen → Version → „Neu laden“ erzwingt es).
