# Supabase – Einrichtung und Betrieb (Etappe 2)

Stand: 20.10.2026 (Paket E2-1). Für den Product Owner und spätere Sitzungen. Die App nutzt Supabase erst ab E2-3; bis dahin liefert die Online-Version weiter Etappe 1 aus (Daten nur im Browser). Seit E2-3b liegen im Modus `supabase` (lokal `npm run dev` mit `VITE_BACKEND=supabase`) Aufgaben, Erledigungen und Namen im Haushalt; dafür muss die Migration `…_sync.sql` im Projekt eingespielt sein.

## Was wo liegt

| Was | Wo | Öffentlich? |
|---|---|---|
| Projekt „kruemel“ (`sedjrghhtopgewwkmvrw`), Region West EU (Paris, eu-west-3), Free Plan, Organisation „stephan-pro's Org“ | supabase.com, Konto des PO (GitHub-Login, ohne GitHub-Verbindung im Projekt) | – |
| Absender der Codes | **vorläufig** private Gmail-Adresse des PO (App-Passwort „Krümel temporär“); Ziel: `kruemel.haushaltsapp@gmail.com` (2-Faktor an, am 20.10.2026 von Google bis zu 7 Tage gesperrt) oder eigene Domain | Adresse ja |
| Projekt-URL `https://<ref>.supabase.co` und Publishable Key `sb_publishable_…` | GitHub-Repository-Variablen `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; lokal `.env.local` (Vorlage `.env.example`) | ja (stehen später ohnehin in der App) |
| Datenbank-Passwort | nur Passwortmanager des PO; wird bei `npx supabase link` im eigenen Terminal abgefragt | **nein** |
| Secret Key / service_role | bleibt im Dashboard, wird nirgends gebraucht | **nein** |
| App-Passwort des Gmail-Kontos | nur im Dashboard (Authentication → Emails → SMTP Settings) | **nein** |
| Tabellen, Regeln, Funktionen | `supabase/migrations/` im Repo, eingespielt mit `npx supabase db push` | ja |
| Mailvorlage mit dem Code | `supabase/templates/code.html` (in beide Vorlagen „Confirm signup“ und „Magic Link“ kopiert) | ja |

Kein Geheimnis gehört ins Repository, in den Chat oder in GitHub Actions. Der Hook `.githooks/pre-commit` bricht Commits mit erkennbaren Schlüsseln ab.

## Einstellungen im Dashboard (Soll-Stand)

- **Authentication → Sign In / Providers → Email:** E-Mail an, „Confirm email“ an, Email OTP Length 6, Email OTP Expiration 600 s (10 min).
- **Authentication → Emails → Templates:** „Confirm signup“ und „Magic Link“ mit Betreff „Dein Anmeldecode für Krümel“ und dem Text aus `supabase/templates/code.html` (enthält `{{ .Token }}`, keinen Link). Erst nach der SMTP-Einrichtung bearbeitbar („Set up custom SMTP to edit templates“). Stand 20.10.2026: gesetzt, Mail mit 6-stelligem Code kommt an.
- **Authentication → Emails → SMTP Settings:** eigener SMTP an, Host `smtp.gmail.com`, Port 465, Benutzer = Gmail-Adresse des Absenders, Passwort = App-Passwort, Absender = dieselbe Adresse, Absendername „Krümel“. **Aktuell (vorläufig):** private Adresse des PO mit App-Passwort „Krümel temporär“. **Offen:** auf `kruemel.haushaltsapp@gmail.com` oder eine eigene Domain umstellen, danach „Krümel temporär“ im Google-Konto widerrufen.
- **Auftragsverarbeitung (AVV/DPA):** Supabase bietet keinen separaten Vertrag zum Unterschreiben; das DPA ist Teil der Nutzungsbedingungen und gilt automatisch (Stand 20.10.2026, Quelle: Dashboard, Organization settings → Legal Documents, „View DPA“; dazu ein Transfer Impact Assessment). DSGVO: private Nutzung im Haushalt (Haushaltsausnahme), Daten in der EU (Region Paris).
- **Authentication → URL Configuration:** Site URL `https://stephan-pro.github.io/kruemel/`, Redirect URLs `https://stephan-pro.github.io/kruemel/` und `http://localhost:5173/kruemel/`. (Die Anmeldung läuft über den Code, Links in Mails gibt es nicht; die Adressen braucht Supabase trotzdem.)
- **Authentication → Rate Limits:** nur ansehen; „emails sent“ reicht mit dem Standardwert für zwei Personen.
- **Advisors → Security Advisor:** ohne Fehler und Warnungen (Row Level Security ist auf jeder Tabelle an).
- ~~**E2-5:** Neuanmeldungen abschalten~~ – ersetzt durch E2-5b:
- **Neue Konten nur mit Einladung (E2-5b):** Reihenfolge einhalten, sonst kann kurz jede Adresse ein Konto anlegen:
  1. Migration `20261026120000_friend_invites.sql` einspielen (`npx supabase db push`, siehe unten).
  2. **Authentication → Auth Hooks → „Add hook“ → „Before User Created“** → Hook type „Postgres“ → Schema `public`, Function `before_user_created` → „Create hook“ (danach steht er als „Enabled“ in der Liste). Kein Geheimnis nötig.
  3. Erst dann **Authentication → Sign In / Providers → „Allow new users to sign up“ an** → „Save changes“.
  4. Probe: im privaten Fenster mit einer unbekannten Adresse „Code schicken“ → Meldung „Krümel ist gerade nur mit Einladung nutzbar …“, keine Mail.
  Neue Konten von Hand weiter unter **Authentication → Users → „Add user“ → „Create new user“** (Adresse, „Auto Confirm User“ an); „Send invitation“ dort geht nicht mehr (der Hook lehnt es ab). Zurück zum alten Zustand: „Allow new users to sign up“ aus (dann hilft auch kein Link mehr) oder den Hook ausschalten (dann ist die Anmeldung wieder offen).
