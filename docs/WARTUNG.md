# Wartung und Sicherheit auf Dauer (WT-a)

Stand: 26.10.2026. Für den Product Owner, einfache Sprache. Ziel: mit wenig Aufwand sicher bleiben.

**Das Wichtigste in drei Sätzen:** Einmal im Monat 15 Minuten (Abschnitt 1). Bei einer Sicherheitswarnung nicht in Panik, sondern Abschnitt 2. Die Schalter bei GitHub und Supabase einmal einschalten (Abschnitt 5) – das ist der Teil mit dem größten Nutzen.

**Was automatisch läuft:** Jede Änderung wird vor dem Veröffentlichen geprüft (`check`, `db`). Nachts läuft `check-full` samt Sicherheitsprüfung der Bibliotheken (`scripts/audit.mjs`). Täglich weckt `keepalive` das Supabase-Projekt. Wöchentlich (montags) schlägt Dependabot Updates vor (`.github/dependabot.yml`), führt aber **nie** etwas selbst zusammen.

## 1. Monatsroutine (höchstens 15 Minuten)

Stelle dir einen Termin am Monatsanfang. Reihenfolge:

1. **Rote Läufe ansehen (2 Min.).** `https://github.com/stephan-pro/kruemel/actions`. Ist oben bei `check-full` oder `keepalive` ein rotes Kreuz? Dann Claude geben: „Der Lauf <Name> vom <Datum> ist rot, bitte Ursache finden.“ Die Sicherheitsprüfung ist ein Schritt in `check-full`; ihre Meldung steht im Protokoll des Laufs (Abschnitt 3).
2. **Dependabot-Vorschläge (5 Min.).** `https://github.com/stephan-pro/kruemel/pulls`. Jeder Vorschlag ist ein „Pull Request“ (PR) mit „Abhängigkeiten (…)“ im Titel. Regeln:
   - **Alle Häkchen grün** (`check` und `db`) und Titel enthält „minor-patch“ (kleine Updates): unten **„Merge pull request“** klicken. Danach prüft GitHub nochmals und veröffentlicht die Seite von selbst.
   - **Ein einzelner Vorschlag für eine große Version** („Bump … from 1.x to 2.x“): nicht blind zusammenführen. Claude fragen: „Prüfe PR <Nummer> (große Version), kann ich ihn zusammenführen?“ Claude liest die Änderungsliste und sagt ja oder nein.
   - **Ein Häkchen rot:** nicht zusammenführen. Claude geben: „PR <Nummer> ist rot, bitte ansehen.“ Ist die Ursache nicht schnell zu beheben, den PR mit **„Close pull request“** schließen. Dependabot schlägt die Version nicht erneut vor, bis eine neuere erscheint; das ist in Ordnung.
   - **Vorschläge für die Edge Function** (Titel „Abhängigkeiten (Edge Function)“): Die gleichen Pakete stehen auch in `package.json`. Beide Vorschläge gehören zusammen: erst den npm-PR und den Edge-Function-PR zusammenführen, dann einmal in einem eigenen PowerShell-Fenster im Projektordner `npx supabase functions deploy push` (Ablauf: `BENACHRICHTIGUNGEN.md` Abschnitt 7.5). Fehlt einer der beiden PRs, Claude bitten, die Versionen anzugleichen. Ohne dieses Bereitstellen läuft die alte Funktion weiter (sicher, nur nicht aktualisiert).
   - **Mehr als zehn Vorschläge offen:** nicht anwachsen lassen; im Zweifel alle schließen, die rot sind, und Claude bitten aufzuräumen.
