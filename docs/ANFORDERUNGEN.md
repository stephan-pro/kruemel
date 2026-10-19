# Putzplan – Anforderungen

Stand: 19.10.2026 · Product Owner: Stephan Prommer

## 1. Ziel

Person A und Person B organisieren gemeinsam alle Aufgaben im Haushalt: wiederkehrende Aufgaben mit festem Rhythmus und kurzfristige Aufgaben wie Einkäufe.

## 2. Nutzer und Geräte

| Person | Hauptgerät | Gelegentlich |
|---|---|---|
| Person A | Windows-PC | Android-Handy (Redmi) |
| Person B | iPhone | – |

## 3. Etappen

- **Etappe 1 – lokal:** alle Funktionen, Daten im Browser gespeichert. Ziel: Grundlagen lernen, App am PC nutzbar.
- **Etappe 2 – gemeinsam:** gemeinsame Datenbank, Anmeldung, App online. Ab dann nutzen beide die App auf allen Geräten.

Das Speichern wird in Etappe 1 bereits hinter einer klaren Schnittstelle gekapselt, damit Etappe 2 nur diese eine Stelle austauscht.

## 4. Funktionale Anforderungen

### F1 Wiederkehrende Aufgaben
- Felder: Titel, Rhythmus, zuständige Person, optional Notiz.
- Rhythmus: täglich, wöchentlich, monatlich – jeweils auch „alle N“ (z. B. alle 2 Wochen).
- Aufgaben lassen sich anlegen, bearbeiten und löschen.

### F2 Nächster Termin – der Zyklus startet beim Abhaken
Der nächste Termin wird immer ab dem Tag berechnet, an dem die Aufgabe abgehakt wird – nicht ab dem ursprünglichen Fälligkeitsdatum.

Akzeptanzkriterien:
- Wöchentlich, fällig Mo 19.10., abgehakt Mi 21.10. → neu fällig Mi 28.10.
- Täglich, abgehakt am 21.10. → neu fällig 22.10.
- Alle 2 Wochen, abgehakt am 21.10. → neu fällig 04.11.
- Monatlich, abgehakt am 15.10. → neu fällig 15.11.
- Monatlich, abgehakt am 31.01. → neu fällig am letzten Tag des Folgemonats (28.02. bzw. 29.02. im Schaltjahr).
- Überfällige Aufgabe, verspätet abgehakt → neuer Zyklus startet am Tag des Abhakens.
- Versehentliches Abhaken lässt sich rückgängig machen; der vorherige Termin wird wiederhergestellt.

### F3 Einmalige Aufgaben
- Felder: Titel, Fälligkeitsdatum, zuständige Person, optional Notiz.
- Nach dem Abhaken verschwinden sie aus der Wochenübersicht und landen bei „Erledigt“.

### F4 Checklisten
- Jede Aufgabe kann eine Checkliste haben (z. B. Einkaufsliste an „Einkaufen“).
- Einträge hinzufügen, einzeln abhaken, löschen.

### F5 Zuständigkeit
- Jede Aufgabe ist fest zugewiesen: Person A, Person B oder beide.
- Die Zuweisung ist jederzeit änderbar.
- „Übernehmen“ bei einer Aufgabe fragt: nur dieses Mal oder dauerhaft. Standard ist „nur dieses Mal“; beim nächsten Zyklus gilt wieder die feste Zuweisung.
- Beim Abhaken wird gespeichert, wer die Aufgabe erledigt hat.
- Etappe 1 (ohne Anmeldung): Auf jedem Gerät wählt man einmal „Ich bin: Person A / Person B“. In Etappe 2 ersetzt die Anmeldung diese Auswahl.

### F6 Startseite: Wochenübersicht
- Zeigt die laufende Woche Montag bis Sonntag mit allen fälligen Aufgaben.
- Überfällige Aufgaben stehen ganz oben und sind deutlich markiert.
- Der heutige Tag ist hervorgehoben.
- Vor- und zurückblättern zwischen Wochen.
- Filter: alle / nur meine Aufgaben.

### F7 Datensicherung
- Export aller Daten als Datei und Import aus dieser Datei.
- Dient in Etappe 1 als Backup und später zur Übernahme in die Datenbank.

## 5. Rahmenbedingungen

- **N1 Design:** KERN UX (`@kern-ux/native`). Keine KERN-Kopfzeile mit Bundesflagge oder anderen Hoheitszeichen, da die App kein Angebot einer Behörde ist.
- **N2 Barrierefreiheit:** WCAG 2.1 AA bzw. BITV 2.0; vollständig per Tastatur bedienbar, mit Screenreader nutzbar.
- **N3 Geräte:** responsiv für PC und Handy; als PWA auf iPhone und Android installierbar.
- **N4 Sprache:** Deutsch.
- **N5 Lizenz:** Open Source unter EUPL-1.2.
- **N6 Kosten:** kostenlos zu betreiben.
- **N7 Abhängigkeiten:** so wenige wie möglich; jede neue Bibliothek wird begründet.

