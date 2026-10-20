---
name: paket
description: Setzt ein Arbeitspaket aus docs/PLAN.md (Etappe 1) oder docs/ETAPPE2-PLAN.md (Etappe 2, z. B. E2-0) um, vom Code über Tests und grünes npm run check (und ab E2-1 den Job db auf GitHub) bis zur aktualisierten Online-Version. Aufruf mit /paket <Nummer oder E2-N> und optional Zusatzhinweisen.
argument-hint: <Nummer oder E2-N> [Zusatzhinweise]
disable-model-invocation: true
---

# Arbeitspaket umsetzen

Aufruf: `/paket <Nummer oder E2-N> [Zusatzhinweise]`. Eingabe: $ARGUMENTS

Das erste Wort ist die Kennung des Pakets. Alles danach sind Zusatzhinweise des Product Owners; sie gelten zusätzlich zum Paket und gehen bei Widerspruch zur Paketbeschreibung vor.

- **Etappe 1:** eine Nummer (`12`) oder `R1`/`R2`. Quelle ist die Tabelle in `docs/PLAN.md` (Abschnitt „Arbeitspakete“).
- **Etappe 2:** `E2-0` bis `E2-5` (Groß-/Kleinschreibung egal; `E2-4a` und `E2-4b` sind die beiden Commits von E2-4, `E2-4` allein heißt beide nacheinander). Quelle ist `docs/ETAPPE2-PLAN.md` Abschnitt 3 (ausführlich) und die Tabelle im Kapitel „Etappe 2“ in `docs/PLAN.md` (Kurzfassung, dort wird der Haken gesetzt).

Fehlt die Kennung oder gibt es kein solches Paket, frag nach, statt zu raten. Ist das Paket in der Tabelle schon mit ✅ markiert, sag das und frag, ob es trotzdem (erneut) bearbeitet werden soll. Bei Etappe 2 gilt: Ein Paket setzt voraus, dass die Pakete davor abgeschlossen sind (E2-1 nach E2-0 usw.); ist das nicht so, sag es und frag.

## 1. Lesen

- `CLAUDE.md` (Befehle, Aufbau, Regeln, Wortliste – gilt auch dann, wenn es schon im Kontext steht, weil es sich geändert haben kann).
- `docs/PLAN.md`: die Paketzeile, die Leitlinien (Abschnitt 3) und die „Umsetzung Paket N“-Abschnitte der früheren Pakete, soweit sie das Paket berühren. Bei Etappe 2 das Kapitel „Etappe 2“.
- **Nur Etappe 2:** `docs/ETAPPE2-PLAN.md` ganz (Abschnitt 1 Leitentscheidungen, 2 Teststrategie, 3 das Paket mit „Fertig, wenn“, 5 Risiken, 6 **Entscheidungen des PO**, die dem übrigen Plan vorgehen) und `docs/ETAPPE2.md` (Prüfliste, Sicherheit S1–S6; was das Paket davon abdeckt, wird dort abgehakt). Bei E2-4 zusätzlich `docs/design/DESIGN.md` Version 2 und die `entwurf-v2-*.html` als Referenz.
- `docs/ANFORDERUNGEN.md`, soweit das Paket Anforderungen (F…, N…, Q…, S…) oder Abschnitt 9 „Entscheidungen“ berührt. Dort gilt bei Widerspruch Abschnitt 9.
- Den vorhandenen Code, an dem das Paket ansetzt (erst lesen, dann ändern; bestehende Bausteine wiederverwenden statt neu zu bauen).

## 2. Umsetzen

- Halte dich an die Regeln in `CLAUDE.md` (u. a.: Code englisch, Oberfläche deutsch, keine echten Namen, Fachlogik rein und ohne DOM/Speicher, Dateien nur mit Write/Edit, PowerShell-Syntax, neue Abhängigkeiten nur mit Begründung in `docs/PLAN.md`).
- Setze genau das Paket um, nicht die nächsten. Brauchst du etwas aus einem späteren Paket, nimm die kleinste Lösung und nenne sie in den Entscheidungen.
- Jedes Akzeptanzkriterium des Pakets (bei Etappe 2: jeder Punkt unter „Fertig, wenn“) ist mindestens ein Test, benannt nach dem Kriterium. Fachlogik bekommt Unit-Tests (Abdeckung ≥ 90 %, bei Etappe 2 auch `src/sync/`), Oberfläche E2E-Tests mit axe auf jeder neuen Seite und jedem neuen Dialog, in allen vier Playwright-Projekten.
- Barrierefreiheit gehört zur Umsetzung, nicht zur Nacharbeit (WCAG 2.1 AA): sichtbare Beschriftungen, Fehlermeldungen am Feld, sinnvolle Fokusführung, Bedienung per Tastatur.
- Sieh dir neue Oberfläche kurz im Browser an (`npm run demo` bzw. Dev-Server), nicht nur den Testbericht.
- E2E-Tests warten nach jedem Seitenwechsel auf den Fokus der Überschrift (`goToPage`/`expectPageShown` in `tests/e2e/helpers.ts`), bevor sie tippen oder Tasten drücken. Hash-Adressen direkt öffnen geht in WebKit nur über eine neue Seite.
- Lässt sich eine Anforderung nicht sinnvoll umsetzen oder ist sie unklar und die Antwort ändert das Ergebnis deutlich, frag den Product Owner. Sonst entscheide selbst, begründe knapp und halte die Entscheidung fest (Schritt 4).