3. **GitHub-Sicherheitswarnungen (2 Min.).** `https://github.com/stephan-pro/kruemel/security`. Bei „Dependabot alerts“ und „Secret scanning“ soll „0 open“ stehen. Etwas offen: Abschnitt 2.
4. **Supabase Security Advisor (2 Min.).** `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/advisors/security` (Klickpfad: Projekt „kruemel“ → linke Leiste „Advisors“ → „Security Advisor“). Soll: keine Fehler, keine Warnungen („Info“ ist in Ordnung). Sonst: Text der Meldung kopieren und Claude geben, selbst nichts verändern.
5. **Supabase-Werkzeug (1 Min.).** Das Werkzeug „Supabase CLI“ ist eine Bibliothek im Projekt (`supabase` in `package.json`), also kommt seine neue Version als Dependabot-Vorschlag (Punkt 2). Nichts extra installieren. Beim Bereitstellen oder `db push` schreibt es „A new version … is available“: das ist der Hinweis, den Vorschlag zusammenzuführen.
6. **Edge-Function-Importe (1 Min.).** Dependabot sollte sie erfassen (Eintrag `deno` in `dependabot.yml`). Ob das mit unserer Datei `supabase/functions/push/deno.json` im ersten Lauf wirklich klappt, ist beim ersten Mal zu beobachten: Kommt innerhalb von drei Wochen kein einziger Vorschlag, aber `npm outdated` (Claude fragen) zeigt neuere Versionen der beiden Pakete, trägt die Prüfung Claude von Hand ein. Die Pakete: `@block65/webcrypto-web-push` (Verschlüsselung der Meldungen) und `@supabase/supabase-js`, beide mit **fester** Version in `deno.json`.
7. **Backup (2 Min., Abschnitt 7).** In der App „Sicherung herunterladen“, Datei an einen sicheren Ort.

Im Dashboard sonst alle paar Monate die lange Liste in `SUPABASE.md` („Prüfliste Dashboard“) durchgehen.

## 2. Sicherheitswarnung oder CVE – was tun?

CVE ist eine Kennnummer für eine bekannte Sicherheitslücke in einer Bibliothek. Eine Warnung heißt nicht, dass Krümel angegriffen wird, sondern dass eine Bibliothek eine Schwachstelle hat. So gehst du vor:

1. **Schweregrad ablesen** (steht in der Warnung): *low* (niedrig), *moderate* (mittel), *high* (hoch), *critical* (kritisch).
2. **Betrifft es die App oder nur Werkzeuge?** Bei „Dependabot alerts“ steht „Runtime“ (läuft in der App oder Edge Function) oder „Development“ (nur Bau- und Testwerkzeuge, kommt nie zu den Geräten). Bei „Development“ reicht das Update im nächsten Monatslauf.
3. **Frist:** critical/high und „Runtime“: möglichst am selben oder nächsten Tag. moderate: innerhalb von zwei Wochen. low: Monatsroutine.
4. **Update:** Meist hat Dependabot schon einen PR („Security update“ im Titel) – Regeln wie in Abschnitt 1, Punkt 2; bei Sicherheitsupdates darfst du auch bei großer Version nach Claudes Ja sofort zusammenführen. Gibt es keinen PR, Claude beauftragen: „Alert <Nummer> aus GitHub: bitte beheben.“
5. **Gibt es noch keine behobene Version?** Dann Claude fragen, ob die Lücke bei uns überhaupt erreichbar ist. Wenn nicht erreichbar oder nicht behebbar: in `scripts/audit-exceptions.json` eintragen (Abschnitt 3) und in vier Wochen erneut prüfen.
6. **Rückfall, wenn nach einem Update etwas kaputt ist:**
   - Seite: Änderung rückgängig machen. Claude: „Mach den Commit <Kennung> mit `git revert` rückgängig und schiebe ihn auf main.“ Danach prüft GitHub und veröffentlicht die Seite von selbst. Es eilt? `https://github.com/stephan-pro/kruemel/actions/workflows/pages.yml` → „Run workflow“ veröffentlicht den Stand von `main` sofort (ohne Prüfung; erst nach dem Revert).
   - Edge Function: nach dem Revert noch einmal `npx supabase functions deploy push` (eigenes PowerShell-Fenster).
   - Datenbank: wird von Dependabot nie verändert. Migrationen ändern wir nur gezielt.
   - **Letzter Notausgang (nur wenn die Anmeldung/der Abgleich mit Supabase insgesamt nicht geht):** Auf GitHub `https://github.com/stephan-pro/kruemel/settings/variables/actions` die Variable `VITE_BACKEND` mit Wert `local` anlegen, dann `pages` neu starten (Actions → pages → „Run workflow“). Die App läuft dann wieder ohne Server, nur mit den Daten im Gerät (Kommentar in `.github/workflows/pages.yml`). **Vorher in der App die Sicherung herunterladen.** Die Daten im Supabase-Haushalt bleiben unberührt; was die Geräte im Modus `local` anzeigen, ist nicht erprobt. Zurück: Variable löschen und `pages` neu starten.
