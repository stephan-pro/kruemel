# Putzplan

[![check](https://github.com/stephan-pro/putzplan/actions/workflows/check.yml/badge.svg)](https://github.com/stephan-pro/putzplan/actions/workflows/check.yml)

Eine kleine App, mit der zwei Personen ihre Aufgaben im Haushalt planen: wiederkehrende Aufgaben wie „Bad putzen“ und kurzfristige wie „Einkaufen“.

Status: im Aufbau (Etappe 1 – Daten bleiben im Browser).

## Einrichten

Voraussetzungen: [Node.js](https://nodejs.org/) (Version siehe `.nvmrc`) und [Git](https://git-scm.com/).

```bash
npm install
npx playwright install chromium webkit
```

## Prüfen

```bash
npm run check
```

Der Befehl prüft Formatierung, Code-Regeln, Typen, Tests und Build und endet mit „✅ bestanden“ oder „❌ nicht bestanden in Schritt …“.

## Lizenz

[EUPL-1.2](LICENSE)