### Zusätzlich bei Etappe 2

- **`npm run check` bleibt unabhängig von Docker, Internet und Zugangsdaten.** Kein Test in `check` darf das echte Supabase-Projekt oder die lokale Supabase-Instanz brauchen; dafür gibt es `FakeRemote` und den Fake-Server.
- **Keine Geheimnisse im Repo** (Service-Role-Key, App-Passwort des Gmail-Kontos, Zugang zum Projekt, `.env.local`). Öffentlich sind nur Projekt-URL und Publishable Key. Der Hook `.githooks/pre-commit` prüft nur die gestagten Änderungen (`scripts/scan-secrets.mjs`); zusätzlich keine Prüfung über den ganzen Verlauf starten.
- **`check:db` läuft nur in CI** (Entscheidung des PO: kein Docker auf seinem Rechner). Schreibe die Datenbank-Tests und -Migrationen trotzdem sorgfältig; ob sie laufen, zeigt erst der Job `db` auf GitHub (Schritt 3). Versuche nicht, Docker zu installieren oder zu starten.
- **Schritte des PO:** Pakete E2-1, E2-2, E2-3 und E2-5 enthalten Schritte, die nur der PO tun kann (Konten, Dashboard, `npx supabase link`/`db push`, Gerätetest, Abnahme). Mach alles, was im Repo geht, und gib dem PO die übrigen Schritte als nummerierte Liste mit genauen Klicks und Befehlen (Abschlussbericht). Melde das Paket nicht als fertig, solange ein „Fertig, wenn“-Punkt auf einem PO-Schritt beruht und der PO ihn nicht bestätigt hat; sag offen, welche Punkte noch fehlen.
- **Online-Version:** Bis zum Ende von E2-3 liefert GitHub Pages weiter die Etappe-1-App (`VITE_BACKEND=local`). Nur E2-3 stellt den Workflow `pages` auf `supabase` um.

## 3. Prüfen und veröffentlichen