7. **Danach:** Kurz notieren (Datum, Bibliothek, was gemacht) in der Tabelle unten.

| Datum | Meldung | Entscheidung |
|---|---|---|
| – | noch keine | – |

## 3. Die nächtliche Sicherheitsprüfung und ihre Ausnahmeliste

`node scripts/audit.mjs` (Schritt in `check-full`, jede Nacht 02:17 UTC, auch von Hand startbar) fragt npm nach bekannten Lücken:

- **Bibliotheken der App** (die zu den Geräten kommen): ein Fund mit Stufe *high* oder *critical* macht den Lauf **rot**. Niedrigere Stufen erscheinen nur als gelbe Warnung im Protokoll.
- **Bau- und Testwerkzeuge:** nur gelbe Warnung („Entwicklung“), nie rot.
- **Ausnahme für einen Fund ohne Korrektur:** Eintrag in `scripts/audit-exceptions.json`:
  `{ "id": "GHSA-xxxx-xxxx-xxxx", "reason": "Warum ungefährlich oder nicht behebbar", "expires": "2026-12-31" }`
  Die Kennung steht im roten Protokoll. **Pflicht:** Begründung und Ablaufdatum (höchstens 90 Tage). Nach dem Ablauf wird der Lauf wieder rot, bis jemand neu entscheidet. Die Datei bearbeitet Claude auf deine Bitte; du entscheidest.
- Getestet am 26.10.2026 mit einer absichtlich veralteten Bibliothek: ohne Ausnahme rot, mit Ausnahme grün, abgelaufene oder unvollständige Ausnahme rot. Die App hat zurzeit 0 Funde.
- **Kein zusätzliches Werkzeug eingeführt.** Der OSV-Scanner (Google) liest zusätzlich viele andere Quellen, würde bei uns aber fast dieselben Funde melden: Die Datenbank hinter `npm audit` und Dependabot ist die GitHub-Advisory-Datenbank, und OSV enthält sie ebenfalls. Der Gewinn wäre klein, der Pflegeaufwand (ein weiteres Werkzeug, mehr Fehlalarme) größer. Neu bewerten, wenn Krümel Pakete aus anderen Quellen bekommt (zum Beispiel Deno-Pakete, die nicht über npm kommen) oder wenn Dependabot für die Edge Function nicht greift.

## 4. Schlüssel und Geheimnisse rotieren

Rotieren heißt: ein neues Geheimnis erzeugen, überall eintragen, das alte ungültig machen. Nötig bei Verdacht auf Abfluss (versehentlich in Chat, Screenshot, Commit gezeigt) – sonst nicht. **Geheimnisse nie in den Chat, ins Repository oder in Screenshots.** Eigene PowerShell-Fenster benutzen, nicht das Terminal in der Claude-App.

| Was | Wo beschrieben | Kurz |
|---|---|---|
| VAPID-Schlüssel (Benachrichtigungen) | `BENACHRICHTIGUNGEN.md` Abschnitt 7.6 | Neues Paar erzeugen, alte Werte als `…_OLD` behalten, GitHub-Variable `VITE_VAPID_PUBLIC_KEY` ändern, `pages` neu starten, nach 30 Tagen `…_OLD` löschen. |
| `PUSH_CRON_TOKEN` | `BENACHRICHTIGUNGEN.md` Abschnitt 7.4 und 7.6 | Neues Token erzeugen; zwei Stellen überschreiben: Edge-Function-Secret und Vault-Eintrag `push_cron_token`. |
| App-Passwort des Gmail-Kontos (Versand der Anmeldecodes) | `SUPABASE.md` Prüfliste Schritt 8 | Bei Google unter „Sicherheit → App-Passwörter“ das alte widerrufen, ein neues anlegen, im Supabase-Dashboard unter „Authentication → Emails → SMTP Settings“ eintragen. |
| Supabase-Schlüssel (Secret Key / Service Role) | nirgends im Repository | Liegt nur bei Supabase. Bei Verdacht im Dashboard unter „Project Settings → API Keys“ neu erzeugen; Claude fragen, welche Stellen betroffen sind (Edge Function liest ihn selbst). **Unsicher:** Der genaue Menüpunkt kann sich ändern. |
| Öffentlicher Schlüssel (`VITE_SUPABASE_PUBLISHABLE_KEY`) | – | Ist öffentlich und steht in der App; muss nicht geheim bleiben. Der Schutz liegt im Zeilenschutz der Datenbank. |

