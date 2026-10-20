# Krümel – Gerätetest zum Durchklicken

Für ein echtes **iPhone** und ein echtes **Android-Handy**. Dauer: etwa 30 Minuten je Gerät. Du brauchst nichts zu installieren außer der App selbst. Haken setzen, wenn es klappt; wenn nicht, den Schritt und kurz „was passiert ist“ notieren (am besten mit Bildschirmfoto).

Die App: **https://stephan-pro.github.io/kruemel/**

> **Wichtig vorab (iPhone):** Safari und die App auf dem Home-Bildschirm haben **getrennte Daten**. Alles, was du vorher in Safari eingetragen hast, ist in der installierten App nicht da. Richte die App deshalb erst **nach** der Installation ein, oder nimm die Daten über „Sicherung“ mit (Teil 4).
> Auch sonst gilt: Die Daten liegen nur auf dem jeweiligen Gerät. PC und Handy teilen sich nichts.

Gerät: ______________ (z. B. iPhone 14, iOS 17.5) · Datum: ____________ · Getestet von: ____________

## 1. Installation auf dem Home-Bildschirm

Die App hilft selbst dabei (seit Paket 13): unten auf der Seite „Woche“ steht der Hinweis **„Krümel als App“**, und unter **Einstellungen → Als App installieren** steht dieselbe Anleitung für den jeweiligen Browser (in Chrome und Edge ein Knopf **App installieren**). Den Hinweis in der Woche schließt das **×**; er kommt auf diesem Gerät nicht wieder.

**iPhone (Safari):** Adresse öffnen → unten auf **Teilen** (Quadrat mit Pfeil; bei neueren iOS-Versionen erst **•••**) → **Zum Home-Bildschirm** → **Hinzufügen**.
**Android (Chrome):** Adresse öffnen → Menü **⋮** → **App installieren** (oder **Zum Startbildschirm hinzufügen**) → bestätigen.
**Android (Firefox):** Adresse öffnen → Menü **⋮** → **Zum Startbildschirm hinzufügen** (heißt je nach Version auch **App installieren**) → **Hinzufügen**.

> **Xiaomi, Redmi, POCO (gefunden im Gerätetest am 20.10.2026):** Passiert beim Hinzufügen **nichts, ohne Fehlermeldung**, fehlt dem Browser eine Erlaubnis. In den Einstellungen des Handys: **Apps → Apps verwalten → Firefox** (bzw. der benutzte Browser) **→ Weitere Berechtigungen → Startbildschirm-Verknüpfungen** erlauben. Danach klappt das Hinzufügen.

Die Adresse muss man nicht abtippen: Am PC unter **Einstellungen → Auf anderem Gerät öffnen → QR-Code zeigen** und den Code mit der Handykamera scannen.

- [ ] Auf dem Home-Bildschirm erscheint ein Symbol: **der goldbraune Keks-Krümel mit Besen auf violetter Kachel**, darunter „Krümel“ (seit E2-4a; ältere Installationen zeigen das alte blaue Haus, bis das Symbol neu geladen wird).
- [ ] Ein Tipp auf das Symbol öffnet die App **ohne Adressleiste** (wie eine normale App).
- [ ] Beim ersten Start erscheint die **Ersteinrichtung** (Namen eintragen, „Ich bin“ wählen). Einrichten und eine Aufgabe anlegen.
- [ ] Oben (Uhrzeit, Akku) und unten (Leiste Woche · Aufgaben · Erledigt · Einstellungen) wird **nichts abgeschnitten oder verdeckt**, auch nicht vom schwarzen Balken unten am iPhone.
- [ ] Gerät **quer** halten: nichts verschwindet hinter der Kamera-Aussparung.
- [ ] Die Seite „Woche“ zeigt, falls es Überfälliges gibt, die **orange Kachel „Überfällig“ gleich oben, ohne Scrollen**.
- [ ] App komplett schließen (nach oben wischen) und wieder öffnen: Die Daten sind noch da.

## 2. Ohne Internet

Einmal mit Internet geöffnet haben (Teil 1 reicht).