## 6. Qualität und Tests – ohne Claude prüfbar

Jeder neue Stand muss sich **ohne Claude und ohne Tokens** vollständig prüfen lassen. Ein einziger Befehl reicht dafür.

- **Q1 Ein Befehl für alles:** `npm run check` führt nacheinander Formatierung, Linting, Typprüfung, alle Tests und den Build aus und meldet am Ende klar „bestanden“ oder „nicht bestanden“.
- **Q2 Typsicherheit:** TypeScript im strengen Modus.
- **Q3 Code-Stil:** Linter und Formatierer, automatisch angewendet.
- **Q4 Unit-Tests:** Die Fachlogik (vor allem Terminberechnung F2 und Zuständigkeit F5) liegt in reinen Funktionen ohne Oberfläche und ist vollständig getestet. Jedes Akzeptanzkriterium aus Abschnitt 4 ist mindestens ein Test.
- **Q5 Testabdeckung:** Mindestens 90 % für die Fachlogik; `npm run check` schlägt fehl, wenn sie unterschritten wird.
- **Q6 End-to-End-Tests:** Die wichtigsten Abläufe werden im echten Browser durchgespielt – in Chromium und WebKit (entspricht Safari auf dem iPhone), jeweils in Desktop- und Handygröße.
- **Q7 Automatische Barrierefreiheitsprüfung:** Jede Seite wird in den End-to-End-Tests mit axe geprüft; Verstöße lassen den Test fehlschlagen.
- **Q8 Testdaten:** Ein Befehl füllt die App mit realistischen Beispieldaten zum manuellen Ausprobieren.
- **Q9 Automatisierung auf GitHub:** Bei jedem Hochladen läuft dieselbe Prüfung wie `npm run check` automatisch auf GitHub (GitHub Actions). Das Ergebnis ist im Repository sichtbar.
- **Q10 Schutz vor Fehlern:** Vor jedem Speicherstand (Commit) laufen automatisch Formatierung und Linting.
- **Q11 Updates:** Abhängigkeiten werden automatisch auf Updates geprüft (Dependabot).

## 7. Sparsamer Umgang mit Tokens

- **T1** Eine kurze `CLAUDE.md` beschreibt Aufbau, Befehle und Regeln, damit Claude nicht jedes Mal das Projekt durchsuchen muss.
- **T2** Gearbeitet wird in kleinen, klar abgegrenzten Aufgaben – eine Aufgabe pro Sitzung.
- **T3** Vor einer Frage an Claude läuft `npm run check`. Claude bekommt nur die konkrete Fehlermeldung.
- **T4** Klare Ordnerstruktur und sprechende Namen, damit Claude gezielt einzelne Dateien liest.

## 8. Bewusst nicht in Version 1

Push-Benachrichtigungen, Statistiken, Punkte oder Belohnungen, weitere Haushaltsmitglieder.

## 9. Entscheidungen (19.10.2026)

Präzisierungen zu Abschnitt 4 und 5. Bei Widerspruch gilt dieser Abschnitt. Technik und Arbeitspakete: siehe `PLAN.md`.