Wer ein Geheimnis versehentlich zeigt, rotiert **sofort** und nennt es danach Claude. Die Geheimnissuche vor dem Commit (`scripts/scan-secrets.mjs`) fängt nur erkennbare Muster.

## 5. Einmal bei GitHub und Supabase einschalten

Reihenfolge von oben nach unten; jeder Punkt dauert eine Minute. Ergebnis der Prüfung am 26.10.2026 (per GitHub-Schnittstelle): *Secret scanning* und *Push protection* sind **schon an**; *Dependabot alerts* (Warnungen) und *Dependabot security updates* sind **aus**; zu *Dependency graph* ist nichts abgefragt (wird automatisch mit den Dependabot-Warnungen an).

**Kosten:** Für ein **öffentliches** Repository (`stephan-pro/kruemel` ist öffentlich) sind Dependency graph, Dependabot alerts, Dependabot security updates, Secret scanning und Push protection kostenlos; die Dokumentation von GitHub nennt Secret scanning ausdrücklich für öffentliche Repositories, die übrigen Dependabot-Punkte stehen allen Repositories offen. Ausdrücklich **nicht** im Free-Tarif: „Code scanning“-Zusatzpakete für private Repositories (Krümel braucht sie nicht).

**GitHub (angemeldet als `stephan-pro`):**

1. `https://github.com/stephan-pro/kruemel/settings/security_analysis` (öffnet die Seite „Advanced Security“, hieß früher „Code security and analysis“; falls die Adresse nicht passt: Repository → „Settings“ → in der linken Leiste „Advanced Security“ bzw. „Code security“).
2. **Dependency graph:** „Enable“ (falls nicht schon an).
3. **Dependabot alerts:** „Enable“.
4. **Dependabot security updates:** „Enable“ (setzt die Warnungen voraus). Dann baut GitHub bei Warnungen selbst einen PR.
5. **Secret scanning** und **Push protection**: Es steht schon „Enabled“. Nur kontrollieren.
6. *Dependabot version updates* braucht keinen Schalter: die Datei `.github/dependabot.yml` genügt (liegt schon im Repository). Prüfen: `https://github.com/stephan-pro/kruemel/network/updates` – hier erscheinen die Läufe von Dependabot; „Check for updates“ startet den ersten sofort.
7. **Benachrichtigungen:** `https://github.com/settings/notifications` – bei „Dependabot alerts“ soll E-Mail (oder GitHub-App) angekreuzt sein, sonst bemerkt niemand eine Warnung. **Unsicher:** Die genaue Beschriftung kann sich ändern.
8. **Zwei-Faktor und Passkey prüfen:** Profilbild oben rechts → „Settings“ → „Password and authentication“ (Adresse: `https://github.com/settings/security`; die Dokumentation nennt diese Adresse nicht, sie hat bisher aber funktioniert). *Soll:* „Two-factor authentication“ ist „Enabled“; unter „Passkeys“ ist mindestens einer eingetragen („Add a passkey“); Wiederherstellungscodes an einem sicheren Ort.
9. **Fremde Pull Requests:** `https://github.com/stephan-pro/kruemel/settings/actions` → „Fork pull request workflows from outside collaborators“ soll auf „Require approval for all outside collaborators“ stehen (steht schon in `SUPABASE.md`, Schritt 15).

**Supabase** (`https://supabase.com/dashboard`):