- **Mailgrenzen:** Supabase schickt höchstens einen Code je Adresse pro 60 s; die Gesamtzahl der Mails je Stunde steht unter Authentication → Rate Limits („emails sent“, beim eigenen SMTP einstellbar, Standard 30). Gmail erlaubt rund 500 Mails am Tag und sperrt bei Auffälligkeiten. Abgelehnte Anfragen ohne Einladung verschicken nichts; die App begrenzt Freundes-Links (5 offen, 10 am Tag je Person).

Dieselben Werte stehen für die lokale Test-Instanz in `supabase/config.toml`.

## Datenbank ändern

Jede Änderung ist eine neue Datei in `supabase/migrations/` (nie eine eingespielte ändern). In CI prüft `npm run check:db` (Job `db`) sie gegen eine frische lokale Instanz. Ins echte Projekt spielt sie der PO im eigenen Terminal ein:

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

`login` öffnet den Browser, `link` fragt das Datenbank-Passwort ab (nur einmal pro Rechner), `db push` zeigt die neuen Migrationen und spielt sie nach Rückfrage ein. Docker ist dafür nicht nötig. `npx supabase migration list` zeigt danach je Migration „Local“ und „Remote“; stehen in beiden Spalten dieselben Zeitstempel, ist alles eingespielt.

