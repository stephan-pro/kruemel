# Krümel – Anforderungen

Stand: 20.10.2026 · Product Owner: Stephan Prommer

**App-Name:** Die App heißt ab sofort **Krümel** (Entscheidung des PO, 20.10.2026; im Code und in Dateinamen ohne Umlaut: `kruemel`). Die Umbenennung (Texte, Manifest, Adresse, Dateinamen) ist seit E2-0b umgesetzt, nur das Symbol folgt in E2-4; die Etappe-1-Einträge in Abschnitt 9 nennen noch den alten Namen. Siehe „Etappe 2 (Entscheidungen des PO)“ in Abschnitt 9.

## 1. Ziel

Person A und Person B organisieren gemeinsam alle Aufgaben im Haushalt: wiederkehrende Aufgaben mit festem Rhythmus und kurzfristige Aufgaben wie Einkäufe.

## 2. Nutzer und Geräte

| Person | Hauptgerät | Gelegentlich |
|---|---|---|
| Person A | Windows-PC | Android-Handy (Redmi) |
| Person B | iPhone | – |

## 3. Etappen

- **Etappe 1 – lokal:** alle Funktionen, Daten im Browser gespeichert. Ziel: Grundlagen lernen, App am PC nutzbar.
- **Etappe 2 – gemeinsam:** gemeinsame Datenbank, Anmeldung, App online. Ab dann nutzen beide die App auf allen Geräten. Dazu gehören das neue Design „Persönlich“ und die Statistik (Paket E2-4). Plan: `ETAPPE2-PLAN.md`.

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
- Etappe 1 (ohne Anmeldung): Auf jedem Gerät wählt man einmal „Ich bin: Person A / Person B“.
- Etappe 2: „Ich bin“ kommt aus der Anmeldung (die Rolle im Haushalt); die Auswahl am Gerät entfällt, außer im Demo-Modus.

### F6 Startseite: Wochenübersicht
- Zeigt die laufende Woche Montag bis Sonntag mit allen fälligen Aufgaben.
- Überfällige Aufgaben stehen ganz oben und sind deutlich markiert. Am Handy steht die Kachel „Überfällig“ beim Öffnen **ohne Scrollen vollständig im Bild**, auch auf kleinen Geräten (geprüft bei 360 × 640 und 390 × 844 px); dafür steht sie dort über der Tageskachel.
- Der heutige Tag ist hervorgehoben.
- Vor- und zurückblättern zwischen Wochen.
- Filter: alle / nur meine Aufgaben.
- Ein Tipp oder Klick auf eine Aufgabe öffnet ihre Detailansicht. Dort sind Bearbeiten, Übernehmen und die Checkliste erreichbar.
- Die Detailansicht ist mit der Tastatur bedienbar. Escape schließt sie, und der Fokus kehrt danach auf die Aufgabe zurück.

### F7 Datensicherung
- Export aller Daten als Datei und Import aus dieser Datei.
- Dient in Etappe 1 als Backup.
- Etappe 2: Herunterladen geht auch ohne Internet. Einspielen ersetzt die Daten des Haushalts **für beide Personen** und geht nur mit Internet. Eine Sicherung aus Etappe 1 lässt sich so in den gemeinsamen Haushalt übernehmen.

### F8 Symbole pro Aufgabe (umgesetzt in Paket R2)
Nach `docs/design/DESIGN.md` Abschnitt 7.
- Jede Aufgabe kann ein Symbol haben: Auswahl aus einer festen Liste von etwa 20 Haushaltssymbolen, jeweils mit einem Farbton (Blau, Grün, Orange).
- Aufgaben ohne Auswahl zeigen ein Standardsymbol.
- Das Symbol wird beim Anlegen und Bearbeiten gewählt und erscheint überall, wo die Aufgabe steht (Wochenübersicht, Aufgaben, Erledigt).
- Das Symbol ergänzt den Titel, ersetzt ihn nie; die Auswahl ist per Tastatur und Screenreader bedienbar (N2).
- Bestehende Daten und Sicherungen bleiben lesbar (neue `schemaVersion` mit Übernahme der alten Daten).

## 5. Rahmenbedingungen

- **N1 Design:** Eigenes Design nach `docs/design/DESIGN.md`, keine Hoheitszeichen.
- **N2 Barrierefreiheit:** WCAG 2.1 AA bzw. BITV 2.0; vollständig per Tastatur bedienbar, mit Screenreader nutzbar.
- **N3 Geräte:** responsiv für PC und Handy; als PWA auf iPhone und Android installierbar. Ab Etappe 2 bleibt die App auch ohne Internet bedienbar; Änderungen werden nachgereicht, sobald das Gerät wieder online ist.
- **N4 Sprache:** Deutsch.
- **N5 Lizenz:** Open Source unter EUPL-1.2.
- **N6 Kosten:** kostenlos zu betreiben.
- **N7 Abhängigkeiten:** so wenige wie möglich; jede neue Bibliothek wird begründet.
- **N8 Farbschema:** Hell, Dunkel oder Automatisch nach `docs/design/DESIGN.md` Abschnitt 3.

### Sicherheit (Etappe 2)

Gilt ab Etappe 2 (gemeinsame Datenbank, Anmeldung). In Etappe 1 nur dokumentiert, nichts davon ist umgesetzt.