- **F1:** Beim Anlegen einer wiederkehrenden Aufgabe wählt man den ersten Fälligkeitstermin selbst; vorbelegt ist heute.
- **F2 Rückgängig:** möglich direkt nach dem Abhaken (Hinweis „Rückgängig“) und jederzeit über „Erledigt“ – jeweils nur für das letzte Abhaken einer Aufgabe.
- **F3/F5:** „Übernehmen“ bei einer einmaligen Aufgabe weist sie ohne Rückfrage um.
- **F3 Erledigt:** enthält auch jeden erledigten Durchgang wiederkehrender Aufgaben; Einträge bleiben unbegrenzt.
- **F4:** Bei wiederkehrenden Aufgaben sind Checklisten Arbeitsschritte (z. B. Bad: Waschbecken, Toilette, Dusche). Beim Abhaken der Aufgabe werden alle Häkchen zurückgesetzt, die Einträge bleiben.
- **F4 Rückgängig:** Macht man das Abhaken einer wiederkehrenden Aufgabe rückgängig, kommen auch ihre Checklisten-Häkchen zurück.
- **F4 einmalige Aufgaben:** Beim Abhaken bleiben die Häkchen erhalten.
- **F5 Zuweisung ändern:** Eine neue feste Zuweisung beendet eine laufende „nur dieses Mal“-Übernahme.
- **F3 Löschen:** Wird eine Aufgabe gelöscht, verschwinden auch ihre Einträge in „Erledigt“. Deshalb wird nur nach Rückfrage gelöscht, die die Zahl dieser Einträge nennt (Paket 8, bestätigt).
- **F5 „beide“:** Ein Abhaken reicht. Die Aufgabe erscheint bei „nur meine“ für beide Personen.
- **F5 Namen:** Im Code stehen keine echten Namen. Die beiden Personennamen werden beim ersten Start in den Einstellungen festgelegt; „Ich bin“ wählt danach zwischen diesen Namen. Beispieldaten und Tests verwenden erfundene Namen.
- **F6:** Wiederkehrende Aufgaben erscheinen nur an ihrem nächsten echten Termin, keine Vorschau weiterer Termine. Vergangene Wochen zeigen erledigte Aufgaben ausgegraut mit „erledigt von“.
- **F6 Überfälliges (Paket 9):** Überfällige Aufgaben stehen in der laufenden Woche im Block „Überfällig“ ganz oben (älteste zuerst, mit „N Tage überfällig“ und dem ursprünglichen Termin) und nicht noch einmal an ihrem alten Tag. Blättert man in eine vergangene Woche, steht eine dort noch offene Aufgabe an ihrem Tag, als überfällig markiert; künftige Wochen zeigen nichts Überfälliges.
- **F6 Erledigtes (Paket 9):** Abgehakte Aufgaben verschwinden aus der laufenden und aus künftigen Wochen. Nur vergangene Wochen zeigen sie ausgegraut, an dem Tag, an dem sie fällig waren, mit „Erledigt von Name am Datum“.
- **F6 Bedienung (Paket 9):** Die Wochenübersicht öffnet immer mit der laufenden Woche und „Alle Aufgaben“; Woche und Filter werden nicht gespeichert. Wochen blättert man mit „Vorherige Woche“, „Diese Woche“ und „Nächste Woche“. Bleibt die Seite über Mitternacht offen, rückt „heute“ von selbst weiter. „Nur meine Aufgaben“ zeigt auch Aufgaben, die man „nur dieses Mal“ übernommen hat, und Aufgaben für „beide“.
- **F2 Abhaken (Paket 9):** Jede offene Aufgabe lässt sich mit „Abhaken“ erledigen, auch die der anderen Person und eine überfällige; gespeichert wird „erledigt von“ = „Ich bin“. Danach steht oben ein Hinweis (bei wiederkehrenden mit dem nächsten Termin) mit „Rückgängig“; er bleibt, bis man etwas anderes tut oder die Seite verlässt. Der Hinweis gilt nur für die zuletzt abgehakte Aufgabe; frühere Erledigungen macht man über „Erledigt“ rückgängig (Paket 11).
- **F7 Import:** ersetzt alle Daten nach Rückfrage; vorher wird automatisch eine Sicherung heruntergeladen.
- **F7 Format:** Die Sicherung ist eine JSON-Datei `putzplan-JJJJ-MM-TT.json` mit `schemaVersion`, Einstellungen (Namen), Aufgaben und Erledigungen. „Ich bin“ gehört zum Gerät und steht nicht darin. Eine Datei aus einer neueren App-Version oder mit Fehlern wird mit Fundstelle abgelehnt; die vorhandenen Daten bleiben dann unberührt.
- **Speicher:** Sind die gespeicherten Daten unlesbar, meldet die App das und überschreibt sie nicht durch leere Daten. Ist der Browser-Speicher voll oder gesperrt, meldet Speichern einen Fehler.
- **F5 Namen (Paket 7):** Beide Namen sind Pflicht, höchstens 30 Zeichen, und müssen sich unterscheiden. Die Ersteinrichtung fragt Namen und „Ich bin“ zugleich; Namen und „Ich bin“ lassen sich unter „Einstellungen“ ändern. Kennt ein Gerät die Namen, aber nicht „Ich bin“, fragt die App danach.
- **Speicher unlesbar (Paket 7):** Die App zeigt statt der Seiten eine Meldung mit Fundstellen und bietet zwei Wege an: Rohdaten als Datei herunterladen, danach (mit Rückfrage) neu beginnen. Ohne Herunterladen gibt es kein „Neu beginnen“.
- **Betrieb Etappe 1:** Die App liegt kostenlos auf GitHub Pages; die Daten bleiben trotzdem nur im jeweiligen Browser.
- **Repository:** öffentlich auf GitHub.
- **Code:** englische Namen im Code, Oberfläche deutsch; Wortliste in `CLAUDE.md`. Oberfläche mit Preact.