| Migration | Inhalt | Im echten Projekt |
|---|---|---|
| `20261020120000_household.sql` (E2-1) | Tabellen, Zeilenschutz, Schreibfunktionen, `pull_changes`, `ping` | eingespielt |
| `20261023120000_sync.sql` (E2-3a) | Versionsschutz (ältere App → `outdated`), `pull_changes` mit Version des Haushalts, Übernahme `add_household_data` | eingespielt (E2-3f) |
| `20261024120000_household_name.sql` (E2-3g) | Spalte `households.name`, Funktion `rename_household` (nur Mitglieder, eigener Haushalt) | eingespielt (23.10.2026) |
| `20261025120000_leave.sql` (E2-5a) | `remove_member`, `leave_household`, `delete_account` | spielt der PO ein |
| `20261026120000_friend_invites.sql` (E2-5b) | Freundes-Einladungen (`friend_invites`, Grenzen), Hook `before_user_created` (danach im Dashboard einschalten, siehe oben) | spielt der PO ein |
| `20261027120000_checks.sql` (K2b) | Trigger prüfen jede Aufgabe und Erledigung beim Schreiben (`invalid_change`); höchstens 500 Aufgaben und 50 000 Erledigungen je Haushalt (`too_many_tasks`, `too_many_completions`) | spielt der PO ein |
| `20261028120000_realtime_members.sql` (K2c) | `household_members` aus der Echtzeit-Liste genommen (Löschmeldungen gingen ohne Zeilenschutz an alle Angemeldeten; die App hört die Tabelle nicht ab) | spielt der PO ein |

## Kostenloser Tarif: Grenzen

- 500 MB Datenbank, 5 GB Datenverkehr im Monat, 50 000 aktive Nutzer im Monat, höchstens zwei aktive kostenlose Projekte. Für zwei Personen reicht das weit.
- **Pausierung:** Ein kostenloses Projekt, das 7 Tage nicht benutzt wird, pausiert. Dagegen ruft der Workflow `keepalive` (`.github/workflows/keepalive.yml`) täglich die Funktion `ping` auf (nur mit dem öffentlichen Key, ohne Daten). Pausiert es trotzdem: Die App läuft offline weiter, Änderungen warten auf dem Gerät; im Dashboard „Restore project“ klicken, danach wird alles nachgereicht. Nach 90 Tagen Pause lässt es sich nicht mehr per Klick wiederherstellen.
- **GitHub schaltet geplante Workflows ab**, wenn im Repository 60 Tage lang nichts passiert (kein Commit). GitHub schickt vorher eine Mail; dann unter Actions → keepalive → „Enable workflow“ wieder einschalten.
- **Keine herunterladbaren Backups** im Free Plan. Deshalb regelmäßig in der App **Einstellungen → Sicherung herunterladen**.
- Mails: Gmail erlaubt rund 500 Mails am Tag; Supabase begrenzt die Anmeldemails zusätzlich (Rate Limits).

## Prüfliste Dashboard

Für den Product Owner, K2c (24.10.2026). Etwa 45 Minuten, am besten einmal vor dem Gerätetest und danach alle paar Monate. Nur ansehen, außer wo „Tu“ steht. **Keine Passwörter, Schlüssel oder Codes** in Chat, Doku oder Screenshots weitergeben.

Das Projekt heißt „kruemel“ (Projekt-ID `sedjrghhtopgewwkmvrw`, Region West EU, Paris). Alle Adressen beginnen mit `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw`. Du musst bei supabase.com angemeldet sein. Supabase benennt Menüs gelegentlich um: Öffnet eine Adresse nicht, nimm den Klickpfad dahinter (linke Leiste im Projekt).