- **S1 Anmeldedienst:** Die Anmeldung läuft über einen etablierten Anmeldedienst, nicht über eine eigene Lösung. Der Dienst hat seinen Serverstandort in der EU (DSGVO).
- **S2 Einmalcode:** Der Hauptweg der Anmeldung ist ein Einmalcode per E-Mail (Code eingeben, kein Link). Es gibt kein Passwort und keinen TOTP-Code aus einer Authenticator-App. Ein Link würde auf dem iPhone in Safari statt in der installierten App öffnen.
- **S3 Passkey zusätzlich:** Ein Passkey ist ein zusätzlicher, bequemerer Weg, nie der einzige. Er hängt am Beta-Stand des Anmeldedienstes und wird nur umgesetzt, wenn ein kurzer Vorversuch (Spike in E2-2) das trägt; sonst wird er begründet aufgeschoben. Der Einmalcode funktioniert immer.
- **S4 Keine eigene Kryptografie:** Die App speichert keine Passwörter und implementiert keine eigene Kryptografie; beides übernehmen der Anmeldedienst und geprüfte Standardbibliotheken.
- **S5 Zugriffsregeln in der Datenbank:** Jeder Haushalt sieht nur seine eigenen Daten. Das wird durch Zugriffsregeln auf Datenbankebene erzwungen, nicht nur durch die App, sodass auch ein Fehler in der App keine fremden Daten preisgibt.
- **S6 Datensparsamkeit:** Gespeichert wird nur, was die App für ihre Funktionen braucht (Anmeldedaten beim Anmeldedienst, Namen, Aufgaben, Erledigungen). Keine Werbe- oder Analysedienste, keine Weitergabe an Dritte, keine Abrufe bei Drittanbietern (z. B. Schriften selbst ausliefern).

## 6. Qualität und Tests – ohne Claude prüfbar

Jeder neue Stand muss sich **ohne Claude und ohne Tokens** vollständig prüfen lassen. Ein einziger Befehl reicht dafür.

- **Q1 Ein Befehl für alles:** `npm run check` führt nacheinander Formatierung, Linting, Typprüfung, alle Tests und den Build aus und meldet am Ende klar „bestanden“ oder „nicht bestanden“.
- **Q2 Typsicherheit:** TypeScript im strengen Modus.
- **Q3 Code-Stil:** Linter und Formatierer, automatisch angewendet.
- **Q4 Unit-Tests:** Die Fachlogik (vor allem Terminberechnung F2 und Zuständigkeit F5) liegt in reinen Funktionen ohne Oberfläche und ist vollständig getestet. Jedes Akzeptanzkriterium aus Abschnitt 4 ist mindestens ein Test.
- **Q5 Testabdeckung:** Mindestens 90 % für die Fachlogik; `npm run check` schlägt fehl, wenn sie unterschritten wird.
- **Q6 End-to-End-Tests:** Die wichtigsten Abläufe werden im echten Browser durchgespielt – in Chromium und WebKit (entspricht Safari auf dem iPhone), jeweils in Desktop- und Handygröße.
- **Q7 Automatische Barrierefreiheitsprüfung:** Jede Seite wird in den End-to-End-Tests mit axe geprüft, im hellen und im dunklen Farbschema; Verstöße lassen den Test fehlschlagen.
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

Push-Benachrichtigungen, Punkte oder Belohnungen, weitere Haushaltsmitglieder.

Die Statistik gehört seit dem 20.10.2026 dazu (Paket E2-4b, nach `docs/design/DESIGN.md` Version 2): Sie zeigt gemeinsame Leistung und Teamwork, keine Rangliste und keine Gewinner-Wörter.

## 9. Entscheidungen (19.10.2026)

Präzisierungen zu Abschnitt 4 und 5. Bei Widerspruch gilt dieser Abschnitt. Technik und Arbeitspakete: siehe `PLAN.md`.

