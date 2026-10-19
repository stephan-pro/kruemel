# Putzplan

[![check](https://github.com/stephan-pro/putzplan/actions/workflows/check.yml/badge.svg)](https://github.com/stephan-pro/putzplan/actions/workflows/check.yml)

Eine kleine App, mit der zwei Personen ihre Aufgaben im Haushalt planen: wiederkehrende Aufgaben wie „Bad putzen“ und kurzfristige wie „Einkaufen“.

Status: im Aufbau (Etappe 1 – Daten bleiben im Browser). Der App-Rahmen mit Ersteinrichtung, Navigation und Einstellungen steht; die Seiten Woche, Aufgaben und Erledigt folgen.

**Online:** https://stephan-pro.github.io/putzplan/ (wird nach jedem grünen `check` auf `main` automatisch aktualisiert)

## Einrichten

Voraussetzungen: [Node.js](https://nodejs.org/) (Version siehe `.nvmrc`) und [Git](https://git-scm.com/).

Ein Befehl richtet ein frisch heruntergeladenes Projekt komplett ein (Pakete **und** die Browser für die End-to-End-Tests):

```bash
npm run setup
```

Der Befehl ist gefahrlos wiederholbar, z. B. nach einem Node-Update oder wenn die Fehlermeldung „Executable doesn't exist“ erscheint. Er ersetzt `npm install` und `npx playwright install chromium webkit`.

## Prüfen

```bash
npm run check
```

Der Befehl prüft Formatierung, Code-Regeln, Typen, Tests und Build und endet mit „✅ bestanden“ oder „❌ nicht bestanden in Schritt …“. Er schlägt auch fehl, wenn

- keine Unit-Tests gefunden werden,
- die Testabdeckung der Fachlogik (`src/domain/`) unter 90 % liegt oder
- die Playwright-Browser fehlen (dann mit dem Hinweis, `npm run setup` auszuführen).

## Ausprobieren mit Beispieldaten

```bash
npm run demo
```

Startet die App mit erfundenen Beispieldaten (zwei Personen, wiederkehrende und einmalige Aufgaben, Checklisten, Erledigtes), die sich nach dem heutigen Tag richten, und öffnet sie im Browser (`http://localhost:5173/putzplan/`). Beenden mit Strg+C.

- Die Daten liegen in einem eigenen Speicherbereich (`putzplan-demo`); echte Daten im selben Browser bleiben unberührt.
- Eigene Änderungen bleiben beim Neuladen erhalten. Frische Beispieldaten gibt es über den Link „Beispieldaten neu laden“ oder mit `?demo=neu` an der Adresse.
- Oben steht ein Hinweis mit der Anzahl der geladenen Beispieldaten. Die Seiten Woche, Aufgaben und Erledigt sind noch Platzhalter (Pakete 8–11).

## Lizenz

[EUPL-1.2](LICENSE)