1. **Migrationen eingespielt?** Im Terminal im Projektordner: `npx supabase migration list`. *Soll:* In den Spalten „Local“ und „Remote“ stehen bei jeder Zeile dieselben Zeitstempel, auch bei `20261028120000`. *Sonst:* `npx supabase db push` ausführen und „Y“ bestätigen (Ablauf: Abschnitt „Datenbank ändern“). Die Reihenfolge bei E2-5b (Hook erst nach der Migration) gilt nur für die erste Einrichtung.
2. **Security Advisor.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/advisors/security`; Klickpfad: linke Leiste „Advisors“ → „Security Advisor“ → „Refresh“ (oder „Rerun linter“). *Soll:* 0 Fehler, 0 Warnungen. Hinweise („Info“) sind in Ordnung. *Sonst:* Meldung aufklappen, Text kopieren und Claude geben; nichts auf eigene Faust „beheben“.
3. **Neue Konten nur mit Einladung.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/auth/providers`; Klickpfad: „Authentication“ → „Sign In / Providers“ → „Email“. *Soll:* „Allow new users to sign up“ **an**; „Confirm email“ an. *Sonst:* Ist der Schalter aus, kann niemand mit Einladung ein Konto anlegen (Fehlermeldung beim Code anfordern): einschalten, nur wenn Schritt 4 stimmt, dann „Save changes“.
4. **Auth Hook „Before User Created“.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/auth/hooks`; Klickpfad: „Authentication“ → „Auth Hooks“. *Soll:* Die Zeile „Before User Created“ steht auf „Enabled“, Typ „Postgres“, Funktion `public.before_user_created`; die anderen Hooks sind nicht angelegt. **Probe:** In einem privaten Fenster `https://stephan-pro.github.io/kruemel/` öffnen, eine Adresse eingeben, die es bei Krümel nicht gibt (z. B. eine zweite eigene), „Code schicken“. *Soll:* Meldung „Krümel ist gerade nur mit Einladung nutzbar …“, keine Mail kommt an, und unter Schritt 12 erscheint kein neues Konto. *Sonst (Mail kommt an oder Konto entsteht):* sofort „Allow new users to sign up“ ausschalten (Schritt 3), das neue Konto unter Schritt 12 löschen, dann Hook neu anlegen (Beschreibung oben unter „Neue Konten nur mit Einladung“).
5. **Rate Limits.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/auth/rate-limits`; Klickpfad: „Authentication“ → „Rate Limits“. *Soll:* „Rate limit for sending emails“ (Mails pro Stunde, mit eigenem SMTP einstellbar; Standard etwa 30). Für zwei Personen reicht das, solange ihr euch nicht dutzendfach pro Stunde neu anmeldet; die Anmeldung gilt Wochen. „Rate limit for token verifications“ (Codeprüfungen, je IP und 5 Minuten, Standard 30) nicht erhöhen: Er schützt den 6-stelligen Code vor Durchprobieren. Schreib die Zahlen kurz in diese Datei (unten bei „Stand der Prüfung“). *Sonst:* Steht dort 2 oder weniger, kommt bei zwei Anmeldungen kurz nacheinander keine Mail: auf 30 stellen. Steht dort eine sehr hohe Zahl: auf 30 zurück.
6. **Code: Länge und Ablauf.** Wieder `…/auth/providers` → „Email“. *Soll:* „Email OTP Length“ = 6, „Email OTP Expiration“ = 600 (Sekunden = 10 Minuten). Die App sagt „10 Minuten“ und „6 Ziffern“. *Sonst:* Zahlen auf 6 und 600 stellen und speichern; stehen andere Werte, stimmen App-Texte und Prüfung nicht mehr.
7. **Adressen für die Weiterleitung.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/auth/url-configuration`; Klickpfad: „Authentication“ → „URL Configuration“. *Soll:* „Site URL“ = `https://stephan-pro.github.io/kruemel/`; unter „Redirect URLs“ genau `https://stephan-pro.github.io/kruemel/` und `http://localhost:5173/kruemel/`, nichts mit `*` (Sternchen). *Sonst:* Fremde oder Sternchen-Adressen löschen, Soll-Adressen eintragen, „Save changes“.
8. **Versand der Mails (SMTP).** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/auth/smtp`; Klickpfad: „Authentication“ → „Emails“ → Reiter „SMTP Settings“. *Soll:* „Enable custom SMTP“ an; Host `smtp.gmail.com`, Port `465`, Absendername „Krümel“. Nur ansehen: Das Passwort-Feld ist verdeckt und bleibt es; nichts neu eintippen. Notiere, welche Absenderadresse eingetragen ist: Solange es noch die private Adresse ist, bleibt die Umstellung auf das Krümel-Konto offen (Backlog). *Sonst (leer oder aus):* Dann geht der eingebaute Supabase-Versand mit sehr wenigen Mails pro Stunde; Claude fragen, nichts erraten.
9. **E-Mail-Vorlagen.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/auth/templates`; Klickpfad: „Authentication“ → „Emails“ → Reiter „Templates“. *Soll:* „Confirm signup“ **und** „Magic link or OTP“ („Magic Link“): Betreff „Dein Anmeldecode für Krümel“, Text enthält `{{ .Token }}` und keinen Link. Die Vorlage „Invite user“ wird nicht mehr genutzt (ihr Inhalt ist egal; „Send invitation“ ist gesperrt). Seit K2c sagt `supabase/templates/code.html` „diese E-Mail“ statt „diese Mail“: **Tu:** den Text der Datei (im Repository öffnen, alles kopieren) in beide Vorlagen einfügen und speichern. *Sonst:* Steht in der Mail ein Link statt des Codes, ist die falsche Vorlage aktiv: Text aus `code.html` einfügen.
10. **Zeilenschutz (RLS) und Tabellen.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/editor`; Klickpfad: „Table Editor“, Schema „public“ oben links. *Soll:* Sechs Tabellen (`households`, `household_members`, `invites`, `friend_invites`, `tasks`, `completions`), bei **jeder** ohne den Hinweis „RLS disabled“ (ein roter Schild-Hinweis). *Sonst:* Steht irgendwo „RLS disabled“: nichts ändern, Tabellenname notieren und Claude geben (Schritt 2 zeigt es ebenfalls als Fehler). Zeilen ansehen ist unbedenklich; nichts bearbeiten oder löschen.
11. **Echtzeit.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/realtime/settings`; Klickpfad: „Realtime“ → „Settings“. *Soll:* „Allow public access“ **aus** (nur private Kanäle). Dann `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/database/publications`; Klickpfad: „Database“ → „Publications“ → Zeile „supabase_realtime“ → Tabellen. *Soll (nach Migration `20261028120000`):* eingeschaltet sind nur `households`, `tasks` und `completions`, **nicht** `household_members`. *Sonst:* Steht „Allow public access“ an, ausschalten und speichern. Steht `household_members` noch dort, fehlt die Migration (Schritt 1).
12. **Nutzerliste.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/auth/users`; Klickpfad: „Authentication“ → „Users“. *Soll:* Nur Adressen, die du kennst: die beiden im Haushalt und eventuell eingeladene Freunde. *Sonst:* Unbekannte Adresse: Zeitpunkt „Created at“ notieren, Schritt 4 wiederholen; das Konto löschen (Drei-Punkte-Menü der Zeile → „Delete user“), erst nachdem du sicher bist, dass es kein Freund ist.
13. **Datenbank-Sicherungen.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/database/backups/scheduled`; Klickpfad: „Database“ → „Backups“. *Soll:* Im Free Plan gibt es **keine** herunterladbaren Sicherungen (Hinweis „upgrade to Pro“ ist normal). Deshalb sichert jede Person in der App unter „Einstellungen → Sicherung herunterladen“; Datei aufbewahren. *Sonst:* Stehen dort Sicherungen, ist der Tarif ein anderer als gedacht: Tarif unter Schritt 14 prüfen.
14. **Projekt läuft, Tarif, Pausieren.** Adresse `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw` (Startseite des Projekts) und `https://supabase.com/dashboard/org/_/billing`, Klickpfad „Organization“ → „Billing“. *Soll:* Projekt „Healthy“ (nicht „Paused“), Tarif „Free“. Dazu auf GitHub `https://github.com/stephan-pro/kruemel/actions/workflows/keepalive.yml`: der letzte Lauf ist **von heute oder gestern** und grün. *Sonst:* „Paused“ → „Restore project“ klicken; Lauf älter als 2 Tage oder grau: oben „Enable workflow“ klicken (GitHub schaltet geplante Läufe nach 60 Tagen ohne Änderung im Repository ab), dann „Run workflow“.
15. **Fork-Pull-Requests.** Adresse `https://github.com/stephan-pro/kruemel/settings/actions`; Klickpfad: Repository „Settings“ → „Actions“ → „General“ → Abschnitt „Fork pull request workflows from outside collaborators“. *Soll:* „Require approval for all outside collaborators“. *Sonst:* Auswählen und „Save“. (Der Workflow `pages` veröffentlicht zusätzlich nur nach einem Push ins eigene Repository.)
16. **Dein Zugang zu Supabase.** Adresse `https://supabase.com/dashboard/account/security`; Klickpfad: unten links Profilbild → „Account preferences“ → „Security“. Die Anmeldung läuft über GitHub, also gilt der Schutz deines GitHub-Kontos (Schritt 17). *Soll:* Du meldest dich bei Supabase mit „Continue with GitHub“ an; kein zweites Passwort-Konto mit derselben Adresse. *Sonst:* Gibt es ein Passwort-Konto, dort eine Zwei-Faktor-Anmeldung einrichten oder es löschen.
17. **Dein GitHub-Konto.** Adresse `https://github.com/settings/security`; Klickpfad: Profilbild → „Settings“ → „Password and authentication“. *Soll:* „Two-factor authentication“ ist „Enabled“, mindestens ein Passkey oder Sicherheitsschlüssel eingetragen (Abschnitt „Passkeys“ / „Security keys“), Wiederherstellungscodes an einem sicheren Ort. Unter `https://github.com/settings/sessions` keine Geräte, die du nicht kennst. *Sonst:* „Enable two-factor authentication“ klicken und den Schritten folgen; fremde Sitzungen mit „Revoke“ beenden und das Passwort ändern.