10. **Security Advisor:** `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/advisors/security` – nur ansehen, kein Schalter (Abschnitt 1, Punkt 4). Kostenlos im Free-Tarif.
11. **Zwei-Faktor für das Supabase-Konto:** `https://supabase.com/dashboard/account/security`. Laut Supabase-Dokumentation gibt es dort nur Authenticator-App-Codes (TOTP), **keine Wiederherstellungscodes** – bei Verlust aller Faktoren kommt niemand mehr ins Konto. Deshalb zwei Faktoren eintragen (zum Beispiel Handy und Passwortmanager). Meldest du dich bei Supabase über „Continue with GitHub“ an, schützt dich der GitHub-Zugang (Punkt 8); die Seite ist dann vor allem für ein Konto mit eigenem Passwort wichtig (so auch `SUPABASE.md` Schritt 16). **Unsicher:** ob die Seite bei GitHub-Anmeldung ein eigenes 2FA anbietet; dann einfach Punkt 8 sicherstellen.

## 6. Wo Hinweise zu Störungen und Sicherheit erscheinen

- **Supabase-Störungen:** `https://status.supabase.com` (dort „Subscribe to updates“, E-Mail-Hinweise bei Störungen). Sicherheits-Meldeweg von Supabase: `https://supabase.com/.well-known/security.txt` (verweist auf `https://hackerone.com/supabase`, Mail `security@supabase.com`; Antwort laut Supabase innerhalb von fünf Werktagen). Mails von Supabase an die Konto-Adresse nicht in den Spam legen.
- **GitHub-Störungen:** `https://www.githubstatus.com` (E-Mail oder RSS abonnierbar). Bekannte Lücken in Bibliotheken: `https://github.com/advisories` (öffentliche Datenbank; für uns kommen die relevanten Treffer über Dependabot von selbst).
- **Was bei Störungen gilt:** Fällt Supabase aus, läuft die App weiter; Änderungen warten auf dem Gerät und werden nachgereicht. Bei einer Störung von GitHub Pages ist die Seite nicht erreichbar, bereits installierte Apps starten ohne Netz.
- **Eigene Meldung einer Lücke in Krümel** (falls dir jemand eine meldet): nicht öffentlich diskutieren, Claude geben.

## 7. Backups – was bei uns gilt

- **Supabase Free-Tarif:** Laut aktueller Supabase-Dokumentation (`https://supabase.com/docs/guides/platform/backups`, geprüft am 26.10.2026) gibt es **tägliche automatische Sicherungen mit Wiederherstellung nur in den bezahlten Tarifen** (Pro: 7 Tage). Für Free-Projekte empfiehlt Supabase, die Daten selbst regelmäßig zu exportieren. Das deckt sich mit `SUPABASE.md` Schritt 13.
- **Bei uns:** Die **Sicherung als Datei** in der App (Einstellungen → Daten → „Sicherung herunterladen“). Sie enthält Aufgaben, Erledigungen und Namen des Haushalts.
- **Rhythmus (Empfehlung):** einmal im Monat in der Monatsroutine, außerdem vor jeder Änderung an der Datenbank (`db push`), vor einem Notausgang (Abschnitt 2) und nach größeren Umbauten der Aufgaben. Die Datei an einem Ort außerhalb des Handys ablegen (Passwortmanager-Anhang, Cloud-Speicher), die letzten 3 behalten. Es sichert mindestens eine Person (`SUPABASE.md` Schritt 13 sagt: jede Person); dass eine Datei den ganzen gemeinsamen Haushalt enthält, ist nicht eigens getestet worden – nach der ersten Sicherung die Datei prüfen lassen (Claude: „Enthält diese Sicherung alle Aufgaben?“).
- **Nicht gesichert wird:** die Einstellungen der Geräte (Farbschema, Benachrichtigungs-Adressen) und die Anmeldekonten selbst.
- **Wiederherstellen:** „Sicherung einspielen“ in der App (legt vorher automatisch eine Kopie an).
- **Unsicher / offen:** ein vollständiger Datenbank-Export mit `npx supabase db dump` wäre möglich, ist hier aber nicht eingerichtet (braucht Zugangsdaten der Datenbank). Nur auf Wunsch einführen.