- **F1:** Beim Anlegen einer wiederkehrenden Aufgabe wählt man den ersten Fälligkeitstermin selbst; vorbelegt ist heute.
- **F2 Rückgängig:** möglich direkt nach dem Abhaken (Hinweis „Rückgängig“) und jederzeit über „Erledigt“ (seit Paket 11) – jeweils nur für das letzte Abhaken einer Aufgabe.
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
- **F6 Überfälliges (Paket 9, Darstellung Paket R1):** Überfällige Aufgaben stehen in der laufenden Woche in der orangen Kachel „Überfällig“ im ersten Bildschirm: am PC oben rechts neben der Tageskachel, am Handy ganz oben, **über** der Tageskachel (Paket 12; vorher darunter, dort lag sie bei vielen Aufgaben außerhalb des Bildes). Sichtbar ist die älteste mit „N Tage überfällig (seit Datum)“ und Zuständigkeit, dazu „Abhaken“ und (Paket 10) „Übernehmen“, wo es zutrifft; die übrigen öffnet „+ N weitere anzeigen“. Sie stehen nicht noch einmal an ihrem alten Tag. Blättert man in eine vergangene Woche, steht eine dort noch offene Aufgabe an ihrem Tag, als überfällig markiert; künftige Wochen zeigen nichts Überfälliges. Ohne überfällige Aufgaben entfällt die Kachel.
- **F6 Erledigtes (Paket 9):** Abgehakte Aufgaben verschwinden aus der laufenden und aus künftigen Wochen. Nur vergangene Wochen zeigen sie ausgegraut, an dem Tag, an dem sie fällig waren, mit „Erledigt von Name am Datum“.
- **F6 Bedienung (Paket 9, Darstellung Paket R1):** Die Wochenübersicht öffnet immer mit der laufenden Woche und dem Filter „Alle“; Woche, Tag und Filter werden nicht gespeichert. Die Überschrift nennt die Woche („Diese Woche“, „Nächste Woche“, „Letzte Woche“, „In 2 Wochen“ …), darüber stehen Kalenderwoche und Tage („KW 43 · 19.–25. Oktober“). Wochen blättert man mit „Vorherige Woche“, „Diese Woche“ und „Nächste Woche“. Die Tageskachel zeigt einen Tag mit seinen Aufgaben: in der laufenden Woche heute („Heute · Mi, 21.10.“), sonst den ersten Tag mit Aufgaben; „Woche im Überblick“ zeigt alle sieben Tage mit der Zahl ihrer Aufgaben, ein Tipp darauf zeigt diesen Tag. Am PC stehen dort zusätzlich alle Aufgaben jedes Tages. Bleibt die Seite über Mitternacht offen, rückt „heute“ von selbst weiter. „Nur meine“ zeigt auch Aufgaben, die man „nur dieses Mal“ übernommen hat, und Aufgaben für „beide“.
- **F6 Stand (Paket R1):** Die Kachel „Stand“ zeigt „erledigt / fällig“ der gezeigten Woche: fällig sind alle Durchgänge mit Termin in dieser Woche, die erledigten eingeschlossen; Überfälliges aus früheren Wochen zählt nicht mit. Der Stand folgt dem Filter „Alle / Nur meine“.
- **F4 Anzeige (Paket R1):** Eine Aufgabe mit Checkliste zeigt in der Woche „N von M abgehakt“ mit einem Balken.
- **F4 Bedienung (Paket 10):** Die Einträge einer Checkliste stehen als Kästchen in der Zeile der Aufgabe (Tageskachel): am PC immer sichtbar, am Handy hinter dem Knopf „Checkliste“ aufklappbar. Ein Häkchen wird sofort gespeichert; es gibt dafür keinen Hinweis, und der Fokus bleibt auf dem Kästchen. Dieselben Kästchen stehen in der Detailansicht. Hinzufügen und Löschen von Einträgen geschieht im Aufgabenformular (Feld „Checkliste“): Eintrag eintippen, „Hinzufügen“ oder Eingabetaste; ein Eintrag hat höchstens 80 Zeichen, eine Checkliste höchstens 50 Einträge. Was beim Speichern noch im Feld „Neuer Eintrag“ steht, wird als letzter Eintrag mitgespeichert. Erledigtes in vergangenen Wochen zeigt keine Kästchen.
- **F2 Abhaken (Paket 9):** Jede offene Aufgabe lässt sich mit „Abhaken“ erledigen, auch die der anderen Person und eine überfällige; gespeichert wird „erledigt von“ = „Ich bin“. Danach steht oben ein Hinweis (bei wiederkehrenden mit dem nächsten Termin) mit „Rückgängig“; er bleibt, bis man etwas anderes tut oder die Seite verlässt. Bestätigt in Paket R1: Anders als in DESIGN.md („kurz eine Meldung“) verschwindet der Hinweis nicht nach einer Zeit, damit niemand unter Zeitdruck gerät (WCAG 2.2.1), und er nimmt den Fokus, statt nur vorgelesen zu werden. Der Hinweis gilt nur für die zuletzt abgehakte Aufgabe; frühere Erledigungen macht man über „Erledigt“ rückgängig (Paket 11).
- **N8 Darstellung (Paket R1):** Unter „Einstellungen → Darstellung“ wählt man das Farbschema: „Hell“, „Dunkel“ oder „Automatisch (wie das Gerät)“; Standard ist „Automatisch“. Die Wahl wirkt sofort (ohne „Speichern“), gilt nur für dieses Gerät und steht wie „Ich bin“ nicht in der Sicherung. Kann sie nicht gespeichert werden, bleibt das bisherige Farbschema und eine Meldung erscheint.
- **N1 Design (Paket R1):** Wo der Entwurf und die Barrierefreiheit (N2) auseinandergehen, gilt N2: Der Rahmen des Abhak-Knopfs und der Eingabefelder ist dunkler als im ersten Entwurf (Kontrast 3:1), und Tagesknöpfe sind mindestens 44 px breit (auf sehr schmalen Handys lässt sich die Tagesleiste dafür seitlich schieben).
- **F8 Symbole (Paket R2):** 21 Symbole stehen zur Wahl: Standard (Haus), Besen, Sprühflasche, Badewanne, Dusche, Waschmaschine, Hemd, Bett, Kochtopf, Besteck, Kühlschrank, Mülleimer, Recycling, Pflanze, Pfote, Einkaufswagen, Paket, Geschenk, Telefon, Auto, Werkzeug; jedes hat einen festen Farbton (Blau, Grün oder Orange), den man nicht selbst wählt. Das Feld „Symbol“ steht im Aufgabenformular direkt nach dem Titel, vorbelegt mit „Standard (Haus)“; unter den Kacheln steht der Name des gewählten Symbols („Gewählt: …“). Das Symbol erscheint in der Tageskachel, in der Kachel „Überfällig“ (rechts neben dem Titel, statt des früheren Warndreiecks), in den Tagesspalten am PC, in der Aufgabenliste und in „Erledigt“. Für Screenreader ist es Schmuck: Vorgelesen wird der Titel; bei der Auswahl wird der Name des Symbols vorgelesen.
- **F8 Alte Daten (Paket R2):** Daten und Sicherungen von vor Paket R2 (`schemaVersion` 1) werden beim Laden und beim Import übernommen; jede Aufgabe bekommt dabei das Standardsymbol, sonst ändert sich nichts. Gespeichert und exportiert wird ab jetzt `schemaVersion` 2; eine ältere App-Version lehnt solche Dateien als „neuere Version“ ab.
- **F6 Detailansicht (Paket 10):** Jede Aufgabe der Wochenübersicht ist ein Knopf (Symbol und Text der Zeile, auch die Aufgaben in den Tagesspalten am PC und auf der Kachel „Überfällig“); ein Tipp oder Klick öffnet die Detailansicht als Fenster über der Seite. Sie nennt Zuständigkeit (mit einer Übernahme „nur dieses Mal“), Rhythmus bzw. „Einmalige Aufgabe“, Termin (bei Überfälligem mit den Tagen Verzug) und Notiz, zeigt die Checkliste zum Abhaken und bietet „Bearbeiten“ (führt zum Formular der Aufgabe), „Übernehmen“ und „Schließen“. Der Fokus beginnt beim Titel und bleibt im Fenster. Escape und „Schließen“ schließen es, ohne etwas zu ändern; der Fokus kehrt auf die Aufgabe zurück. Eine erledigte Aufgabe in einer vergangenen Woche zeigt „Erledigt von … am …“ und nur „Bearbeiten“ und „Schließen“. Abhaken geht weiter nur über den Knopf in der Zeile. Kann etwas in der Detailansicht nicht gespeichert werden, steht die Meldung „Nicht gespeichert“ im Fenster.
- **F5 Übernehmen (Paket 10):** „Übernehmen“ steht als Knopf in der Zeile der Tageskachel, auf der Kachel „Überfällig“ und in der Detailansicht, und zwar bei jeder offenen Aufgabe, die gerade nicht allein der Person dieses Geräts gehört (Aufgaben der anderen Person und Aufgaben für „beide“). Eine einmalige Aufgabe wird sofort umgewiesen („… ist jetzt bei Alex.“). Bei einer wiederkehrenden fragt ein Fenster „Wie lange?“: „Nur dieses Mal (danach ist wieder … zuständig)“, vorgewählt, oder „Dauerhaft (ab jetzt ist … zuständig)“; der Fokus beginnt bei der Auswahl. Danach steht oben ein Hinweis, der den Fokus bekommt. Eine Übernahme lässt sich nicht über „Rückgängig“ zurücknehmen; man nimmt die Aufgabe wieder zurück, indem man sie in „Bearbeiten“ neu zuweist oder die andere Person „Übernehmen“ wählt.
- **F8 Anordnung (Paket 10):** Die Symbolkacheln im Formular stehen so, dass nie eine einzelne Kachel allein in der letzten Reihe steht: je nach Breite 7 × 3, 6 × 3 + 3 oder (auf sehr schmalen Bildschirmen) 3 × 7. Jede Kachel ist mindestens 44 × 44 px groß.
- **F3 Erledigt (Paket 11):** Die Seite „Erledigt“ ist eine Liste aller Erledigungen, die neueste zuerst; bei gleichem Tag steht oben, was später abgehakt wurde. Jede Zeile zeigt Symbol, Titel und „Erledigt von Name am Datum“. Eine wiederkehrende Aufgabe steht mit jedem erledigten Durchgang da. Es gibt keine Begrenzung und keinen Filter; die ganze Liste steht auf einer Seite. Ohne Erledigtes steht dort „Noch nichts erledigt. Abgehakte Aufgaben stehen hier.“
- **F2 Rückgängig in „Erledigt“ (Paket 11):** Bei jeder Aufgabe hat nur ihr letzter Durchgang den Knopf „Rückgängig“; ein Satz über der Liste sagt das. Danach ist die Aufgabe wieder offen: wiederkehrend mit dem vorherigen Termin und den vorherigen Checklisten-Häkchen, einmalig wieder bei „Aufgaben“. Der Eintrag verschwindet aus der Liste; oben erscheint die Meldung „Rückgängig gemacht: „…“ ist wieder offen, fällig am …“ (bekommt den Fokus, bleibt bis zur nächsten Handlung). Danach bekommt der Durchgang davor den Knopf. Kann nicht gespeichert werden, bleibt alles wie es war und eine Meldung „Nicht gespeichert“ erscheint.
- **F7 Bedienung (Paket 11):** Unter „Einstellungen“ gibt es die Kachel „Sicherung“. *Herunterladen:* „Sicherung herunterladen“ speichert alle Daten als `putzplan-JJJJ-MM-TT.json`; die Kachel nennt vorher, wie viele Aufgaben und Erledigungen darin stehen, und danach den Dateinamen. *Einspielen:* „Sicherung einspielen …“ öffnet die Dateiwahl. Die App prüft die Datei erst und ändert dabei nichts; dann fragt sie („Sicherung einspielen?“) mit Dateiname, Inhalt der Datei und dem jetzigen Stand und nennt, dass alle jetzigen Daten ersetzt werden und das nicht rückgängig geht. Erst nach „Ja, Daten ersetzen“ lädt die App die bisherigen Daten als `putzplan-vor-import-JJJJ-MM-TT.json` herunter und ersetzt sie dann; eine Meldung nennt das Ergebnis. „Abbrechen“ und Escape ändern nichts. Die Namen kommen aus der Sicherung; „Ich bin“ und die Darstellung bleiben, wie sie auf dem Gerät sind. Wer das Einspielen bereut, spielt die automatisch heruntergeladene Datei ein.
- **F7 Fehlerhafte Dateien (Paket 11):** Eine Datei, die kein gültiges JSON ist, Fehler im Aufbau hat (mit Fundstelle, z. B. „tasks[0].assignee: ungültig …“), aus einer neueren App-Version stammt oder größer als 5 MB ist, wird mit einer Meldung abgelehnt, die auch sagt, dass die Daten auf dem Gerät unverändert sind; es gibt dann keine Rückfrage. Ältere Sicherungen (`schemaVersion` 1) lassen sich einspielen. Kann nach der Bestätigung nicht gespeichert werden, bleiben die Daten unverändert (die automatische Kopie ist dann schon heruntergeladen).
- **F6 Aufbau der Wochenübersicht (Paket 12):** Handy und schmale Fenster (unter 1000 px Breite): eine Spalte in der Reihenfolge „Überfällig“ (nur wenn es Überfälliges gibt), Tageskachel, „Stand“, „Woche im Überblick“. Ab 1000 px Breite: links die Tageskachel, rechts „Überfällig“ und darunter „Stand“, darunter die Woche. Die Kachel „Stand“ steht am Handy nicht mehr neben „Überfällig“, sondern unter der Tageskachel. Auch für Tastatur und Screenreader kommt „Überfällig“ zuerst.
- **N3 App auf dem Home-Bildschirm (Paket 12):** Die App lässt sich auf iPhone (Safari: Teilen → Zum Home-Bildschirm) und Android (Chrome: App installieren; Firefox: Zum Startbildschirm hinzufügen, auf Xiaomi-Handys erst nach der Erlaubnis „Startbildschirm-Verknüpfungen“) auf den Home-Bildschirm legen; sie heißt „Krümel“, hat als Symbol den goldbraunen Keks-Krümel mit Gesicht und Besen auf einer violetten Kachel (seit E2-4a) und öffnet ohne Adressleiste. Die Leiste oben (Uhrzeit, Akku) hat die Farbe des Seitenhintergrunds und folgt dem Farbschema der App, auch wenn man in den Einstellungen „Hell“ oder „Dunkel“ gegen das Gerät wählt. Auf Geräten mit Kamera-Aussparung (auch quer gehalten) und Home-Balken bleibt nichts verdeckt.
- **N3 Ohne Internet (Paket 12):** Nach dem ersten Öffnen mit Internet läuft die App ohne Internet vollständig (Aufgaben ansehen, abhaken, rückgängig machen, anlegen, Sicherung herunterladen und einspielen), weil sie ihre Programmdateien und die Schrift auf dem Gerät behält. Die Daten waren schon immer nur auf dem Gerät. Neue Versionen der App kommen beim Öffnen mit Internet (genauer: siehe „N3 Version und Updates“, Paket 13). Der Demo-Modus (`npm run demo`) arbeitet ohne diese Funktion.
- **N3 Grenzen (Paket 12):** *iPhone:* Die installierte App hat **eigene Daten**, getrennt von Safari; Daten aus Safari kommen über „Sicherung“ in die App. Wie ein Download aus der installierten App ankommt, hängt von iOS ab; die automatische Kopie beim Einspielen kann dort unterdrückt werden, deshalb vorher selbst „Sicherung herunterladen“ drücken. Beim Start der App im Dark Mode kann kurz Weiß erscheinen; *Android:* Der Startbildschirm der installierten App ist hell, auch im Dark Mode. Ein Praxistest auf echten Geräten steht in `docs/GERAETETEST.md`.
- **N3 Installationshilfe (Paket 13):** Unter der Wochenübersicht steht, solange die App nicht installiert ist, ein unaufdringlicher Hinweis „Putzplan als App“: in Browsern, die selbst installieren können (Chrome, Edge), mit dem Knopf „App installieren“, auf iPhone/iPad und in Firefox auf Android mit „Anleitung zeigen“ (Fenster mit nummerierten, bebilderten Schritten; iPhone: Teilen → Zum Home-Bildschirm → Hinzufügen, dazu der Hinweis auf die getrennten Daten von Safari; Firefox: Menü ⋮ → Zum Startbildschirm hinzufügen, dazu die Erlaubnis „Startbildschirm-Verknüpfungen“ auf Xiaomi-, Redmi- und POCO-Handys). In anderen Browsern (z. B. Firefox am PC) gibt es keinen Hinweis. Das × schließt ihn für dieses Gerät dauerhaft; dieselbe Anleitung steht immer unter „Einstellungen → Als App installieren“. Der Hinweis nimmt nie den Fokus und schiebt nichts nach unten.
- **N3 Auf anderem Gerät öffnen (Paket 13):** „Einstellungen → Auf anderem Gerät öffnen → QR-Code zeigen“ zeigt einen QR-Code mit der Adresse der App (und die Adresse als Text), dunkel auf hell auch im Dark Mode. Der Code enthält nur die Adresse; Daten kommen nicht mit, dafür gibt es „Sicherung“. „QR-Code ausblenden“ schließt ihn.
- **N3 Version und Updates (Paket 13):** „Einstellungen → Version“ nennt den Stand der App („Stand: Datum, Uhrzeit (Kennung)“) und hat den Knopf „Neu laden“. Neue Versionen kommen von selbst, wenn die App mit Internet neu gestartet wird; eine App, die nur im Hintergrund lag, bleibt bei der alten Version. Update erzwingen: „Neu laden“, notfalls die App ganz schließen und neu öffnen; direkt nach einer Veröffentlichung kann es bis zu 10 Minuten dauern.
- **N2 Windows-Kontrastmodus (Paket 13):** Im Kontrastmodus haben Knöpfe, Kacheln und Fenster sichtbare Rahmen; gewählter Filter und gewählter Tag sind hervorgehoben, „heute“ hat einen doppelten Rahmen, die aktuelle Seite der Navigation ist unterstrichen.
- **Abschluss Etappe 1 (20.10.2026):** Der Gerätetest (`docs/GERAETETEST.md`) auf Android (Redmi, Firefox) und iPhone (Safari, installierte App) ist bestanden; einziger Fund war die Xiaomi-Berechtigung (jetzt in App und Anleitung). Die Prüfung mit Screenreader (NVDA, VoiceOver, TalkBack) wurde **bewusst nicht von Hand** durchgeführt; die Barrierefreiheit (N2) ist über die automatischen Prüfungen abgesichert (axe auf jeder Seite und jedem Fenster in hell und dunkel, Tastatur, Fokus, Kontrastmodus). Was Etappe 2 vorab braucht, steht in `docs/ETAPPE2.md`.
- **F7 Import:** ersetzt alle Daten nach Rückfrage; vorher wird automatisch eine Sicherung heruntergeladen.
- **F7 Format:** Die Sicherung ist eine JSON-Datei `putzplan-JJJJ-MM-TT.json` mit `schemaVersion`, Einstellungen (Namen), Aufgaben und Erledigungen. „Ich bin“ gehört zum Gerät und steht nicht darin. Eine Datei aus einer neueren App-Version oder mit Fehlern wird mit Fundstelle abgelehnt; die vorhandenen Daten bleiben dann unberührt.
- **Speicher:** Sind die gespeicherten Daten unlesbar, meldet die App das und überschreibt sie nicht durch leere Daten. Ist der Browser-Speicher voll oder gesperrt, meldet Speichern einen Fehler.
- **F5 Namen (Paket 7):** Beide Namen sind Pflicht, höchstens 30 Zeichen, und müssen sich unterscheiden. Die Ersteinrichtung fragt Namen und „Ich bin“ zugleich; Namen und „Ich bin“ lassen sich unter „Einstellungen“ ändern. Kennt ein Gerät die Namen, aber nicht „Ich bin“, fragt die App danach.
- **Speicher unlesbar (Paket 7):** Die App zeigt statt der Seiten eine Meldung mit Fundstellen und bietet zwei Wege an: Rohdaten als Datei herunterladen, danach (mit Rückfrage) neu beginnen. Ohne Herunterladen gibt es kein „Neu beginnen“.
- **Betrieb Etappe 1:** Die App liegt kostenlos auf GitHub Pages; die Daten bleiben trotzdem nur im jeweiligen Browser.
- **Repository:** öffentlich auf GitHub.
- **Code:** englische Namen im Code, Oberfläche deutsch; Wortliste in `CLAUDE.md`. Oberfläche mit Preact.
- **Design (19.10.2026):** KERN UX ist durch das eigene Design aus `docs/design/DESIGN.md` ersetzt (Paket R1). Die Schrift Archivo liefert die App selbst aus; es gibt keinen Abruf bei Google Fonts oder anderen Drittanbietern.