**Stand der Prüfung** (nach jedem Durchgang eintragen, ohne Geheimnisse): Datum · Mails pro Stunde (Schritt 5) · Codeprüfungen (Schritt 5) · Absenderadresse ist Krümel-Konto ja/nein (Schritt 8) · Auffälligkeiten.

| Datum | Mails/Stunde | Codeprüfungen | Absender Krümel-Konto | Auffälligkeiten |
|---|---|---|---|---|
| noch nicht geprüft | | | | |

## Wenn etwas anders aussieht

Die drei wahrscheinlichsten Fälle, jeweils mit dem ersten Schritt:

1. **Es kommt keine Mail mit dem Code an (oder eine Mail mit Link statt Code).** Erster Schritt: Spam-Ordner ansehen und eine Minute warten (Supabase schickt je Adresse höchstens eine Mail pro Minute). Dann Schritt 8 (SMTP an, Absender stimmt), Schritt 5 (Mails pro Stunde nicht verbraucht) und Schritt 9 (Vorlage mit `{{ .Token }}`). Hat Google das Absender-Konto gesperrt (Mail von Google im Postfach), erst dort die Sperre aufheben oder ein neues App-Passwort anlegen und im Dashboard eintragen.
2. **Die App sagt „nur mit Einladung“, obwohl die Person eingeladen ist, oder jede Adresse darf ein Konto anlegen.** Erster Schritt: Schritt 3 und 4 ansehen. Schalter „Allow new users to sign up“ aus → niemand kommt mehr hinein; Hook nicht „Enabled“ → jede Adresse darf. Bei „jede Adresse darf“ zuerst den Schalter ausschalten, dann den Hook prüfen. Ein Einladungslink gilt einmal und 7 Tage (Freundes-Link beim Anfordern des Codes verbraucht): Notfalls einen neuen Link erzeugen.
3. **Die App meldet „Keine Verbindung“ oder „nicht gespeichert“, das Netz ist aber da.** Erster Schritt: Schritt 14: Ist das Projekt „Paused“, „Restore project“ klicken (Änderungen warten bis dahin auf dem Gerät und werden danach übertragen). Ist es „Healthy“, Schritt 1 prüfen: Fehlt eine Migration, sagt die App „nicht gespeichert“ oder „neue Version“.