- [ ] **Flugmodus einschalten** (und WLAN aus).
- [ ] App schließen und neu öffnen: Sie startet normal, mit Schrift, Farben und deinen Aufgaben.
- [ ] Eine Aufgabe **abhaken** → Hinweis erscheint → **Rückgängig** funktioniert.
- [ ] Zwischen den Seiten wechseln (Woche, Aufgaben, Erledigt, Einstellungen): alles lädt.
- [ ] Flugmodus ausschalten. Die App läuft weiter und die Änderungen sind noch da.

## 3. Dark Mode

- [ ] Handy auf **dunkles Erscheinungsbild** stellen (Einstellungen des Handys). Krümel öffnen: Die App ist dunkel, ohne dass beim Start kurz Weiß aufblitzt (ein ganz kurzes Weiß beim allerersten Öffnen nach der Installation ist bekannt).
- [ ] Die Leiste oben (Uhrzeit, Akku) passt zur Farbe der App.
- [ ] In der App: **Einstellungen → Darstellung → Hell**: Die App wird hell, auch wenn das Handy dunkel ist. Dann **Dunkel** und **Automatisch (wie das Gerät)**.
- [ ] Alle Texte sind in beiden Farbschemata gut lesbar, auch auf der orangen Kachel „Überfällig“ und in der blauen Kachel „Stand“.

## 4. Sicherung herunterladen und einspielen

Einstellungen → Kachel **Sicherung**.

- [ ] **Sicherung herunterladen** antippen. Es erscheint eine Meldung mit dem Dateinamen (`kruemel-JJJJ-MM-TT.json`).
- [ ] Die Datei ist auffindbar: iPhone: App **Dateien** → Downloads (oder das System bietet „In Dateien sichern“ an). Android: **Downloads**. *Notieren, wo sie gelandet ist und wie viele Schritte es waren.*
- [ ] Aufgabe anlegen oder löschen, damit sich etwas ändert.
- [ ] **Sicherung einspielen …** → die Datei aus dem ersten Schritt wählen. *Notieren, ob die Datei im Auswahlfenster wählbar (nicht ausgegraut) ist.*
- [ ] Es erscheint die Frage „Sicherung einspielen?“ mit Zahlen. **Abbrechen** ändert nichts.
- [ ] Noch einmal wählen und **Ja, Daten ersetzen**: Die Meldung „Sicherung eingespielt …“ erscheint, die Aufgaben sind wie in der Sicherung.
- [ ] **Wichtig:** Hat das Handy zusätzlich eine Datei `kruemel-vor-import-…json` heruntergeladen (die automatische Kopie der Daten von vorher)? *Auf dem iPhone kann es sein, dass diese zweite Datei nicht ankommt oder nachgefragt wird („Mehrere Downloads erlauben?“). Bitte genau notieren, was passiert.*
- [ ] Eine **falsche Datei** wählen (z. B. ein Foto): Es erscheint eine rote Meldung, die Daten bleiben unverändert.

## 5. Mit Screenreader (optional)

*Optional:* Die Barrierefreiheit ist über die automatischen Prüfungen abgesichert (axe auf jeder Seite und jedem Fenster in hell und dunkel, Tastatur- und Fokus-Tests, Windows-Kontrastmodus; siehe `npm run check`). Dieser Teil ist für eine zusätzliche Prüfung von Hand gedacht und wurde für den Abschluss von Etappe 1 bewusst nicht durchgeführt.

**iPhone: VoiceOver** – Einstellungen → Bedienungshilfen → VoiceOver (ein-/ausschalten geht auch mit dreimal schnell auf die Seitentaste, wenn eingerichtet). Wischen nach rechts = nächstes Element, Doppeltipp = auslösen.
**Android: TalkBack** – Einstellungen → Bedienungshilfen → TalkBack. Gleiche Bedienung.