### Etappe 2 (Entscheidungen des PO, 20.10.2026)

Geplantes Verhalten; es gilt ab dem jeweils genannten Paket (`ETAPPE2-PLAN.md`, Abschnitt 3). Bis dahin bleibt die App wie in Etappe 1.

- **Betrieb Etappe 2:** Ein Haushalt hat genau zwei Mitglieder (Person A, Person B) und liegt bei Supabase in Paris (Region eu-west-3, kostenloser Tarif; Entscheidung des PO vom 20.10.2026, ursprünglich Frankfurt). Die Anmeldung läuft per E-Mail-Einmalcode (S2), die Daten liegen auf jedem Gerät als Kopie, Änderungen werden abgeglichen (N3).
- **Online-Version:** Die Online-Version bleibt bis zum Ende von E2-3 bei Etappe 1; erst dann wird sie auf die gemeinsame Version umgestellt.
- **Haushalt startet leer:** Ein neuer Haushalt hat keine Aufgaben. Es gibt keine automatische Übernahme der Daten aus Etappe 1. Wer sie behalten will, lädt vorher „Sicherung herunterladen“ und spielt die Datei nach der Anmeldung ein (F7); die README beschreibt das mit einem Satz (E2-5).
- **Haushalt anlegen und einladen (E2-2):** Wer ohne Haushalt angemeldet ist, legt einen an (eigener Name und Name der zweiten Person, die Ersteller-Person ist Person A) oder öffnet einen Einladungslink. Ein Einladungslink gilt 7 Tage und nur einmal; ein neuer Link macht den alten ungültig. Das Annehmen scheitert mit eigener Meldung bei abgelaufenem oder benutztem Link, vollem Haushalt und wenn die Person schon einen Haushalt hat.
- **Gleichzeitige Änderungen:** Bei Bearbeitungen gewinnt pro Feld die Änderung, die **zuletzt beim Server ankommt** (nicht die der Geräteuhr); verschiedene Felder derselben Aufgabe bleiben beide erhalten. Die Checkliste zählt als ein Feld: Haken zwei Geräte gleichzeitig verschiedene Einträge ab, kann ein Häkchen verloren gehen.
- **Gleichzeitiges Abhaken:** Haken beide denselben Durchgang einer Aufgabe ab, zählt er einmal. Das zweite Gerät zeigt den Serverstand und den Hinweis „Hatte {Name} schon abgehakt.“
- **Löschen gegen Bearbeiten:** Löschen gewinnt. Eine gelöschte Aufgabe wird durch eine gleichzeitige Bearbeitung nicht wiederbelebt.
- **Rückgängig bei mehreren Geräten:** Es geht nur, solange die Erledigung auf dem Server noch die letzte der Aufgabe ist; sonst gilt der Serverstand und ein Hinweis erscheint.
- **Ohne Internet (N3):** Die App bleibt voll bedienbar. Ein Hinweis nennt den Stand („Alles übertragen“, „Offline – N Änderungen warten“, „Server nicht erreichbar“); beim Abmelden warnt die App, wenn noch Änderungen warten. Einspielen einer Sicherung geht nur mit Internet.
- **Neue Version nötig:** Hat ein anderes Gerät die Daten schon in einem neueren Format gespeichert, schreibt die App nichts mehr und zeigt „Neue Version verfügbar – Neu laden“.
- **Pausierung (Supabase, kostenloser Tarif):** Das Projekt pausiert nach 7 Tagen ohne Nutzung; nach rund 90 Tagen Pause lässt es sich nicht mehr per Klick wiederherstellen. Die App läuft dann offline weiter und reicht Änderungen nach, sobald der PO das Projekt im Dashboard wiederhergestellt hat. Damit das nie passiert, ruft ein täglicher Workflow auf GitHub das Projekt ab (nur mit dem öffentlichen Schlüssel, ohne Geheimnisse; E2-1).
- **Keine Sicherungen im kostenlosen Tarif:** Der Tarif bietet keine herunterladbaren Backups. Deshalb regelmäßig „Sicherung herunterladen“ (README).
- **E-Mail-Versand:** Die Einmalcodes kommen von einem eigenen Gmail-Konto nur für Krümel (SMTP mit App-Passwort), nicht von einem privaten Postfach. Ein Dienst wie Brevo kommt nicht in Frage, weil er eine eigene Domain verlangt.
- **Neuanmeldungen:** ~~Sobald beide Konten bestehen, schaltet der PO Neuanmeldungen im Dashboard ab (E2-5).~~ Ersetzt durch „Neue Konten nur mit Einladung“ (E2-5b, unten).
- **Neue Konten nur mit Einladung (E2-5b, Entscheidungen des PO vom 23.10.2026, jeweils Empfehlung):** Bestehende Konten melden sich wie bisher an, und der PO kann weiter Konten von Hand anlegen (Dashboard, „Add user“). Eine unbekannte Adresse bekommt nur mit einem gültigen Einladungslink einen Code und ein Konto; ohne Link steht am Feld „Krümel ist gerade nur mit Einladung nutzbar. Frag jemanden, der Krümel schon nutzt, nach einem Einladungslink. Hast du schon ein Konto? Dann prüf deine Adresse.“, mit abgelaufenem, benutztem oder zurückgezogenem Link eine eigene Meldung; in beiden Fällen geht keine Mail hinaus. Zwei Arten von Links: der **Haushalts-Link** (wie bisher, Beitritt zum eigenen Haushalt; er erlaubt genau ein neues Konto) und neu der **Freundes-Link**: Damit legt jemand ein eigenes Konto und einen eigenen Haushalt an. Beide gelten 7 Tage und nur einmal. „Freunde einladen“ ist eine eigene Kachel in den Einstellungen direkt unter „Haushalt“ (nur für Mitglieder eines Haushalts): Link erzeugen, kopieren, über das Teilen-Menü des Handys schicken, als QR-Code zeigen; darunter die offenen Links mit „Zeigen“ und „Zurückziehen“. Grenze je Person: höchstens 5 offene Freundes-Links und höchstens 10 neue in 24 Stunden (zurückgezogene zählen mit). Öffnet jemand einen Link, sagt die Anmeldeseite, wozu er eingeladen ist; nach der Anmeldung folgt „Haushalt anlegen“ bzw. „Einladung annehmen“. Bekannte Schwäche: Wer es darauf anlegt, kann an den Meldungen erkennen, ob eine Adresse schon ein Konto hat.
- **Person entfernen, Haushalt verlassen, Konto löschen (E2-5a, Entscheidungen des PO vom 23.10.2026; ersetzt „nur von Hand im Dashboard“):** Alles geht nur mit Internet (sonst Meldung, nichts ändert sich) und jeweils nach einer Rückfrage; schlägt der Schritt fehl, bleibt alles, wie es war. Beide Mitglieder sind gleichberechtigt.
  - **Entfernen:** Jedes Mitglied kann die andere Person entfernen (Kachel „Haushalt“). Ihr Platz ist danach „noch nicht dabei“ und lässt sich neu einladen. Die entfernte Person sieht beim nächsten Abgleich „Haushalt anlegen“ mit dem Hinweis „Du gehörst nicht mehr zu diesem Haushalt …“; ihre Kopie auf dem Gerät wird gelöscht, noch nicht Übertragenes lädt die App vorher als Datei herunter. Ihr Konto bleibt; sie kann einen eigenen Haushalt anlegen oder einer neuen Einladung folgen.
  - **Was mit den Daten der gehenden Person passiert (Entfernen, Verlassen, Konto löschen):** Alles bleibt im Haushalt: Aufgaben, Erledigungen (auch ihre) und ihr Name als Name des Platzes. Wer als Nächstes eingeladen wird, übernimmt den freien Platz samt Namen, Zuständigkeiten und alten Erledigungen (die Statistik bleibt vollständig) und ändert dann den eigenen Namen in der Kachel „Haushalt“.
  - **Verlassen:** Ein Mitglied verlässt den Haushalt selbst; danach zeigt die App „Haushalt anlegen“. Ist es die letzte Person, wird der Haushalt mit allen Aufgaben, Erledigungen und Einladungen gelöscht; die Rückfrage sagt das deutlich.
  - **Konto löschen** (Kachel „Anmeldung“): endgültig, erst nach Eintippen des Wortes „löschen“ (Groß und klein egal). Gelöscht werden das Konto mit der E-Mail-Adresse, die Mitgliedschaft und die Daten von Krümel auf diesem Gerät (Kopie, gemerkter Haushalt, Sitzung); der Haushalt bleibt für die andere Person, als letzte Person wird er mitgelöscht. Rückgängig geht nicht. Ein neues Konto gibt es danach nur mit einer neuen Einladung (seit E2-5b); die Rückfrage sagt das.
  - **Sicherung:** Jede Rückfrage zum Verlassen und Konto löschen bietet „Sicherung herunterladen“ an. Von selbst lädt die App eine Sicherung (`kruemel-vor-austritt-JJJJ-MM-TT.json`) nur, wenn der Haushalt mitgelöscht wird oder noch Änderungen warten (wie beim Abmelden); vorher versucht sie, Wartendes zu übertragen.
  - **Technik:** Datenbankfunktionen `remove_member`, `leave_household`, `delete_account` (eine Transaktion, nur das eigene Konto und der eigene Haushalt, ohne geheimen Schlüssel); Daten aus Etappe 1 (`putzplan:data`) bleiben auf dem Gerät unberührt.
