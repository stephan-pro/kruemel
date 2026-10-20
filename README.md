# Putzplan

[![check](https://github.com/stephan-pro/putzplan/actions/workflows/check.yml/badge.svg)](https://github.com/stephan-pro/putzplan/actions/workflows/check.yml)

Eine kleine App, mit der zwei Personen ihre Aufgaben im Haushalt planen: wiederkehrende Aufgaben wie „Bad putzen“ und kurzfristige wie „Einkaufen“.

**Online:** https://stephan-pro.github.io/putzplan/ (wird nach jedem grünen `check` auf `main` automatisch aktualisiert)

**Stand:** Etappe 1 ist abgeschlossen (20.10.2026). Alle Funktionen sind da; die Daten liegen nur im Browser des jeweiligen Geräts. Gemeinsame Daten für beide Personen kommen mit Etappe 2 (Prüfliste: [`docs/ETAPPE2.md`](docs/ETAPPE2.md)).

## So benutzt man die App

**Beim ersten Start** trägt man die zwei Namen ein und wählt „Ich bin“ (wer dieses Gerät benutzt). Jedes Gerät fragt einmal danach.

| Seite | Was man dort tut |
|---|---|
| **Woche** | Die laufende Woche als Kacheln: „Überfällig“ (orange, ganz oben), der heutige Tag mit seinen Aufgaben, „Stand“ (erledigt / fällig) und „Woche im Überblick“ (ein Tipp auf einen Tag zeigt ihn). Mit ✓ abhaken, danach geht „Rückgängig“. „Übernehmen“ nimmt eine Aufgabe der anderen Person nur dieses Mal oder dauerhaft. Ein Tipp auf eine Aufgabe öffnet ihre Details mit Checkliste. Pfeile oben blättern die Wochen, „Alle / Nur meine“ filtert. |
| **Aufgaben** | Alle offenen Aufgaben; **+ Neue Aufgabe** legt eine an (wiederkehrend oder einmalig, mit Symbol, Rhythmus, Zuständigkeit, Notiz und Checkliste). Bearbeiten und Löschen (mit Rückfrage). |
| **Erledigt** | Alles Abgehakte, das Neueste zuerst. Das jeweils letzte Abhaken einer Aufgabe lässt sich hier rückgängig machen. |
| **Einstellungen** | Namen und „Ich bin“ · **Darstellung**: Hell, Dunkel oder Automatisch (wie das Gerät), gilt nur für dieses Gerät · **Sicherung** herunterladen und einspielen · **Als App installieren** · **Auf anderem Gerät öffnen** (QR-Code) · **Version** mit „Neu laden“. |

Wichtig zu wissen:

- **Die Daten bleiben auf dem Gerät.** PC und Handy teilen sich nichts; auf dem iPhone hat sogar die installierte App andere Daten als Safari. Übertragen geht über **Einstellungen → Sicherung**: herunterladen, auf dem anderen Gerät einspielen.
- **Regelmäßig „Sicherung herunterladen“.** Safari löscht Daten von Websites, die 7 Tage nicht benutzt wurden, wenn die App nicht auf dem Home-Bildschirm liegt.
- Die App ist mit Tastatur und Screenreader bedienbar und funktioniert im Windows-Kontrastmodus.

## Auf dem Handy installieren

Am einfachsten: am PC **Einstellungen → Auf anderem Gerät öffnen → QR-Code zeigen** und den Code mit der Handykamera scannen. Dann:

- **iPhone (Safari):** Teilen (Quadrat mit Pfeil; bei neueren iOS erst •••) → **Zum Home-Bildschirm** → **Hinzufügen**.
- **Android (Chrome):** Hinweis „Putzplan als App“ unten auf der Seite Woche → **App installieren**, oder Menü ⋮ → **App installieren**.
- **Android (Firefox):** Menü ⋮ → **Zum Startbildschirm hinzufügen**.
- **Xiaomi, Redmi, POCO:** Passiert beim Hinzufügen nichts, braucht der Browser eine Erlaubnis: Handy-Einstellungen → Apps → Apps verwalten → Firefox (bzw. Chrome) → Weitere Berechtigungen → **Startbildschirm-Verknüpfungen**.

Die App zeigt die passende Anleitung selbst (Hinweis unten auf der Seite Woche, schließbar mit ×, und unter Einstellungen). Installiert läuft sie ohne Adressleiste und auch ohne Internet.

**Neue Versionen** kommen von selbst, wenn die App mit Internet neu gestartet wird. Welche läuft, steht unter **Einstellungen → Version**. Update erzwingen: dort **Neu laden**; notfalls die App ganz schließen (aus der Liste der offenen Apps wischen) und neu öffnen. Direkt nach einer Veröffentlichung kann es bis zu 10 Minuten dauern.

Praxistest auf echten Geräten: [`docs/GERAETETEST.md`](docs/GERAETETEST.md).

## Für die Entwicklung

### Einrichten

Voraussetzungen: [Node.js](https://nodejs.org/) (Version siehe `.nvmrc`) und [Git](https://git-scm.com/).

Ein Befehl richtet ein frisch heruntergeladenes Projekt komplett ein (Pakete **und** die Browser für die End-to-End-Tests):

```bash
npm run setup
```

Der Befehl ist gefahrlos wiederholbar, z. B. nach einem Node-Update oder wenn die Fehlermeldung „Executable doesn't exist“ erscheint. Er ersetzt `npm install` und `npx playwright install chromium webkit`.

### Prüfen

```bash
npm run check
```

Der Befehl prüft Formatierung, Code-Regeln, Typen, Tests und Build und endet mit „✅ bestanden“ oder „❌ nicht bestanden in Schritt …“. Er schlägt auch fehl, wenn

- keine Unit-Tests gefunden werden,
- die Testabdeckung der Fachlogik (`src/domain/`, `src/storage/`, `src/demo/`) unter 90 % liegt oder
- die Playwright-Browser fehlen (dann mit dem Hinweis, `npm run setup` auszuführen).

Die End-to-End-Tests laufen in Chromium und WebKit (Safari), je am PC und in Handygröße, und prüfen jede Seite und jedes Fenster mit axe im hellen und im dunklen Farbschema.

### Ausprobieren mit Beispieldaten

```bash
npm run demo
```

Startet die App mit erfundenen Beispieldaten (zwei Personen, wiederkehrende und einmalige Aufgaben, Checklisten, Erledigtes), die sich nach dem heutigen Tag richten, und öffnet sie im Browser (`http://localhost:5173/putzplan/`). Beenden mit Strg+C.

- Die Daten liegen in einem eigenen Speicherbereich (`putzplan-demo`); echte Daten im selben Browser bleiben unberührt.
- Eigene Änderungen bleiben beim Neuladen erhalten. Frische Beispieldaten gibt es über den Link „Beispieldaten neu laden“ oder mit `?demo=neu` an der Adresse.
- Oben steht ein Hinweis mit der Anzahl der geladenen Beispieldaten. „Sicherung einspielen“ ersetzt auch hier nur die Demo-Daten.

### Unterlagen

- [`docs/ANFORDERUNGEN.md`](docs/ANFORDERUNGEN.md) – was die App können soll, mit allen Entscheidungen (Abschnitt 9).
- [`docs/PLAN.md`](docs/PLAN.md) – Technik, Arbeitspakete und technische Entscheidungen.
- [`docs/design/DESIGN.md`](docs/design/DESIGN.md) – Gestaltung.
- [`docs/GERAETETEST.md`](docs/GERAETETEST.md) – Prüfliste für echte Geräte, mit Ergebnis.
- [`docs/ETAPPE2-PLAN.md`](docs/ETAPPE2-PLAN.md) – Plan für Etappe 2 (gemeinsam nutzen) mit den Entscheidungen des Product Owners.
- [`docs/ETAPPE2.md`](docs/ETAPPE2.md) – Prüfliste für Etappe 2, inklusive Sicherheit S1–S6.

## Lizenz

[EUPL-1.2](LICENSE)
