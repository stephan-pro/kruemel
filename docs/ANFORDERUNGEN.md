# Putzplan – Anforderungen

Stand: 20.10.2026 · Product Owner: Stephan Prommer

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
- Überfällige Aufgaben stehen ganz oben und sind deutlich markiert. Am Handy steht die Kachel „Überfällig“ beim Öffnen **ohne Scrollen vollständig im Bild**, auch auf kleinen Geräten (geprüft bei 360 × 640 und 390 × 844 px); dafür steht sie dort über der Tageskachel.
- Der heutige Tag ist hervorgehoben.
- Vor- und zurückblättern zwischen Wochen.
- Filter: alle / nur meine Aufgaben.
- Ein Tipp oder Klick auf eine Aufgabe öffnet ihre Detailansicht. Dort sind Bearbeiten, Übernehmen und die Checkliste erreichbar.
- Die Detailansicht ist mit der Tastatur bedienbar. Escape schließt sie, und der Fokus kehrt danach auf die Aufgabe zurück.

### F7 Datensicherung
- Export aller Daten als Datei und Import aus dieser Datei.
- Dient in Etappe 1 als Backup und später zur Übernahme in die Datenbank.

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
- **N3 Geräte:** responsiv für PC und Handy; als PWA auf iPhone und Android installierbar.
- **N4 Sprache:** Deutsch.
- **N5 Lizenz:** Open Source unter EUPL-1.2.
- **N6 Kosten:** kostenlos zu betreiben.
- **N7 Abhängigkeiten:** so wenige wie möglich; jede neue Bibliothek wird begründet.
- **N8 Farbschema:** Hell, Dunkel oder Automatisch nach `docs/design/DESIGN.md` Abschnitt 3.

### Sicherheit (Etappe 2)

Gilt ab Etappe 2 (gemeinsame Datenbank, Anmeldung). In Etappe 1 nur dokumentiert, nichts davon ist umgesetzt.

- **S1 Anmeldedienst:** Die Anmeldung läuft über einen etablierten Anmeldedienst, nicht über eine eigene Lösung. Der Dienst hat seinen Serverstandort in der EU (DSGVO).
- **S2 Passkeys:** Passkeys sind der Hauptweg der Anmeldung.
- **S3 Rückfallebene:** Ein Code aus einer Authenticator-App (TOTP) ist die Rückfallebene, z. B. auf einem Gerät ohne Passkey.
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

Push-Benachrichtigungen, Statistiken, Punkte oder Belohnungen, weitere Haushaltsmitglieder.

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
- **N3 App auf dem Home-Bildschirm (Paket 12):** Die App lässt sich auf iPhone (Safari: Teilen → Zum Home-Bildschirm) und Android (Chrome: App installieren; Firefox: Zum Startbildschirm hinzufügen, auf Xiaomi-Handys erst nach der Erlaubnis „Startbildschirm-Verknüpfungen“) auf den Home-Bildschirm legen; sie heißt „Putzplan“, hat als Symbol eine blaue Kachel mit weißem Haus und öffnet ohne Adressleiste. Die Leiste oben (Uhrzeit, Akku) hat die Farbe des Seitenhintergrunds und folgt dem Farbschema der App, auch wenn man in den Einstellungen „Hell“ oder „Dunkel“ gegen das Gerät wählt. Auf Geräten mit Kamera-Aussparung (auch quer gehalten) und Home-Balken bleibt nichts verdeckt.
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