- **Datenschutzhinweis:** Die Einstellungen bekommen einen kurzen Datenschutzhinweis (was gespeichert wird, bei wem: Supabase für Anmeldung und Daten, Google für den Versand der Codes; E2-5). Dazu kommt ein einfaches Impressum (To-do in E2-5, Entscheidung des PO vom 20.10.2026; Wortlaut und Ort, z. B. eine Seite unter den Einstellungen, legt E2-5 fest).
- **Prüfung ohne Screenreader von Hand:** Wie in Etappe 1 wird die Anmeldung nicht von Hand mit einem Screenreader geprüft; die automatischen Prüfungen (axe, Tastatur, Fokus, Kontrastmodus) sichern N2.
- **Prüfung der Datenbank (Q1):** `npm run check` läuft weiter ohne Docker, Internet und Zugangsdaten. Die Prüfung gegen eine lokale Supabase-Instanz (`npm run check:db`) läuft nur auf GitHub, nicht auf dem Rechner des PO.
- **Datenmodell Version 3 (E2-0, umgesetzt):** Gespeichert und exportiert wird ab jetzt `schemaVersion` 3. Jede neue Erledigung merkt sich zusätzlich den Zeitpunkt des Abhakens (`completedAt`, für die Uhrzeit in „Heute“) und wer laut fester Zuständigkeit dran war (`assigneeAtCompletion`, für „N-mal füreinander übernommen“; eine einmalige Übernahme ändert das nicht). Ältere Erledigungen haben beides nicht und werden nicht dazugerechnet bzw. ohne Uhrzeit gezeigt. Sicherungen der Versionen 1 und 2 lassen sich weiter einspielen; eine ältere App-Version lehnt Dateien der Version 3 als „neuere Version“ ab. Sonst ändert sich für Nutzer in E2-0 nichts.
- **App-Name „Krümel“ (20.10.2026):** Der Anzeigename ist „Krümel“, in Code und Dateinamen `kruemel`. Das GitHub-Repository wird in `kruemel` umbenannt, die Adresse wird damit https://stephan-pro.github.io/kruemel/. Das geschieht als erster Schritt von E2-3, vor dem Umstellen der Online-Version auf Supabase (Liste und Schritte des PO: `ETAPPE2-PLAN.md`, Paket E2-3). Die sichtbaren Texte (Seitentitel, Installationshinweis „Krümel als App“, Name im Manifest und auf dem Home-Bildschirm) und die Dateinamen der Sicherung (`kruemel-JJJJ-MM-TT.json`, `kruemel-vor-import-…`) ändern sich in E2-4. Sicherungen mit dem alten Dateinamen bleiben einspielbar (der Name zählt nicht, der Inhalt).
- **App-Symbol (20.10.2026):** Vorlage ist `docs/design/kruemel-icon.svg`: ein goldbrauner, runder Keks-Krümel mit Gesicht und Besen auf einer violetten Kachel. Daraus sind in E2-4a alle Symbolgrößen entstanden (192, 512, maskierbar 512, Apple-Home-Bildschirm 180; `npm run icons` prüft die sichere Zone pixelweise, `src/ui/icons.test.ts` die Größen und dass das Motiv der Vorlage unverändert ist); Gesicht und Besen liegen in der sicheren Zone maskierbarer Symbole, das Motiv ist dafür auf 78 % verkleinert in die Kachel gesetzt. Der Krümel bleibt in allen Varianten goldbraun und rund, nie blau oder zottelig (Abstand zu geschützten Figuren). Der Satz „blaue Kachel mit weißem Haus“ (N3) ist ersetzt. Optional darf der Krümel in der App auftauchen (z. B. bei „Alles erledigt“ oder auf leeren Seiten), als Bild mit Alternativtext oder als Schmuck mit `aria-hidden`. Umgesetzt ist das in E2-4 noch nicht: Der Krümel taucht in der App selbst nicht auf (nur als App-Symbol).
- **Startseite „Heute“ und Navigation (E2-4a, 20.10.2026):** Die App startet auf „Heute“: Begrüßung nach Tageszeit mit dem Namen („Guten Morgen“ von 5 bis 10 Uhr, „Hallo“ von 11 bis 17 und nachts, „Guten Abend“ ab 18 Uhr), ein Satz zu dem, was heute für die Person ansteht („Heute stehen 3 Aufgaben für dich an. Eine davon ist überfällig.“), „Deine Woche“ mit sieben Tagesfeldern (erledigter Tag mit Haken, heute mit „erledigt/gesamt“, kommende Tage mit der Zahl offener Aufgaben, freie Tage mit „–“), zwei Kacheln („Deine Woche“ und „Gemeinsam“ mit Ring und Prozent) und „Heute für dich“ mit dem Filter „Meine / Alle“. Überfälliges steht zuerst und ist am Handy (360 × 640) ohne Scrollen sichtbar; Erledigtes steht unten mit Uhrzeit (bei Erledigungen aus Etappe 1 ohne Uhrzeit). Ein Tipp auf ein Tagesfeld zeigt die Aufgaben dieses Tages, die Wochenwahl „‹ KW 43 ›“ blättert Tagesfelder und Kacheln. Die Navigation ist Heute · Woche · Plus (neue Aufgabe) · Statistik · Einstellungen; am Handy schwebt sie und nur die aktuelle Seite zeigt ihren Namen. „Aufgaben“ und „Erledigt“ sind aus „Woche“ (Links unter dem Board) und aus den Einstellungen erreichbar. Die Wochenübersicht (F6) bleibt als Seite „Woche“ unverändert in ihren Regeln. Die Zahlen zählen nicht sanft hoch (bewusst weggelassen); Ring und Balken bewegen sich unter 200 ms und stehen bei „weniger Bewegung“ still.
- **Statistik (E2-4b, 20.10.2026), Seite „Eure Bilanz“:** Zeitraum Woche, Monat oder Jahr (der von heute). „Gemeinsam erledigt“ zählt, was in dem Zeitraum abgehakt wurde (am Tag des Abhakens), von beiden zusammen; dazu der Unterschied zum Vorzeitraum ohne Urteil („6 mehr als in der Vorwoche“). Die Serie („4 Wochen in Folge“) zählt Wochen, in denen alles Fällige erledigt wurde (wie „Stand“ der Wochenübersicht); eine Woche ohne Fälliges zählt nicht und bricht nicht, die laufende Woche bricht die Serie nicht, bevor sie vorbei ist. Das Balkendiagramm zeigt Tage (Woche, Monat) oder Monate (Jahr) und hat eine vollständige Textbeschreibung. „Euer Teamwork“ zeigt den Anteil beider mit Namen und Zahl und „N-mal habt ihr füreinander übernommen“ (jemand hat abgehakt, was laut fester Zuständigkeit die andere Person hatte; „beide“ und Erledigungen aus Etappe 1 ohne Angabe zählen nicht). „Am häufigsten erledigt“ zeigt die drei Aufgaben mit den meisten Erledigungen im Zeitraum, gezählt pro Aufgabe (nicht pro Titel). Keine Rangliste, keine Gewinner-Wörter.
- **Namen ändern im Haushalt (E2-3g, 23.10.2026):** In der Kachel „Haushalt“ (Einstellungen) ändert jede Person ihren eigenen Namen (Pflicht, höchstens 30 Zeichen, anders als der Name der anderen Person) und den Namen des Haushalts (freiwillig, höchstens 30 Zeichen, leer entfernt ihn). Den Namen der anderen Person ändert nur sie selbst. Der eigene Name geht mit den gemeinsamen Daten, also auch offline (wird nachgereicht), und die andere Person sieht ihn ohne Neuladen. Der Name des Haushalts ändert sich nur mit Internet (sonst Meldung „Name des Haushalts nicht gespeichert“, der eigene Name ist trotzdem gespeichert); die andere Person sieht ihn beim nächsten Öffnen der Einstellungen. Er steht im Text der geteilten Einladung („Komm in unseren Haushalt „…“ bei Krümel“).