- [ ] Beim Öffnen wird die Seite **„Diese Woche“** angesagt; die Navigation unten wird als „Woche, Aufgaben, Erledigt, Einstellungen“ vorgelesen, die aktuelle Seite wird genannt.
- [ ] Eine Aufgabe wird mit **Titel, Zuständigkeit und Rhythmus** vorgelesen (nicht „Symbol“ oder Ähnliches).
- [ ] Der Knopf zum Abhaken heißt **„Abhaken: Titel“**. Nach dem Abhaken wird der Hinweis mit „Rückgängig“ vorgelesen.
- [ ] Ein Tipp (Doppeltipp) auf eine Aufgabe öffnet die **Detailansicht**; sie wird als Fenster angesagt, und man kommt mit „Schließen“ zurück.
- [ ] **Neue Aufgabe**: Jedes Feld wird mit seiner Beschriftung vorgelesen; bei einem Fehler wird die Meldung am Feld vorgelesen.
- [ ] **Erledigt**: Jeder Eintrag („Titel – Erledigt von … am …“) und der Knopf „Rückgängig: Titel“ werden vorgelesen.
- [ ] **Sicherung einspielen** und die Frage danach lassen sich mit dem Screenreader bedienen.
- [ ] Nichts Wichtiges ist **nicht erreichbar** (z. B. ein Knopf, der überhaupt nicht angesagt wird).

## Bekannte Einschränkungen (nicht als Fehler melden)

- **iPhone: eigene Daten für die installierte App.** Safari und die App vom Home-Bildschirm teilen keinen Speicher (Teil „Wichtig vorab“). Daten von Safari in die App bringen: in Safari „Sicherung herunterladen“, in der App „Sicherung einspielen“.
- **iPhone: Downloads aus der installierten App.** Wie die Datei ankommt (Vorschau mit Teilen-Symbol, Download-Anzeige oder gleich in „Dateien“), hängt von der iOS-Version ab; das ließ sich nicht automatisch prüfen und ist Teil dieses Tests. Die zweite, automatische Datei beim Einspielen kann von iOS unterdrückt werden. **Deshalb auf dem iPhone vor dem Einspielen immer zuerst selbst „Sicherung herunterladen“ drücken.**
- **iPhone: Dateiwahl.** Die Auswahl von `.json`-Dateien funktioniert über die App „Dateien“; Dateien aus anderen Apps (Mail, iCloud) müssen vorher dort liegen.
- **Startbild:** Android zeigt beim Start kurz hellen Hintergrund, auch wenn das Handy dunkel ist (das Manifest kennt nur eine Farbe). Auf dem iPhone gibt es kein eigenes Startbild; im Dark Mode kann kurz Weiß erscheinen.
- **Erster Start braucht Internet.** Danach läuft die App ohne.
- **Neue Versionen** kommen von selbst, wenn die App **mit Internet neu gestartet** wird. Welche Version läuft, steht unter **Einstellungen → Version** („Stand: Datum, Uhrzeit (Kennung)“). Läuft die App noch im Hintergrund (nur zur Seite gewischt, nicht geschlossen), bleibt sie bei der alten Version. **Update erzwingen:** Einstellungen → Version → **Neu laden** (mit Internet). Hilft das nicht, die App ganz schließen (aus der Liste der offenen Apps wischen) und neu öffnen. GitHub darf die Startseite bis zu 10 Minuten zwischenspeichern; direkt nach dem Hochladen kann es so lange dauern.
- **Keine Synchronisierung** zwischen Geräten (kommt in Etappe 2).

## Ergebnis des Gerätetests (20.10.2026, Abschluss Etappe 1)

| Gerät | Abschnitte 1–4 | Abschnitt 5 (Screenreader) | Funde |
|---|---|---|---|
| Android, Redmi, Firefox | wie beschrieben | nicht durchgeführt (optional) | Installation erst nach der Erlaubnis „Startbildschirm-Verknüpfungen“ für Firefox (siehe Hinweis in Abschnitt 1; jetzt auch in der App erklärt). Download und Einspielen der Sicherung funktionieren in der installierten App. |
| iPhone, Safari, installierte App | wie beschrieben | nicht durchgeführt (optional) | keine |

Abschnitt 5 wurde bewusst nicht von Hand getestet; die Barrierefreiheit ist über die automatischen Prüfungen abgesichert.