1. `npm run check` lokal, bis es grün ist (nur die Kurzausgabe lesen; vor dem Veröffentlichen eines Releases zusätzlich `npm run check:full`). Rote Tests nicht abschwächen oder überspringen; Ursache beheben. Flackernde Tests wiederholt unter Last laufen lassen (`npx playwright test <Datei> --repeat-each 4 --workers 8`) und die Ursache beheben, nicht mit Wiederholungen übertünchen.
2. Doku nachführen (Schritt 4), dann alles zusammen committen (Nachricht auf Deutsch, `Paket N: …` bzw. `Paket E2-N: …`, mit der Attributionszeile der Sitzung) und auf `main` pushen. Das Paket ist ausdrücklich zum Veröffentlichen beauftragt.
3. Auf die Workflows des Commits warten (`gh run list`, dann `gh run watch <id> --exit-status`): `check` und **ab E2-1 auch den Job `db`** (liegt in demselben Workflow oder einem eigenen, je nach Umsetzung; beide müssen grün sein). Schlägt etwas fehl, Ursache aus dem Protokoll holen (`gh run view <id> --log-failed`), beheben, erneut pushen. Rote Datenbank-Tests nicht abschwächen: Weicht `FakeRemote` von den SQL-Regeln ab, ist das ein Fehler im Fake oder in der Migration, nicht im Test.
4. Danach auf den Workflow `pages` für denselben Commit warten (er veröffentlicht erst, wenn `check` und ab E2-1 `db` grün sind) und prüfen, dass die Online-Version (https://stephan-pro.github.io/kruemel/) den neuen Stand ausliefert, z. B. indem du eine neue Oberflächen-Zeichenkette im ausgelieferten `assets/index-*.js` suchst. **Bei E2-0 bis E2-2 ändert sich für Nutzer nichts:** Prüfe dort, dass `pages` grün ist, die Kachel „Version“ den neuen Commit nennt und die Online-Version unverändert Etappe 1 zeigt (kein Anmeldebildschirm). Erst ab E2-3 soll sie die gemeinsame Version ausliefern.

Fertig ist das Paket erst, wenn `npm run check` lokal und auf GitHub grün ist (bei Etappe 2 ab E2-1 auch `db`), die Online-Version aktualisiert ist und bei Etappe 2 alle PO-Schritte des Pakets bestätigt sind. Wenn etwas davon nicht gelingt, sag das offen und nenne den Stand, statt „fertig“ zu melden.

## 4. Doku nachführen

**Aufwand knapp halten (Test-Diät):** Nach einem Paket nur **eine Zeile** in `docs/PLAN.md` ändern: Paket in der Tabelle mit ✅ markieren, dazu Datum (z. B. „✅ 21.10.2026“). Die ausführliche Nachführung (Abschnitt „Umsetzung Paket N“, `docs/ETAPPE2.md` abhaken, `docs/ANFORDERUNGEN.md` Abschnitt 9) gibt es **nur am Ende einer Etappe** (nach E2-5), dann für alle Pakete der Etappe zusammen. Ausnahme: Eine neue Abhängigkeit wird sofort mit Begründung in `docs/PLAN.md` eingetragen, und eine Entscheidung, die das Verhalten für Nutzer ändert, sofort in Abschnitt 9. `CLAUDE.md` nur ändern, wenn sich Ordner, Befehle oder Regeln ändern.

Ausführliche Fassung, nur am Etappenende:

- `docs/PLAN.md`: Paket in der Tabelle mit ✅ markieren; neuen Abschnitt „Umsetzung Paket N (Entscheidungen)“ mit den technischen Entscheidungen anlegen; neue Abhängigkeiten dort begründen. Etappe 1: nummeriert vor „Hinweise“, Folgenummern anpassen. Etappe 2: als `## E2.4`, `## E2.5` … am Ende des Kapitels „Etappe 2“ (Titel „Umsetzung Paket E2-N (Entscheidungen)“). Bei Etappe 2 außerdem `docs/ETAPPE2.md`: Punkte abhaken, die das Paket nachweislich erfüllt, mit kurzem Nachweis (Test, Datei, Bildschirmfoto des PO); nichts abhaken, was nur der PO prüfen kann, bevor er es bestätigt hat.
- `CLAUDE.md`: Aufbau, Befehle und Regeln ergänzen, wenn sich etwas geändert hat (neue Ordner, Hilfen, Testdateien). Kurz halten. Den Block „Etappe 2 (geplant …)“ durch die tatsächlichen Ordner und Dateien ersetzen, sobald sie existieren.
- `docs/ANFORDERUNGEN.md`, Abschnitt 9 „Entscheidungen“: nur die Entscheidungen eintragen, die das Verhalten für Nutzerinnen und Nutzer betreffen (was die App tut, Grenzen, Regeln, Texte, Abläufe). Rein technische Entscheidungen gehören nur nach `PLAN.md`. Gibt es keine nutzerrelevanten Entscheidungen, trag nichts ein. Bestehende Einträge, die das Paket ändert oder bestätigt, aktualisieren statt doppeln (bei Etappe 2 steht das geplante Verhalten schon im Block „Etappe 2 (Entscheidungen des PO …)“; ersetze „geplant“ durch den umgesetzten Stand und nenne Abweichungen).

## 5. Abschlussbericht an den Product Owner

Kurz und verständlich, ohne Fachjargon, in dieser Reihenfolge:

1. **Was entstanden ist.**
2. **Welche Tests dazugekommen sind** (Unit und E2E, mit Anzahl und was sie abdecken; bei Etappe 2 auch, was `check:db` in CI prüft).
3. **Welche Entscheidungen** du treffen musstest; kennzeichne die, die in Abschnitt 9 von `docs/ANFORDERUNGEN.md` eingetragen wurden.
4. **Was du selbst in der App ausprobieren kannst** (nummerierte Schritte, mit `npm run demo` oder online).
5. **Nur Etappe 2: Was du selbst tun musst** (nummerierte Schritte für Dashboard, Konten, Terminbefehle, Gerätetest) und welche „Fertig, wenn“-Punkte davon abhängen.

Nenne außerdem ehrlich, was nicht fertig oder nicht geprüft ist, und Auffälliges, das du unterwegs gefunden hast.
