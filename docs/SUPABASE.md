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

## Kostenloser Tarif: Grenzen

- 500 MB Datenbank, 5 GB Datenverkehr im Monat, 50 000 aktive Nutzer im Monat, höchstens zwei aktive kostenlose Projekte. Für zwei Personen reicht das weit.
- **Pausierung:** Ein kostenloses Projekt, das 7 Tage nicht benutzt wird, pausiert. Dagegen ruft der Workflow `keepalive` (`.github/workflows/keepalive.yml`) täglich die Funktion `ping` auf (nur mit dem öffentlichen Key, ohne Daten). Pausiert es trotzdem: Die App läuft offline weiter, Änderungen warten auf dem Gerät; im Dashboard „Restore project“ klicken, danach wird alles nachgereicht. Nach 90 Tagen Pause lässt es sich nicht mehr per Klick wiederherstellen.
- **GitHub schaltet geplante Workflows ab**, wenn im Repository 60 Tage lang nichts passiert (kein Commit). GitHub schickt vorher eine Mail; dann unter Actions → keepalive → „Enable workflow“ wieder einschalten.
- **Keine herunterladbaren Backups** im Free Plan. Deshalb regelmäßig in der App **Einstellungen → Sicherung herunterladen**.
- Mails: Gmail erlaubt rund 500 Mails am Tag; Supabase begrenzt die Anmeldemails zusätzlich (Rate Limits).
