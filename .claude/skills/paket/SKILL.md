---
name: paket
description: Setzt ein Arbeitspaket aus docs/PLAN.md um, vom Code über Tests und grünes npm run check bis zur aktualisierten Online-Version. Aufruf mit /paket <Nummer> und optional Zusatzhinweisen.
argument-hint: <Nummer> [Zusatzhinweise]
disable-model-invocation: true
---

# Arbeitspaket umsetzen

Aufruf: `/paket <Nummer> [Zusatzhinweise]`. Eingabe: $ARGUMENTS

Die erste Zahl ist die Nummer des Pakets in der Tabelle in `docs/PLAN.md` (Abschnitt „Arbeitspakete“). Alles danach sind Zusatzhinweise des Product Owners; sie gelten zusätzlich zum Paket und gehen bei Widerspruch zur Paketbeschreibung vor. Fehlt die Nummer oder gibt es kein solches Paket, frag nach, statt zu raten. Ist das Paket in der Tabelle schon mit ✅ markiert, sag das und frag, ob es trotzdem (erneut) bearbeitet werden soll.

## 1. Lesen

- `CLAUDE.md` (Befehle, Aufbau, Regeln, Wortliste – gilt auch dann, wenn es schon im Kontext steht, weil es sich geändert haben kann).
- `docs/PLAN.md`: die Paketzeile, die Leitlinien (Abschnitt 3) und die „Umsetzung Paket N“-Abschnitte der früheren Pakete, soweit sie das Paket berühren.
- `docs/ANFORDERUNGEN.md`, soweit das Paket Anforderungen (F…, N…, Q…) oder Abschnitt 9 „Entscheidungen“ berührt. Dort gilt bei Widerspruch Abschnitt 9.
- Den vorhandenen Code, an dem das Paket ansetzt (erst lesen, dann ändern; bestehende Bausteine wiederverwenden statt neu zu bauen).

## 2. Umsetzen

- Halte dich an die Regeln in `CLAUDE.md` (u. a.: Code englisch, Oberfläche deutsch, keine echten Namen, Fachlogik rein und ohne DOM/Speicher, Dateien nur mit Write/Edit, PowerShell-Syntax, neue Abhängigkeiten nur mit Begründung in `docs/PLAN.md`).
- Setze genau das Paket um, nicht die nächsten. Brauchst du etwas aus einem späteren Paket, nimm die kleinste Lösung und nenne sie in den Entscheidungen.
- Jedes Akzeptanzkriterium des Pakets ist mindestens ein Test, benannt nach dem Kriterium. Fachlogik bekommt Unit-Tests (Abdeckung ≥ 90 %), Oberfläche E2E-Tests mit axe auf jeder neuen Seite und jedem neuen Dialog, in allen vier Playwright-Projekten.
- Barrierefreiheit gehört zur Umsetzung, nicht zur Nacharbeit (WCAG 2.1 AA): sichtbare Beschriftungen, Fehlermeldungen am Feld, sinnvolle Fokusführung, Bedienung per Tastatur.
- Sieh dir neue Oberfläche kurz im Browser an (`npm run demo` bzw. Dev-Server), nicht nur den Testbericht.
- E2E-Tests warten nach jedem Seitenwechsel auf den Fokus der Überschrift (`goToPage`/`expectPageShown` in `tests/e2e/helpers.ts`), bevor sie tippen oder Tasten drücken. Hash-Adressen direkt öffnen geht in WebKit nur über eine neue Seite.
- Lässt sich eine Anforderung nicht sinnvoll umsetzen oder ist sie unklar und die Antwort ändert das Ergebnis deutlich, frag den Product Owner. Sonst entscheide selbst, begründe knapp und halte die Entscheidung fest (Schritt 4).

## 3. Prüfen und veröffentlichen

1. `npm run check` lokal, bis es grün ist. Rote Tests nicht abschwächen oder überspringen; Ursache beheben. Flackernde Tests wiederholt unter Last laufen lassen (`npx playwright test <Datei> --repeat-each 4 --workers 8`) und die Ursache beheben, nicht mit Wiederholungen übertünchen.
2. Doku nachführen (Schritt 4), dann alles zusammen committen (Nachricht auf Deutsch, `Paket N: …`, mit der Attributionszeile der Sitzung) und auf `main` pushen. Das Paket ist ausdrücklich zum Veröffentlichen beauftragt.
3. Auf den Workflow `check` des Commits warten (`gh run list`, dann `gh run watch <id> --exit-status`). Schlägt er fehl, Ursache aus dem Protokoll holen (`gh run view <id> --log-failed`), beheben, erneut pushen.
4. Danach auf den Workflow `pages` für denselben Commit warten und prüfen, dass die Online-Version (https://stephan-pro.github.io/putzplan/) den neuen Stand ausliefert, z. B. indem du eine neue Oberflächen-Zeichenkette im ausgelieferten `assets/index-*.js` suchst.

Fertig ist das Paket erst, wenn `npm run check` lokal und auf GitHub grün ist und die Online-Version aktualisiert ist. Wenn etwas davon nicht gelingt, sag das offen und nenne den Stand, statt „fertig“ zu melden.

## 4. Doku nachführen

- `docs/PLAN.md`: Paket in der Tabelle mit ✅ markieren; neuen Abschnitt „Umsetzung Paket N (Entscheidungen)“ mit den technischen Entscheidungen anlegen (nummeriert vor „Hinweise“, Folgenummern anpassen); neue Abhängigkeiten dort begründen.
- `CLAUDE.md`: Aufbau, Befehle und Regeln ergänzen, wenn sich etwas geändert hat (neue Ordner, Hilfen, Testdateien). Kurz halten.
- `docs/ANFORDERUNGEN.md`, Abschnitt 9 „Entscheidungen“: nur die Entscheidungen eintragen, die das Verhalten für Nutzerinnen und Nutzer betreffen (was die App tut, Grenzen, Regeln, Texte, Abläufe). Rein technische Entscheidungen gehören nur nach `PLAN.md`. Gibt es keine nutzerrelevanten Entscheidungen, trag nichts ein. Bestehende Einträge, die das Paket ändert oder bestätigt, aktualisieren statt doppeln.

## 5. Abschlussbericht an den Product Owner

Kurz und verständlich, ohne Fachjargon, in dieser Reihenfolge:

1. **Was entstanden ist.**
2. **Welche Tests dazugekommen sind** (Unit und E2E, mit Anzahl und was sie abdecken).
3. **Welche Entscheidungen** du treffen musstest; kennzeichne die, die in Abschnitt 9 von `docs/ANFORDERUNGEN.md` eingetragen wurden.
4. **Was du selbst in der App ausprobieren kannst** (nummerierte Schritte, mit `npm run demo` oder online).

Nenne außerdem ehrlich, was nicht fertig oder nicht geprüft ist, und Auffälliges, das du unterwegs gefunden hast.
