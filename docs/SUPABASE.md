# Supabase – Einrichtung und Betrieb (Etappe 2)

Stand: 20.10.2026 (Paket E2-1). Für den Product Owner und spätere Sitzungen. Die App nutzt Supabase erst ab E2-3; bis dahin liefert die Online-Version weiter Etappe 1 aus (Daten nur im Browser).

## Was wo liegt

| Was | Wo | Öffentlich? |
|---|---|---|
| Projekt „kruemel“ (`sedjrghhtopgewwkmvrw`), Region West EU (Paris, eu-west-3), Free Plan, Organisation „stephan-pro's Org“ | supabase.com, Konto des PO (GitHub-Login, ohne GitHub-Verbindung im Projekt) | – |
| Absender der Codes | Gmail-Konto `kruemel.haushaltsapp@gmail.com` (2-Faktor an) | Adresse ja |
| Projekt-URL `https://<ref>.supabase.co` und Publishable Key `sb_publishable_…` | GitHub-Repository-Variablen `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; lokal `.env.local` (Vorlage `.env.example`) | ja (stehen später ohnehin in der App) |
| Datenbank-Passwort | nur Passwortmanager des PO; wird bei `npx supabase link` im eigenen Terminal abgefragt | **nein** |
| Secret Key / service_role | bleibt im Dashboard, wird nirgends gebraucht | **nein** |
| App-Passwort des Gmail-Kontos | nur im Dashboard (Authentication → Emails → SMTP Settings) | **nein** |
| Tabellen, Regeln, Funktionen | `supabase/migrations/` im Repo, eingespielt mit `npx supabase db push` | ja |
| Mailvorlage mit dem Code | `supabase/templates/code.html` (in beide Vorlagen „Confirm signup“ und „Magic Link“ kopiert) | ja |

Kein Geheimnis gehört ins Repository, in den Chat oder in GitHub Actions. Der Hook `.githooks/pre-commit` bricht Commits mit erkennbaren Schlüsseln ab.

## Einstellungen im Dashboard (Soll-Stand)

- **Authentication → Sign In / Providers → Email:** E-Mail an, „Confirm email“ an, Email OTP Length 6, Email OTP Expiration 600 s (10 min).
- **Authentication → Emails → Templates:** „Confirm signup“ und „Magic Link“ mit Betreff „Dein Anmeldecode für Krümel“ und dem Text aus `supabase/templates/code.html` (enthält `{{ .Token }}`, keinen Link). Erst nach der SMTP-Einrichtung bearbeitbar („Set up custom SMTP to edit templates“); bis dahin kommt die Standardmail mit Link.
- **Authentication → Emails → SMTP Settings:** eigener SMTP an, Host `smtp.gmail.com`, Port 465, Benutzer = Adresse des Krümel-Gmail-Kontos, Passwort = App-Passwort, Absender = dieselbe Adresse, Absendername „Krümel“.
- **Authentication → URL Configuration:** Site URL `https://stephan-pro.github.io/kruemel/`, Redirect URLs `https://stephan-pro.github.io/kruemel/` und `http://localhost:5173/kruemel/`. (Die Anmeldung läuft über den Code, Links in Mails gibt es nicht; die Adressen braucht Supabase trotzdem.)
- **Authentication → Rate Limits:** nur ansehen; „emails sent“ reicht mit dem Standardwert für zwei Personen.
- **Advisors → Security Advisor:** ohne Fehler und Warnungen (Row Level Security ist auf jeder Tabelle an).
- **E2-5:** Neuanmeldungen abschalten (Sign In / Providers → „Allow new users to sign up“ aus), sobald beide Konten bestehen.

Dieselben Werte stehen für die lokale Test-Instanz in `supabase/config.toml`.

## Datenbank ändern

Jede Änderung ist eine neue Datei in `supabase/migrations/` (nie eine eingespielte ändern). In CI prüft `npm run check:db` (Job `db`) sie gegen eine frische lokale Instanz. Ins echte Projekt spielt sie der PO im eigenen Terminal ein:

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

`login` öffnet den Browser, `link` fragt das Datenbank-Passwort ab (nur einmal pro Rechner), `db push` zeigt die neuen Migrationen und spielt sie nach Rückfrage ein. Docker ist dafür nicht nötig.

## Kostenloser Tarif: Grenzen

- 500 MB Datenbank, 5 GB Datenverkehr im Monat, 50 000 aktive Nutzer im Monat, höchstens zwei aktive kostenlose Projekte. Für zwei Personen reicht das weit.
- **Pausierung:** Ein kostenloses Projekt, das 7 Tage nicht benutzt wird, pausiert. Dagegen ruft der Workflow `keepalive` (`.github/workflows/keepalive.yml`) täglich die Funktion `ping` auf (nur mit dem öffentlichen Key, ohne Daten). Pausiert es trotzdem: Die App läuft offline weiter, Änderungen warten auf dem Gerät; im Dashboard „Restore project“ klicken, danach wird alles nachgereicht. Nach 90 Tagen Pause lässt es sich nicht mehr per Klick wiederherstellen.
- **GitHub schaltet geplante Workflows ab**, wenn im Repository 60 Tage lang nichts passiert (kein Commit). GitHub schickt vorher eine Mail; dann unter Actions → keepalive → „Enable workflow“ wieder einschalten.
- **Keine herunterladbaren Backups** im Free Plan. Deshalb regelmäßig in der App **Einstellungen → Sicherung herunterladen**.
- Mails: Gmail erlaubt rund 500 Mails am Tag; Supabase begrenzt die Anmeldemails zusätzlich (Rate Limits).
